// A tiny server: serves the page in ./public and forwards three API calls to SukuuData,
// adding your key on the server so it never reaches the browser.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { SukuuData, SukuuDataError } from "sukuudata";

const apiKey = process.env.SUKUUDATA_KEY;
if (!apiKey) {
  console.error("Set SUKUUDATA_KEY first. Get a free key at https://sukuudata.com/register");
  process.exit(1);
}
const sukuu = new SukuuData({ apiKey, baseUrl: process.env.SUKUUDATA_BASE_URL });
const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

// Only these filters are passed through, so the page can't be used as an open proxy.
const SCHOOL_FILTERS = ["programme", "studentGender", "region", "residential", "category", "lat", "lng", "radius", "page"];

const routes = {
  "GET /api/programmes": async () => sukuu.programmes.list(),
  "GET /api/regions": async () => sukuu.regions.list(),
  "GET /api/schools": async (url) => {
    const params = { limit: 30 };
    for (const key of SCHOOL_FILTERS) {
      const value = url.searchParams.get(key);
      if (value) params[key] = value;
    }
    if (params.lat && params.lng) params.sort = "distance";
    return sukuu.secondarySchools.list(params);
  },
  "POST /api/validate": async (_url, body) => sukuu.placement.validate(body),
};

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw Object.assign(new Error("Request too large"), { status: 413 });
  }
  return JSON.parse(raw || "{}");
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = routes[`${req.method} ${url.pathname}`];
  try {
    if (route) {
      const body = req.method === "POST" ? await readJson(req) : undefined;
      return send(res, 200, await route(url, body));
    }
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
    const file = normalize(join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname));
    if (!file.startsWith(PUBLIC)) return send(res, 404, { error: "Not found" });
    return send(res, 200, await readFile(file), TYPES[extname(file)] ?? "application/octet-stream");
  } catch (err) {
    if (err?.code === "ENOENT") return send(res, 404, { error: "Not found" });
    if (err instanceof SukuuDataError) return send(res, err.status || 502, { error: err.message, code: err.code });
    console.error(err);
    return send(res, err?.status ?? 500, { error: err?.status ? err.message : "Something went wrong" });
  }
}).listen(PORT, () => console.log(`School picker running at http://localhost:${PORT}`));
