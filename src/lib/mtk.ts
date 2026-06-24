// MikroTik REST helper — calls the local proxy.
import { db } from "./local-db";

function defaultFallback(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return "http://localhost:8080";
}

export async function getProxyUrl(): Promise<string> {
  // localStorage takes priority so the user can override per-device.
  const ls = typeof window !== "undefined" ? localStorage.getItem("homenet_proxy_url") : null;
  if (ls) return ls;
  try {
    const cfg = await db.router_config.toArray();
    const active = cfg.find((c) => c.is_active) ?? cfg[0];
    if (active?.proxy_url) return active.proxy_url;
  } catch { /* ignore */ }
  return defaultFallback();
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
