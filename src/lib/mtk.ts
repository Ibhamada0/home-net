// MikroTik REST helper — calls the local proxy.
import { db } from "./local-db";

const FALLBACK = "http://localhost:8080";

export async function getProxyUrl(): Promise<string> {
  try {
    const cfg = await db.router_config.toArray();
    const active = cfg.find((c) => c.is_active) ?? cfg[0];
    return active?.proxy_url || localStorage.getItem("homenet_proxy_url") || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function mtk(path: string, init?: RequestInit): Promise<any> {
  const proxy = await getProxyUrl();
  const res = await fetch(`${proxy}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(
      `Router ${path} ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  return res.status === 204 ? null : await res.json();
}
