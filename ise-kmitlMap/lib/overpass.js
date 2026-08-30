// พร็อกซีข้อมูล OpenStreetMap (Overpass) ฝั่งเซิร์ฟเวอร์
// เรียกจากเซิร์ฟเวอร์เสถียรกว่าเรียกจากเบราว์เซอร์ตรง และ cache ซ้ำได้
// หมายเหตุ: บน Vercel แต่ละ instance มี cache ของตัวเอง และหายเมื่อ instance ถูกรีไซเคิล
// จึงพึ่ง Cache-Control header ของ CDN เป็นหลัก

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// south,west,north,east — พื้นที่ สจล. ลาดกระบัง
const DEFAULT_BBOX = [13.719, 100.769, 13.739, 100.789];

const cache = new Map();

async function fetchOverpass(query, timeoutMs = 22000) {
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      return await res.json();
    } catch (e) {
      continue;
    }
  }
  return null;
}

const EMPTY = { trees: [], buildings: [], toilets: [], green: [], cameras: [], crossings: [], treeRows: [], coveredWays: [] };

// อาคาร / ห้องน้ำ / พื้นที่สีเขียว / ทางเชื่อมมีหลังคา
export async function osmData(raw) {
  let bbox = DEFAULT_BBOX;
  if (raw) {
    const parts = String(raw).split(",").map(Number);
    if (parts.length === 4 && parts.every((x) => Number.isFinite(x))) bbox = parts;
  }

  const ck = "osm:" + bbox.join(",");
  if (cache.has(ck)) return { status: 200, body: cache.get(ck), cacheable: true };

  const bb = bbox.join(",");
  const query = `[out:json][timeout:25];(node["amenity"="toilets"](${bb});way["amenity"="toilets"](${bb});way["leisure"="park"](${bb});way["landuse"="grass"](${bb});way["natural"="water"](${bb}););out center;(way["highway"]["covered"~"yes|arcade"](${bb});way["highway"="footway"]["bridge"](${bb});way["man_made"="bridge"](${bb}););out geom;`;

  const json = await fetchOverpass(query);
  if (!json) return { status: 200, body: { ok: false, ...EMPTY, error: "overpass ไม่ตอบ" } };

  const buildings = [], toilets = [], green = [], coveredWays = [];
  for (const el of json.elements || []) {
    const tg = el.tags || {};
    if (el.type === "way" && Array.isArray(el.geometry)) {
      const line = el.geometry.map((g) => [g.lon, g.lat]).filter((p) => p[0] != null && p[1] != null);
      if (line.length < 2) continue;
      if (tg.covered === "yes" || tg.covered === "arcade" || tg.bridge || tg.man_made === "bridge") coveredWays.push(line);
      continue;
    }
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const pt = [lon, lat];
    if (tg.amenity === "toilets") toilets.push({ pt, tags: tg });
    else if (tg.building) buildings.push(pt);
    else if (tg.leisure === "park" || tg.landuse === "grass" || tg.natural === "water") green.push(pt);
  }

  const out = { ok: true, ...EMPTY, buildings, toilets, green, coveredWays, count: { toilets: toilets.length, buildings: buildings.length } };
  cache.set(ck, out);
  return { status: 200, body: out, cacheable: true, maxAge: 3600 };
}

// โครงข่ายทางเดิน — ใช้สร้างกราฟสำหรับคำนวณเส้นทาง
export async function walknetData(raw) {
  const bbox = String(raw || "").trim();
  if (!/^[\d.,\s-]+$/.test(bbox)) return { status: 400, body: { error: "bbox ไม่ถูกต้อง" } };

  const ck = "walk:v3:" + bbox;
  if (cache.has(ck)) return { status: 200, body: cache.get(ck), cacheable: true, maxAge: 86400 };

  const query = `[out:json][timeout:20];way["highway"~"footway|path|pedestrian|living_street|residential|unclassified|service|steps|primary|secondary|tertiary|primary_link|secondary_link|tertiary_link"](${bbox});out geom;`;
  const json = await fetchOverpass(query, 20000);
  if (!json) return { status: 502, body: { error: "Overpass ไม่ตอบสนอง ลองใหม่อีกครั้ง" } };

  const ways = [];
  for (const el of json.elements || []) {
    if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length > 1) {
      ways.push(el.geometry.map((p) => [p.lon, p.lat]));
    }
  }
  if (!ways.length) return { status: 502, body: { error: "ไม่พบโครงข่ายทางเดินในพื้นที่นี้" } };

  const out = { ways, count: ways.length };
  cache.set(ck, out);
  return { status: 200, body: out, cacheable: true, maxAge: 86400 };
}

export function toResponse({ status, body, cacheable, maxAge }) {
  const headers = {};
  if (cacheable) headers["Cache-Control"] = `public, max-age=${maxAge || 3600}`;
  return Response.json(body, { status, headers });
}
