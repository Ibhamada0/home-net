// Home Net - Local MikroTik proxy
// Runs on your machine, forwards REST calls to the router with CORS enabled.
//
// Usage:
//   1) Edit ROUTER_* below (or set env vars)
//   2) node proxy.mjs
//   3) The app calls http://localhost:8080/rest/...

import http from "node:http";
import { URL } from "node:url";

const PORT          = Number(process.env.PORT          || 8080);
const ROUTER_HOST   = process.env.ROUTER_HOST   || "10.0.0.1";
const ROUTER_PORT   = Number(process.env.ROUTER_PORT   || 80);   // REST = 80 (http) or 443 (https)
const ROUTER_HTTPS  = (process.env.ROUTER_HTTPS  || "false") === "true";
const ROUTER_USER   = process.env.ROUTER_USER   || "admin";
const ROUTER_PASS   = process.env.ROUTER_PASS   || "";

const auth = "Basic " + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString("base64");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age":       "86400",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { ...CORS, "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, router: `${ROUTER_HOST}:${ROUTER_PORT}` }));
  }

  try {
    const scheme = ROUTER_HTTPS ? "https" : "http";
    const target = `${scheme}://${ROUTER_HOST}:${ROUTER_PORT}${req.url}`;

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks);
    }

    const upstream = await fetch(target, {
      method:  req.method,
      headers: { "content-type": "application/json", authorization: auth },
      body,
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      ...CORS,
      "content-type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (e) {
    res.writeHead(502, { ...CORS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(e?.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`Home Net proxy → http://localhost:${PORT}`);
  console.log(`Forwarding to  → ${ROUTER_HTTPS ? "https" : "http"}://${ROUTER_HOST}:${ROUTER_PORT}`);
});
