// Home Net - Local MikroTik proxy
// Runs on your machine, forwards REST calls to the router with CORS enabled.
// If RouterOS REST is unavailable, it falls back to the classic RouterOS API.
//
// Usage:
//   1) Edit ROUTER_* below (or set env vars)
//   2) node proxy.mjs
//   3) The app calls http://localhost:8080/rest/...

import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import { URL } from "node:url";

const PORT          = Number(process.env.PORT          || 8080);
const ROUTER_HOST   = process.env.ROUTER_HOST   || "10.0.0.1";
const ROUTER_PORT   = Number(process.env.ROUTER_PORT   || 80);   // REST = 80 (http) or 443 (https)
const ROUTER_API_PORT = Number(process.env.ROUTER_API_PORT || 8728); // Classic API = 8728
const ROUTER_HTTPS  = (process.env.ROUTER_HTTPS  || "false") === "true";
const ROUTER_USER   = process.env.ROUTER_USER   || "admin";
const ROUTER_PASS   = process.env.ROUTER_PASS   || "";
const USE_API_FALLBACK = (process.env.ROUTER_API_FALLBACK || "true") !== "false";

const auth = "Basic " + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString("base64");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age":       "86400",
};

function encodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x4000) return Buffer.from([(length >> 8) | 0x80, length & 0xff]);
  if (length < 0x200000) return Buffer.from([(length >> 16) | 0xc0, (length >> 8) & 0xff, length & 0xff]);
  if (length < 0x10000000) return Buffer.from([(length >> 24) | 0xe0, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
  return Buffer.from([0xf0, (length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
}

function decodeLength(socket) {
  return new Promise((resolve, reject) => {
    const bytes = [];
    const onData = (chunk) => {
      for (const b of chunk) bytes.push(b);
      try {
        if (bytes.length < 1) return;
        const first = bytes[0];
        let needed = 1;
        if ((first & 0x80) === 0x00) needed = 1;
        else if ((first & 0xc0) === 0x80) needed = 2;
        else if ((first & 0xe0) === 0xc0) needed = 3;
        else if ((first & 0xf0) === 0xe0) needed = 4;
        else if ((first & 0xf8) === 0xf0) needed = 5;
        if (bytes.length < needed) return;

        socket.off("data", onData);
        socket.off("error", onError);
        socket.off("close", onClose);

        const extra = Buffer.from(bytes.slice(needed));
        if (extra.length) socket.unshift(extra);

        let length;
        if (needed === 1) length = first;
        else if (needed === 2) length = ((first & ~0x80) << 8) + bytes[1];
        else if (needed === 3) length = ((first & ~0xc0) << 16) + (bytes[1] << 8) + bytes[2];
        else if (needed === 4) length = ((first & ~0xe0) << 24) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
        else length = (bytes[1] << 24) + (bytes[2] << 16) + (bytes[3] << 8) + bytes[4];
        resolve(length);
      } catch (error) {
        reject(error);
      }
    };
    const onError = (error) => reject(error);
    const onClose = () => reject(new Error("RouterOS API connection closed"));
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function readExact(socket, length) {
  if (length === 0) return Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const onData = (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total < length) return;

      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);

      const all = Buffer.concat(chunks, total);
      const wanted = all.subarray(0, length);
      const extra = all.subarray(length);
      if (extra.length) socket.unshift(extra);
      resolve(wanted);
    };
    const onError = (error) => reject(error);
    const onClose = () => reject(new Error("RouterOS API connection closed"));
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function readSentence(socket) {
  const words = [];
  while (true) {
    const length = await decodeLength(socket);
    if (length === 0) return words;
    words.push((await readExact(socket, length)).toString("utf8"));
  }
}

function writeSentence(socket, words) {
  for (const word of words) {
    const body = Buffer.from(String(word), "utf8");
    socket.write(encodeLength(body.length));
    socket.write(body);
  }
  socket.write(Buffer.from([0]));
}

function sentenceToObject(words) {
  const obj = {};
  for (const word of words) {
    if (!word.startsWith("=")) continue;
    const next = word.indexOf("=", 1);
    if (next === -1) continue;
    obj[word.slice(1, next)] = word.slice(next + 1);
  }
  return obj;
}

async function openApiSocket() {
  const socket = net.connect({ host: ROUTER_HOST, port: ROUTER_API_PORT });
  socket.setTimeout(15000);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("RouterOS API timeout")));
  });
  return socket;
}

function createApiClient(socket) {
  return {
    run: async (words) => {
      writeSentence(socket, words);
      const rows = [];
      while (true) {
        const sentence = await readSentence(socket);
        const type = sentence[0];
        if (type === "!done" || type === "!empty") return rows;
        if (type === "!trap" || type === "!fatal") {
          const message = sentenceToObject(sentence).message || sentence.join(" ");
          while (type === "!trap") {
            const rest = await readSentence(socket).catch(() => []);
            if (rest[0] === "!done") break;
          }
          throw new Error(message);
        }
        if (type === "!re") rows.push(sentenceToObject(sentence));
      }
    },
    close: () => socket.end(),
  };
}

async function connectApi() {
  let socket = await openApiSocket();
  let client = createApiClient(socket);

  try {
    await client.run(["/login", `=name=${ROUTER_USER}`, `=password=${ROUTER_PASS}`]);
    return client;
  } catch {
    client.close();
  }

  socket = await openApiSocket();
  client = createApiClient(socket);

  const challenge = (await client.run(["/login"]))[0]?.ret;
  if (!challenge) throw new Error("RouterOS API login challenge was not returned");

  const response = "00" + crypto
    .createHash("md5")
    .update(Buffer.concat([Buffer.from([0]), Buffer.from(ROUTER_PASS), Buffer.from(challenge, "hex")]))
    .digest("hex");

  await client.run(["/login", `=name=${ROUTER_USER}`, `=response=${response}`]);
  return client;
}

function parseRestPath(url) {
  const parsed = new URL(url, "http://local");
  if (!parsed.pathname.startsWith("/rest/")) return null;
  const parts = parsed.pathname.slice(6).split("/").filter(Boolean).map(decodeURIComponent);
  let id = null;
  if (parts.length > 0 && parts[parts.length - 1].startsWith("*")) id = parts.pop();
  const menu = `/${parts.join("/")}`;
  return { parsed, menu, id };
}

async function apiFallback(req, body) {
  const parsed = parseRestPath(req.url || "");
  if (!parsed) throw new Error("Only /rest/* routes can use RouterOS API fallback");

  const client = await connectApi();
  try {
    if (req.method === "GET") {
      const words = [`${parsed.menu}/print`];
      for (const [key, value] of parsed.parsed.searchParams.entries()) {
        words.push(`?${key}=${value}`);
      }
      return await client.run(words);
    }

    if (req.method === "PUT" || req.method === "POST") {
      const payload = body?.length ? JSON.parse(body.toString("utf8")) : {};
      const words = [`${parsed.menu}/add`];
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null && value !== "") words.push(`=${key}=${value}`);
      }
      await client.run(words);
      return null;
    }

    if (req.method === "DELETE") {
      if (!parsed.id) throw new Error("DELETE requires a RouterOS .id in the URL");
      await client.run([`${parsed.menu}/remove`, `=.id=${parsed.id}`]);
      return null;
    }

    throw new Error(`Unsupported method for RouterOS API fallback: ${req.method}`);
  } finally {
    client.close();
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { ...CORS, "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, router: `${ROUTER_HOST}:${ROUTER_PORT}`, apiFallback: USE_API_FALLBACK ? `${ROUTER_HOST}:${ROUTER_API_PORT}` : false }));
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
    if (upstream.status === 404 && USE_API_FALLBACK && req.url?.startsWith("/rest/")) {
      const fallback = await apiFallback(req, body);
      const status = fallback === null ? 204 : 200;
      res.writeHead(status, { ...CORS, "content-type": "application/json" });
      return res.end(fallback === null ? "" : JSON.stringify(fallback));
    }

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
