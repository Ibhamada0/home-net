// Mikrotik sync edge function
// Actions:
//  - sync_traffic: pull PPP/Hotspot active sessions, upsert into traffic_usage
//  - apply_filters: push blocked_domains -> /ip/firewall/address-list and ensure drop rule
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function basicAuth(u: string, p: string) {
  return "Basic " + btoa(`${u}:${p}`);
}

async function mtkFetch(cfg: any, path: string, init?: RequestInit) {
  const scheme = cfg.use_https ? "https" : "http";
  const url = `${scheme}://${cfg.host}:${cfg.port}/rest${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: basicAuth(cfg.username, cfg.password),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mikrotik ${path} ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action } = await req.json();

    const { data: cfg, error: cfgErr } = await supabase
      .from("router_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error("لم يتم إعداد الراوتر بعد");

    if (action === "sync_traffic") {
      // pull PPP active + hotspot active in parallel
      const [ppp, hs] = await Promise.all([
        mtkFetch(cfg, "/ppp/active").catch(() => []),
        mtkFetch(cfg, "/ip/hotspot/active").catch(() => []),
      ]);

      const sessions = [...(Array.isArray(ppp) ? ppp : []), ...(Array.isArray(hs) ? hs : [])];
      const byName = new Map<string, { up: number; down: number }>();
      for (const s of sessions) {
        const name = s.name ?? s.user;
        if (!name) continue;
        const up = Number(s["bytes-out"] ?? s.bytes_out ?? 0);
        const down = Number(s["bytes-in"] ?? s.bytes_in ?? 0);
        const cur = byName.get(name) ?? { up: 0, down: 0 };
        byName.set(name, { up: cur.up + up, down: cur.down + down });
      }

      const { data: customers } = await supabase.from("customers").select("id, username");
      let updated = 0;
      const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      for (const c of customers ?? []) {
        const t = byName.get(c.username);
        if (!t) continue;
        const { error } = await supabase.from("traffic_usage").upsert(
          {
            customer_id: c.id,
            period_start: periodStart,
            upload_bytes: t.up,
            download_bytes: t.down,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "customer_id,period_start" },
        );
        if (!error) updated++;
      }

      return new Response(
        JSON.stringify({ ok: true, sessions: sessions.length, updated }),
        { headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    if (action === "apply_filters") {
      const LIST = "homenet-blocked";

      // 1) remove all existing entries in our list
      const existing = await mtkFetch(
        cfg,
        `/ip/firewall/address-list?list=${LIST}`,
      ).catch(() => []);
      for (const row of existing ?? []) {
        await mtkFetch(cfg, `/ip/firewall/address-list/${row[".id"]}`, {
          method: "DELETE",
        }).catch(() => null);
      }

      // 2) add active global domains
      const { data: domains } = await supabase
        .from("blocked_domains")
        .select("domain")
        .eq("scope", "global")
        .eq("is_active", true);

      let added = 0;
      for (const d of domains ?? []) {
        try {
          await mtkFetch(cfg, "/ip/firewall/address-list", {
            method: "PUT",
            body: JSON.stringify({ list: LIST, address: d.domain, comment: "homenet" }),
          });
          added++;
        } catch (_e) {
          // ignore individual failures
        }
      }

      // 3) ensure drop rule exists
      const rules = await mtkFetch(
        cfg,
        `/ip/firewall/filter?comment=homenet-block`,
      ).catch(() => []);
      if (!rules || rules.length === 0) {
        await mtkFetch(cfg, "/ip/firewall/filter", {
          method: "PUT",
          body: JSON.stringify({
            chain: "forward",
            action: "drop",
            "dst-address-list": LIST,
            comment: "homenet-block",
          }),
        }).catch(() => null);
      }

      return new Response(
        JSON.stringify({ ok: true, added }),
        { headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
