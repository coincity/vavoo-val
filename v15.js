// Vavoo Stream Proxy v15 — Termux / Node.js
// Segmentos STREAMMATI (sin buffer). Canales ES locales.
//
// Uso:
//   node v15-termux.js
//   http://IP_MOVIL:3000/live?ch=historia.b
//   http://IP_MOVIL:3000/lista

import http from "node:http";
import { Readable } from "node:stream";

const PING_URL = "https://www.vavoo.tv/api/app/ping";
const BASE_SITES = ["https://vavoo.to", "https://kool.to"];
const LANGUAGE = "es";
const REGION = "ES";
const SEPARATORS = ["➾", "⟿", "->", "→", "»", "›"];

const LOCAL_CHANNELS = [
  { name: "Movistar Liga de Campeones", query: "liga de campeones" },
  { name: "HISTORIA.B", query: "HISTORIA .b" },
  { name: "HISTORIA.C", query: "HISTORIA .c" },
  { name: "ODISEA.B", query: "CANAL ODISEA .b" },
  { name: "ODISEA.C", query: "CANAL ODISEA .c" },
  { name: "DISCOVERY", query: "DISCOVERY CHANNEL .b" },
  { name: "NATGEO.B", query: "NATIONAL GEOGRAPHIC HD .b" },
  { name: "NATGEO.C", query: "NAT GEO .c" },
  { name: "NATGEOWILD", query: "NAT GEO WILD HD .b" },
  { name: "DAZNLIGA", query: "DAZN LALIGA 1 .c" },
  { name: "CAMPEONES", query: "M.LIGA DE CAMPEONES HD .b" },
  { name: "LIGA.B", query: "MOVISTAR LA LIGA .b" },
  { name: "LIGA.C", query: "M+ LALIGA .c" },
  { name: "BAR.B", query: "LALIGA TV BAR .b" },
  { name: "BAR.C", query: "LALIGA TV BAR .c" },
];

const cache = {
  sig: { value: null, ts: 0 },
  search: {},
  spain: { value: null, ts: 0 },
  resolve: {},
  rev: {},
};

const SIG_TTL = 240000;
const SEARCH_TTL = 600000;
const SPAIN_TTL = 1800000;
const RESOLVE_TTL = 300000;

const fetchT = (url, opts = {}, ms = 8000) =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });

async function getSig() {
  const now = Date.now();
  if (cache.sig.value && now - cache.sig.ts < SIG_TTL) return cache.sig.value;
  const ts = now;
  const payload = {
    reason: "app-focus",
    locale: LANGUAGE,
    theme: "dark",
    metadata: {
      device: { type: "desktop", uniqueId: `termux-${ts}` },
      os: { name: "linux", version: "Linux", abis: ["x64"], host: "node" },
      app: { platform: "electron" },
      version: { package: "tv.vavoo.app", binary: "3.1.8", js: "3.1.8" },
    },
    appFocusTime: 0,
    playerActive: false,
    playDuration: 0,
    devMode: false,
    hasAddon: true,
    castConnected: false,
    package: "tv.vavoo.app",
    version: "3.1.8",
    process: "app",
    firstAppStart: ts,
    lastAppStart: ts,
    ipLocation: null,
    adblockEnabled: true,
    proxy: { supported: ["ss"], engine: "Mu", enabled: false, autoServer: true },
    iap: { supported: false },
  };
  const r = await fetchT(PING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "MediaHubMX/2" },
    body: JSON.stringify(payload),
  }, 8000);
  if (!r.ok) throw new Error("Ping HTTP " + r.status);
  const data = await r.json();
  if (!data.addonSig) throw new Error("No addonSig");
  cache.sig = { value: data.addonSig, ts: now };
  return data.addonSig;
}

function apiHeaders(sig) {
  return {
    "content-type": "application/json; charset=utf-8",
    "mediahubmx-signature": sig,
    "user-agent": "MediaHubMX/2",
    accept: "*/*",
    "Accept-Language": LANGUAGE,
  };
}

function extractCountry(group) {
  group = (group || "").trim();
  if (!group) return "default";
  for (const sep of SEPARATORS) {
    if (group.includes(sep)) return group.split(sep)[0].trim() || "default";
  }
  return group;
}

function normalizeItem(item) {
  if (item.type === "iptv" && item.url) {
    return {
      name: item.name || "Unknown",
      url: item.url,
      country: extractCountry(item.group || ""),
    };
  }
  return null;
}

async function catalogFrom(base, sig, bodyExtra, maxPages) {
  let channels = [];
  let cursor = null;
  let pages = 0;
  while (pages < maxPages) {
    const body = {
      language: LANGUAGE,
      region: REGION,
      catalogId: "iptv",
      id: "iptv",
      adult: false,
      search: "",
      sort: "",
      filter: {},
      cursor,
      clientVersion: "3.0.2",
      ...bodyExtra,
    };
    const r = await fetchT(base + "/mediahubmx-catalog.json", {
      method: "POST",
      headers: apiHeaders(sig),
      body: JSON.stringify(body),
    }, 8000);
    if (!r.ok) throw new Error(base + " HTTP " + r.status);
    const data = await r.json();
    for (const item of data.items || []) {
      const c = normalizeItem(item);
      if (c) channels.push(c);
    }
    cursor = data.nextCursor;
    pages++;
    if (!cursor) break;
  }
  if (channels.length === 0) throw new Error("vuoto");
  return channels;
}

async function searchCatalog(query) {
  const now = Date.now();
  const key = query.toLowerCase();
  const cached = cache.search[key];
  if (cached && now - cached.ts < SEARCH_TTL) return cached.channels;
  const sig = await getSig();
  const channels = await Promise.any([
    catalogFrom(BASE_SITES[0], sig, { search: query }, 3),
    catalogFrom(BASE_SITES[1], sig, { search: query }, 3),
  ]);
  cache.search[key] = { channels, ts: now };
  return channels;
}

async function spainCatalog() {
  const now = Date.now();
  if (cache.spain.value && now - cache.spain.ts < SPAIN_TTL) return cache.spain.value;
  const sig = await getSig();
  const channels = await Promise.any([
    catalogFrom(BASE_SITES[0], sig, { filter: { group: "Spain" } }, 10),
    catalogFrom(BASE_SITES[1], sig, { filter: { group: "Spain" } }, 10),
  ]);
  cache.spain = { value: channels, ts: now };
  return channels;
}

function normName(s) {
  return s.toLowerCase().replace(/[._()]/g, " ").replace(/\s+/g, " ").trim();
}

function findChannel(query, catalog) {
  const q = normName(query);
  const esp = catalog.filter((c) => c.country.toLowerCase() === "spain");
  const pool = esp.length > 0 ? esp : catalog;
  for (const ch of pool) if (normName(ch.name) === q) return ch;
  for (const ch of pool) {
    const n = normName(ch.name);
    if (q.includes(n) || n.includes(q)) return ch;
  }
  const words = new Set(q.split(" "));
  let best = null;
  let bestScore = 0;
  for (const ch of catalog) {
    let score = [...words].filter((w) => normName(ch.name).includes(w)).length;
    if (ch.country.toLowerCase() === "spain") score += 2;
    if (score > bestScore) {
      best = ch;
      bestScore = score;
    }
  }
  return bestScore >= Math.max(1, words.size - 1) ? best : null;
}

function localLookup(ch) {
  const q = normName(ch);
  for (const e of LOCAL_CHANNELS) if (normName(e.query) === q) return e.query;
  for (const e of LOCAL_CHANNELS) if (normName(e.name) === q) return e.query;
  for (const e of LOCAL_CHANNELS) {
    const eq = normName(e.query);
    const en = normName(e.name);
    if ((eq && q.includes(eq)) || (en && q.includes(en))) return e.query;
  }
  return null;
}

async function resolveChannel(playUrl) {
  const sig = await getSig();
  let lastErr = "";
  for (const base of BASE_SITES) {
    try {
      const body = {
        language: LANGUAGE,
        region: REGION,
        url: playUrl,
        clientVersion: "3.0.2",
      };
      const r = await fetchT(base + "/mediahubmx-resolve.json", {
        method: "POST",
        headers: apiHeaders(sig),
        body: JSON.stringify(body),
      }, 8000);
      if (!r.ok) {
        lastErr = base + " HTTP " + r.status;
        continue;
      }
      const data = await r.json();
      if (Array.isArray(data) && data[0]?.url) return data[0].url;
      if (data?.url) return data.url;
      if (data?.streamUrl) return data.streamUrl;
      lastErr = base + " no url";
    } catch (e) {
      lastErr = base + ": " + e.message;
    }
  }
  throw new Error("resolve fallito: " + lastErr);
}

async function discover(ch) {
  const rq = localLookup(ch);
  if (rq) {
    try {
      const r = await searchCatalog(rq);
      const spa = r.filter((c) => c.country.toLowerCase() === "spain");
      const m = findChannel(ch, spa.length ? spa : r);
      if (m) return { playUrl: m.url, source: "local" };
    } catch (e) {}
    try {
      const m = findChannel(ch, await spainCatalog());
      if (m) return { playUrl: m.url, source: "local+spain" };
    } catch (e) {}
  }
  try {
    const r = await searchCatalog(ch);
    const m = findChannel(ch, r);
    if (m) return { playUrl: m.url, source: "search" };
  } catch (e) {}
  const words = normName(ch).split(" ").filter((w) => w.length > 1);
  if (words.length > 1) {
    try {
      const r = await searchCatalog(words.slice(0, 2).join(" "));
      const m = findChannel(ch, r);
      if (m) return { playUrl: m.url, source: "search-short" };
    } catch (e) {}
  }
  try {
    const r = await spainCatalog();
    const m = findChannel(ch, r);
    if (m) return { playUrl: m.url, source: "spain" };
  } catch (e) {}
  throw new Error("canale non trovato: " + ch);
}

async function getStreamUrl(ch) {
  const now = Date.now();
  const key = ch.toLowerCase();
  const cached = cache.resolve[key];
  if (cached && now - cached.ts < RESOLVE_TTL) return cached.url;
  const { playUrl } = await discover(ch);
  const url = await resolveChannel(playUrl);
  cache.resolve[key] = { url, ts: now };
  try {
    cache.rev[new URL(url).origin] = key;
  } catch (e) {}
  return url;
}

function baseName(url) {
  try {
    const p = new URL(url).pathname;
    return p.substring(p.lastIndexOf("/") + 1);
  } catch (e) {
    return url;
  }
}

async function refreshSegmentUrl(target) {
  try {
    const ch = cache.rev[new URL(target).origin];
    if (!ch) return null;
    delete cache.resolve[ch];
    const fresh = await getStreamUrl(ch);
    const man = await fetchT(fresh, { headers: { "User-Agent": "VAVOO/2.6" } }, 8000);
    if (!man.ok) return null;
    const text = await man.text();
    const want = baseName(target);
    for (const line of text.split("\n")) {
      const l = line.trim();
      if (l && !l.startsWith("#")) {
        try {
          const abs = new URL(l, fresh).href;
          if (baseName(abs) === want) return abs;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return null;
}

function rewriteManifest(text, manifestUrl, origin) {
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (m, uri) => {
        try {
          const abs = new URL(uri, manifestUrl).href;
          return 'URI="' + origin + "/seg?u=" + encodeURIComponent(abs) + '"';
        } catch {
          return m;
        }
      });
    }
    try {
      const absolute = new URL(t, manifestUrl).href;
      return origin + "/seg?u=" + encodeURIComponent(absolute);
    } catch {
      return line;
    }
  }).join("\n");
}

async function handleRequest(req) {
  const u = new URL(req.url);
  const path = "/" + (u.pathname.split("/").filter(Boolean).pop() || "");
  const PREFIX = u.origin;
  const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" };
  const PLAIN = { "Content-Type": "text/plain; charset=utf-8", ...CORS };

  if (path === "/map") {
    const ch = (u.searchParams.get("ch") || "").toLowerCase();
    if (!ch) return new Response("uso: /map?ch=<nome>", { status: 400, headers: PLAIN });
    try {
      const { playUrl, source } = await discover(ch);
      return new Response(playUrl + "  (fonte: " + source + ")", { headers: PLAIN });
    } catch (e) {
      return new Response("NON TROVATO: " + e.message, { headers: PLAIN });
    }
  }

  if (path === "/find") {
    const ch = u.searchParams.get("ch") || "";
    if (!ch) return new Response("uso: /find?ch=<nome>", { status: 400, headers: PLAIN });
    try {
      const results = await searchCatalog(ch).catch(() => spainCatalog());
      const lines = results.slice(0, 20).map((c) => c.country + " | " + c.name + " | " + c.url);
      return new Response(lines.join("\n"), { headers: PLAIN });
    } catch (e) {
      return new Response("ERR: " + e.message, { headers: PLAIN });
    }
  }

  if (path === "/warm") {
    const ch = u.searchParams.get("ch") || "HISTORIA.B";
    try {
      const url = await getStreamUrl(ch);
      return new Response("warm OK: " + url.substring(0, 50), { headers: PLAIN });
    } catch (e) {
      return new Response("warm ERR: " + e.message, { headers: PLAIN });
    }
  }

  if (path === "/debug") {
    const ch = u.searchParams.get("ch") || "HISTORIA.B";
    const steps = [];
    try {
      steps.push("1. resolve...");
      const streamUrl = await getStreamUrl(ch);
      steps.push("   OK: " + streamUrl.substring(0, 55));
      steps.push("2. fetch manifest...");
      const resp = await fetchT(streamUrl, { headers: { "User-Agent": "VAVOO/2.6" } }, 10000);
      steps.push("   HTTP " + resp.status);
      if (!resp.ok) return new Response(steps.join("\n"), { headers: PLAIN });
      const text = await resp.text();
      steps.push("3. manifest: " + text.split("\n").length + " righe");
      const segLine = text.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
      if (segLine) {
        const segResp = await fetchT(new URL(segLine, streamUrl).href, {
          headers: { "User-Agent": "VAVOO/2.6" },
        }, 10000);
        steps.push("4. segmento: HTTP " + segResp.status);
      }
      return new Response(steps.join("\n"), { headers: PLAIN });
    } catch (e) {
      steps.push("ERRORE: " + e.message);
      return new Response(steps.join("\n"), { status: 500, headers: PLAIN });
    }
  }

  if (path === "/channels") {
    try {
      const local = LOCAL_CHANNELS.map((c) => ({
        name: c.name,
        query: c.query || c.name,
        source: "local",
      }));
      let spain = [];
      try {
        const cat = await spainCatalog();
        spain = cat.map((c) => ({
          name: c.name,
          country: c.country,
          playUrl: c.url,
          source: "spainCatalog",
        }));
      } catch (e) {}
      const seen = new Set(local.map((c) => normName(c.name)));
      const extra = spain.filter((c) => !seen.has(normName(c.name)));
      return new Response(
        JSON.stringify(
          {
            ok: true,
            total: local.length + extra.length,
            local: local.length,
            spain: extra.length,
            channels: [...local, ...extra],
          },
          null,
          2,
        ),
        { headers: { "Content-Type": "application/json", ...CORS } },
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: e.message || String(e) }, null, 2),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
  }

  if (path === "/lista") {
    const base = u.origin;
    const m3u = `#EXTM3U url-tvg="https://raw.githubusercontent.com/davidmuma/EPG_dobleM/refs/heads/master/guiatv.xml,https://epgshare01.online/epgshare01/epg_ripper_NL1.xml.gz,https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiatv.xml" refresh="3600"
#EXTVLCOPT:network-caching=1000

#EXTINF:-1 group-title="DOCU" tvg-id="historia" tvg-name="HISTORIA" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/historia-es.png" ,HISTORIA .b
${base}/live?ch=historia.b
#EXTINF:-1 group-title="DOCU" tvg-id="historia" tvg-name="HISTORIA" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/historia-es.png" ,HISTORIA .c
${base}/live?ch=historia.c

#EXTINF:-1 group-title="DOCU" tvg-id="odisea" tvg-name="ODISEA HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/odisea-es.png" ,ODISEA b
${base}/live?ch=odisea.b
#EXTINF:-1 group-title="DOCU" tvg-id="odisea" tvg-name="ODISEA HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/odisea-es.png" ,ODISEA c
${base}/live?ch=odisea.c

#EXTINF:-1 group-title="DOCU" tvg-id="Discovery" tvg-name="ES| DISCOVERY CHANNEL HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/discovery-channel-es.png" ,DISCOVERY CHANNEL
${base}/live?ch=discovery

#EXTINF:-1 group-title="DOCU" tvg-id="National Geographic HD" tvg-name="ES| NAT GEOGRAPHIC HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/national-geographic-es.png" ,NAT GEOGRAPHIC b
${base}/live?ch=natgeo.b
#EXTINF:-1 group-title="DOCU" tvg-id="National Geographic HD" tvg-name="ES| NAT GEOGRAPHIC HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/national-geographic-es.png" ,NAT GEOGRAPHIC c
${base}/live?ch=natgeo.c

#EXTINF:-1 group-title="DOCU" tvg-id="Nat Geo Wild HD" tvg-name="ES| NAT GEO WILD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/national-geographic-wild-es.png" ,NAT GEO WILD
${base}/live?ch=natgeowild

#EXTINF:-1 group-title="LIGA" tvg-id="DAZN LaLiga HD" tvg-name="ES| DAZN LA LIGA 1 HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/dazn-laliga-es.png" ,BAZN LALIJA 1 HD
${base}/live?ch=DAZNLIGA

#EXTINF:-1 group-title="LIGA" tvg-id="DAZN LaLiga HD" tvg-name="ES| M+ LALIGA HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/laliga-tv-por-movistar-plus-es.png" ,M.LALIJA HD .b
${base}/live?ch=LIGA.B
#EXTINF:-1 group-title="LIGA" tvg-id="DAZN LaLiga HD" tvg-name="ES| M+ LALIGA HD" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/laliga-tv-por-movistar-plus-es.png" ,M.LALIJA HD .c
${base}/live?ch=LIGA.C
#EXTINF:-1 group-title="LIGA" tvg-id="LaLiga TV BAR" tvg-name="ES| LaLiga TV BAR" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/laliga-tv-por-movistar-plus-es.png" ,TV BAR .b
${base}/live?ch=BAR.B
#EXTINF:-1 group-title="LIGA" tvg-id="LaLiga TV BAR" tvg-name="ES| LaLiga TV BAR" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/laliga-tv-por-movistar-plus-es.png" ,TV BAR HD .c
${base}/live?ch=BAR.C

#EXTINF:-1 group-title="CAMP" tvg-id="M+ Liga de Campeones HD" tvg-name="ES| M+ LIGA DE CAMPEONES 1" tvg-logo="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/spain/liga-de-campeones-por-movistar-plus-es.png" ,CAMPEONES
${base}/live?ch=CAMPEONES
`;
    return new Response(m3u, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": 'attachment; filename="lista.m3u"',
        ...CORS,
      },
    });
  }

  if (path === "/live") {
    const ch = u.searchParams.get("ch");
    const directUrl = u.searchParams.get("url");
    if (!ch && !directUrl) {
      return new Response("uso: /live?ch=<nombre> o /live?url=<playUrl>", {
        status: 400,
        headers: PLAIN,
      });
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        let streamUrl;
        if (directUrl) streamUrl = await resolveChannel(directUrl);
        else streamUrl = await getStreamUrl(ch);
        const resp = await fetchT(streamUrl, { headers: { "User-Agent": "VAVOO/2.6" } }, 10000);
        if (resp.ok) {
          const text = await resp.text();
          return new Response(rewriteManifest(text, streamUrl, PREFIX), {
            headers: { "Content-Type": "application/vnd.apple.mpegurl", ...CORS },
          });
        }
      } catch (e) {}
      if (ch) delete cache.resolve[ch.toLowerCase()];
    }
    if (ch) delete cache.resolve[ch.toLowerCase()];
    return new Response("unavailable", { status: 502, headers: PLAIN });
  }

  if (path === "/seg") {
    const target = u.searchParams.get("u");
    if (!target) return new Response("uso: /seg?u=<url>", { status: 400, headers: PLAIN });
    let resp = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let url = target;
      if (attempt > 0) {
        const fresh = await refreshSegmentUrl(target);
        if (fresh) url = fresh;
      }
      try {
        resp = await fetchT(url, { headers: { "User-Agent": "VAVOO/2.6" } }, 15000);
        if (resp.ok) break;
      } catch (e) {
        resp = null;
      }
    }
    if (!resp || !resp.ok) {
      try {
        const chName = cache.rev[new URL(target).origin] || null;
        if (chName) delete cache.resolve[chName];
      } catch (e) {}
      return new Response("upstream fail", { status: 502, headers: PLAIN });
    }
    return new Response(resp.body, {
      headers: {
        "Content-Type": resp.headers.get("content-type") || "video/mp2t",
        ...CORS,
      },
    });
  }

  return new Response(
    "uso: /live?ch=<nome> | /seg | /map | /find | /warm | /debug | /channels | /lista",
    { status: 400, headers: PLAIN },
  );
}

const PORT = Number(process.env.PORT) || 3000;

function webHeadersToNode(headers) {
  const out = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "transfer-encoding" || lower === "connection" || lower === "keep-alive") return;
    out[key] = value;
  });
  return out;
}

http.createServer(async (nodeReq, nodeRes) => {
  try {
    const protocol = nodeReq.headers["x-forwarded-proto"] || "http";
    const host = nodeReq.headers.host || "localhost";
    const url = `${protocol}://${host}${nodeReq.url || "/"}`;
    const webReq = new Request(url, {
      method: nodeReq.method,
      headers: nodeReq.headers,
    });
    const webRes = await handleRequest(webReq);
    nodeRes.writeHead(webRes.status, webHeadersToNode(webRes.headers));
    if (webRes.body) {
      const nodeStream = Readable.fromWeb(webRes.body);
      nodeStream.pipe(nodeRes);
      nodeStream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!nodeRes.headersSent) nodeRes.writeHead(500);
        nodeRes.end();
      });
    } else {
      nodeRes.end();
    }
  } catch (err) {
    console.error("Error interno:", err);
    if (!nodeRes.headersSent) nodeRes.writeHead(500, { "Content-Type": "text/plain" });
    nodeRes.end("Error interno: " + (err?.message || err));
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Vavoo Proxy v15 listo en el puerto ${PORT}`);
  console.log(`Acceso local: http://0.0.0.0:${PORT}/lista`);
});
