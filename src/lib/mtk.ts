// MikroTik REST helper — calls the local proxy with per-request credentials (Mikhmon-style).
import { db, type RouterConfig } from "./local-db";

function defaultFallback(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return "http://localhost:8080";
}

export async function getActiveRouter(): Promise<RouterConfig | null> {
  try {
    const cfg = await db.router_config.toArray();
    return cfg.find((c) => c.is_active) ?? cfg[0] ?? null;
  } catch {
    return null;
  }
}

export async function getProxyUrl(): Promise<string> {
  const ls = typeof window !== "undefined" ? localStorage.getItem("homenet_proxy_url") : null;
  if (ls) return ls;
  const active = await getActiveRouter();
  if (active?.proxy_url) return active.proxy_url;
  return defaultFallback();
}

export function routerHeaders(c: RouterConfig | null): Record<string, string> {
  if (!c) return {};
  return {
    "X-MT-Host":     c.host,
    "X-MT-Port":     String(c.port),
    "X-MT-User":     c.username,
    "X-MT-Pass":     c.password,
    "X-MT-Https":    c.use_https ? "true" : "false",
    "X-MT-Api-Port": "8728",
  };
}

export async function mtk(path: string, init?: RequestInit): Promise<any> {
  const [proxy, active] = await Promise.all([getProxyUrl(), getActiveRouter()]);
  const res = await fetch(`${proxy}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...routerHeaders(active),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(
      `Router ${path} ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  return res.status === 204 ? null : await res.json();
}

// Mikhmon-style connect test: returns router identity (or throws).
export async function connectRouter(c: RouterConfig, proxyUrl?: string): Promise<{ identity: any; via: string }> {
  const proxy = proxyUrl || c.proxy_url || defaultFallback();
  const res = await fetch(`${proxy}/connect`, { headers: routerHeaders(c) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Connect failed (${res.status})`);
  return data;
}
