// 🧭 ตรรกะเส้นทาง/ภูมิศาสตร์: โหลด Leaflet, คำนวณระยะ/ทิศทาง, ดึงข้อมูล OSM,
// Dijkstra หาเส้นทางในตึก/ทางเท้า (นำทางปกติ ไม่มีคะแนนร่ม/แสงสว่าง/เวลากลางวัน-กลางคืน), ค้นหา/geocode สถานที่
import { CAT, KMITL_FLOOR1_NODES, KMITL_FLOOR1_EDGES, BUILDING_GRAPHS, OVERPASS_MIRRORS } from "./mapConstants";

// Dijkstra ธรรมดาบนกราฟเล็ก (ไม่กี่สิบโหนด) — ระยะทางจริงด้วย haversine ระหว่างโหนดที่เชื่อมกัน
// ใช้ได้กับกราฟชั้นไหนก็ได้ ส่ง nodes/edges ของชั้นนั้นเข้ามา
export function indoorFloorRoute(fromId, toId, nodes = KMITL_FLOOR1_NODES, edges = KMITL_FLOOR1_EDGES) {
  const adj = {};
  for (const id in nodes) adj[id] = [];
  for (const [a, b, dir] of edges) {
    if (!nodes[a] || !nodes[b]) continue; // edge อ้าง node ที่ไม่มีในชุดนี้ — ข้ามอย่างปลอดภัย ไม่ให้พัง
    const d = haversine([nodes[a].lon, nodes[a].lat], [nodes[b].lon, nodes[b].lat]);
    adj[a].push([b, d]);
    if (dir !== "oneway") adj[b].push([a, d]); // "oneway" = เดินได้ a→b ทางเดียว (เช่นบันไดเลื่อนขึ้นทางเดียว)
  }
  const dist = { [fromId]: 0 }, prev = {}, visited = new Set();
  const pq = [[0, fromId]];
  while (pq.length) {
    pq.sort((x, y) => x[0] - y[0]);
    const [d, u] = pq.shift();
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === toId) break;
    for (const [v, w] of adj[u] || []) {
      const nd = d + w;
      if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = u; pq.push([nd, v]); }
    }
  }
  if (dist[toId] === undefined) return null;
  const path = [toId];
  let cur = toId;
  while (prev[cur]) { cur = prev[cur]; path.unshift(cur); }
  return { path, distance: dist[toId] };
}

export function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.crossOrigin = ""; s.onload = () => resolve(window.L); s.onerror = reject;
    document.body.appendChild(s);
  });
}
export function haversine(a, b) {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180, dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180, la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function bearing(a, b) {
  const f1 = (a[1] * Math.PI) / 180, f2 = (b[1] * Math.PI) / 180, dl = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
// ทิศเลี้ยว ณ จุด wp คำนวณจากมุมเปลี่ยนทิศของเส้นทาง (ซ้าย/ขวาจริงตามทิศเดิน)
export function turnTH(coords, wp) {
  if (wp <= 0 || wp >= coords.length - 1) return null;
  const bIn = bearing(coords[wp - 1], coords[wp]);
  const bOut = bearing(coords[wp], coords[wp + 1]);
  const d = ((bOut - bIn + 540) % 360) - 180; // + = ขวา, - = ซ้าย
  const ad = Math.abs(d);
  if (ad < 18) return "ตรงไป";
  const side = d > 0 ? "ขวา" : "ซ้าย";
  if (ad > 150) return "เลี้ยว" + side + "หักศอก";
  if (ad > 55) return "เลี้ยว" + side;
  return "เบี่ยง" + side;
}
export function walkFrom(coords, wp, dist, dir) {
  let i = wp, acc = 0;
  while (true) {
    const j = i + dir;
    if (j < 0 || j >= coords.length) return coords[i];
    acc += haversine(coords[i], coords[j]);
    i = j;
    if (acc >= dist) return coords[i];
  }
}
// ทิศเลี้ยวแบบมองช่วง ~18 ม. ก่อน/หลังจุดเลี้ยว (กันมุมสั่นจาก geometry ละเอียด)
export function turnAt(coords, wp) {
  if (wp <= 0 || wp >= coords.length - 1) return null;
  const back = walkFrom(coords, wp, 18, -1);
  const fwd = walkFrom(coords, wp, 18, 1);
  const d = ((bearing(coords[wp], fwd) - bearing(back, coords[wp]) + 540) % 360) - 180;
  const ad = Math.abs(d);
  if (ad < 20) return "ตรงไป";
  const side = d > 0 ? "ขวา" : "ซ้าย";
  if (ad > 150) return "กลับตัว";
  if (ad > 115) return "เลี้ยว" + side + "หักศอก";
  if (ad > 50) return "เลี้ยว" + side;
  return "เบี่ยง" + side;
}
// ทิศเลี้ยวโดยอ้างอิง "ทิศที่ผู้ใช้กำลังมุ่งหน้าจริง" (จากตำแหน่ง -> จุดเลี้ยว) แม่นกว่า geometry ที่สั่น
export function turnSide(coords, wp, fromPt) {
  if (wp <= 0 || wp >= coords.length - 1) return null;
  const after = walkFrom(coords, wp, 16, 1);
  const bOut = bearing(coords[wp], after);
  const bIn = haversine(fromPt, coords[wp]) > 20 ? bearing(fromPt, coords[wp]) : bearing(walkFrom(coords, wp, 16, -1), coords[wp]);
  const d = ((bOut - bIn + 540) % 360) - 180;
  const ad = Math.abs(d);
  if (ad < 22) return "ตรงไป";
  const side = d > 0 ? "ขวา" : "ซ้าย";
  if (ad > 150) return "กลับตัว";
  if (ad > 115) return "เลี้ยว" + side + "หักศอก";
  if (ad > 50) return "เลี้ยว" + side;
  return "เบี่ยง" + side;
}
export function sampleLine(coords, stepM = 25) {
  const out = []; let carry = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1]; const segLen = haversine(a, b); if (segLen === 0) continue;
    let d = stepM - carry;
    while (d < segLen) { const t = d / segLen; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += stepM; }
    carry = (carry + segLen) % stepM;
  }
  if (out.length === 0 && coords.length) out.push(coords[0]);
  return out;
}
export function ratioNear(samples, pts, radiusM) {
  if (!pts || !pts.length) return null;
  let hit = 0; const degLat = radiusM / 111000;
  for (const s of samples) { const degLon = radiusM / (111000 * Math.cos((s[1] * Math.PI) / 180)); for (const p of pts) { if (Math.abs(p[1] - s[1]) > degLat || Math.abs(p[0] - s[0]) > degLon) continue; if (haversine(s, p) <= radiusM) { hit++; break; } } }
  return hit / samples.length;
}
export function countNear(samples, pts, radiusM) {
  if (!pts || !pts.length) return 0;
  let count = 0; const degLat = radiusM / 111000;
  for (const p of pts) { const degLon = radiusM / (111000 * Math.cos((p[1] * Math.PI) / 180)); for (const s of samples) { if (Math.abs(p[1] - s[1]) > degLat || Math.abs(p[0] - s[0]) > degLon) continue; if (haversine(p, s) <= radiusM) { count++; break; } } }
  return count;
}
export function pointToSegM(p, a, b) {
  const latR = (p[1] * Math.PI) / 180, kx = 111320 * Math.cos(latR), ky = 110540;
  const px = p[0] * kx, py = p[1] * ky, ax = a[0] * kx, ay = a[1] * ky, bx = b[0] * kx, by = b[1] * ky;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
export function nearPolyline(p, line, radiusM) {
  for (let i = 0; i < line.length - 1; i++) if (pointToSegM(p, line[i], line[i + 1]) <= radiusM) return true;
  return false;
}
// หา "จุดบนเส้นทางที่ใกล้ p ที่สุดจริงๆ" (ฉายตั้งฉากลง segment ไม่ใช่แค่จุดหักมุม)
export function nearestOnRoute(pt, coords, rcum) {
  let best = { off: Infinity, along: 0, seg: 0 };
  const latR = (pt[1] * Math.PI) / 180, kx = 111320 * Math.cos(latR), ky = 110540;
  const px = pt[0] * kx, py = pt[1] * ky;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = a[0] * kx, ay = a[1] * ky, bx = b[0] * kx, by = b[1] * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const off = Math.hypot(px - cx, py - cy);
    if (off < best.off) best = { off, along: rcum[i] + t * (rcum[i + 1] - rcum[i]), seg: i };
  }
  return best;
}
export function pip(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) c = !c; } return c; }
// ดัชนี footprint ตึก (bbox precheck) — เช็ค "จุดอยู่ในตัวตึกไหม" เร็วพอเรียกใน Dijkstra ทุก edge (กันเส้นลัดทะลุตึก)
export function buildingIndex(bldgs) {
  if (!bldgs || !bldgs.length) return null;
  return bldgs.map((b) => {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of b.ring) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
    return { ring: b.ring, minx, miny, maxx, maxy };
  });
}
export function inBuilding(p, idx) {
  if (!idx || !p) return false;
  for (const s of idx) {
    if (p[0] < s.minx || p[0] > s.maxx || p[1] < s.miny || p[1] > s.maxy) continue;
    if (pip(p[0], p[1], s.ring)) return true;
  }
  return false;
}
// 🏢 เส้นทางเดินในตึกทุกเส้น (จาก BUILDING_GRAPHS) — ใช้เช็คว่าจุดไหนอยู่ในโซนที่มีหลังคา (สำหรับ UI/badge ถ้าต้องใช้)
let _indoorLinesCache = null;
export function indoorCoveredLines(buildingGraphs = BUILDING_GRAPHS) {
  if (_indoorLinesCache) return _indoorLinesCache;
  const lines = [];
  for (const bg of buildingGraphs) {
    for (const [a, b] of bg.edges) {
      const na = bg.nodes[a], nb = bg.nodes[b];
      if (!na || !nb) continue;
      lines.push([[na.lon, na.lat], [nb.lon, nb.lat]]);
    }
  }
  _indoorLinesCache = lines;
  return lines;
}

export async function fetchOSM(bbox) {
  const cacheKey = "osm:" + bbox.map((x) => Math.round(x * 1000)).join(",");
  const b = bbox.join(",");
  // 1) ดึงผ่านเซิร์ฟเวอร์ (Vercel) — เสถียรกว่าดึง Overpass จากมือถือตรงๆ
  try {
    const res = await fetch("/api/osm?bbox=" + encodeURIComponent(b));
    if (res.ok) {
      const o = await res.json();
      if (o && o.ok) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ trees: o.trees, buildings: o.buildings, toilets: o.toilets, green: o.green, cameras: o.cameras, crossings: o.crossings, coveredWays: o.coveredWays || [] })); } catch (e) {}
        return { ...o, coveredWays: o.coveredWays || [], ok: true };
      }
    }
  } catch (e) {}
  // 2) สำรอง: ดึง Overpass ตรงจากเบราว์เซอร์
  const q = `[out:json][timeout:25];(node["amenity"="toilets"](${b});way["leisure"="park"](${b});way["landuse"="grass"](${b});way["natural"="water"](${b});way["natural"="wood"](${b});node["highway"="crossing"](${b}););out center;(way["highway"]["covered"~"yes|arcade"](${b});way["highway"="footway"]["bridge"](${b});way["man_made"="bridge"](${b}););out geom;`;
  for (const url of OVERPASS_MIRRORS) {
    const controller = new AbortController(); const t = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: controller.signal });
      clearTimeout(t); if (!res.ok) continue;
      const json = await res.json();
      const buildings = [], toilets = [], green = [], cameras = [], crossings = [], coveredWays = [];
      for (const el of (json?.elements || [])) {
        const tg = el.tags || {};
        if (el.type === "way" && Array.isArray(el.geometry)) {
          const line = el.geometry.map((g) => [g.lon, g.lat]).filter((p) => p[0] != null && p[1] != null);
          if (line.length < 2) continue;
          if (tg.covered === "yes" || tg.covered === "arcade" || tg.bridge || tg.man_made === "bridge") coveredWays.push(line);
          continue;
        }
        const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon; if (lat == null || lon == null) continue;
        const pt = [lon, lat];
        if (tg.highway === "crossing") crossings.push(pt);
        else if (tg.amenity === "toilets") toilets.push({ pt, tags: tg });
        else if (tg.building) buildings.push(pt);
        else if (tg.leisure === "park" || tg.landuse === "grass" || tg.natural === "wood" || tg.natural === "water") green.push(pt);
      }
      const out = { trees: [], buildings, toilets, green, cameras, crossings, coveredWays, ok: true };
      try { if (toilets.length + cameras.length + crossings.length > 0) localStorage.setItem(cacheKey, JSON.stringify(out)); } catch (e) {}
      return out;
    } catch (e) { clearTimeout(t); continue; }
  }
  try { const c = localStorage.getItem(cacheKey); if (c) { const o = JSON.parse(c); return { ...o, ok: true, cached: true }; } } catch (e) {}
  return { ok: false, trees: [], buildings: [], toilets: [], green: [], cameras: [], crossings: [], coveredWays: [] };
}

// คะแนนเส้นทาง (นำทางปกติ — ไม่มีร่ม/แสงสว่าง): เก็บระยะทาง/เวลา + รายชื่อห้องน้ำใกล้เส้นทางไว้ให้ผู้ช่วย AI ตอบได้
export function scoreRoutes(routes, osm) {
  return routes.map((r) => {
    const toiletPts = (osm.toilets || []).map((t) => t.pt);
    const samples = sampleLine(r.coordinates, 25);
    const toiletsN = countNear(samples, toiletPts, 150);
    const rcum = [0]; for (let i = 1; i < r.coordinates.length; i++) rcum[i] = rcum[i - 1] + haversine(r.coordinates[i - 1], r.coordinates[i]);
    const stepRoad = (ix) => { for (const st of (r.steps || [])) { if (ix >= st.wpStart && ix <= st.wpEnd && st.name) return st.name; } return ""; };
    let toiletList = [];
    for (const t of (osm.toilets || [])) {
      const np = nearestOnRoute(t.pt, r.coordinates, rcum);
      if (np.off <= 120) toiletList.push({ name: (t.tags && (t.tags.name || t.tags["name:th"])) || "ห้องน้ำสาธารณะ", along: Math.round(np.along), off: Math.round(np.off), road: stepRoad(np.seg) || stepRoad(np.seg + 1), pt: t.pt });
    }
    toiletList.sort((a, b) => a.off - b.off);
    const dedupT = [];
    for (const t of toiletList) {
      if (dedupT.some((u) => haversine(t.pt, u.pt) <= 30)) continue;
      dedupT.push(t);
    }
    return { ...r, toiletsNearby: dedupT, toiletsN };
  });
}

// แบ่งเส้นทางเป็นช่วงตาม "ในตึก / นอกตึก" ล้วนๆ (ตัด หมวดร่ม/แดด/ไฟ ออก) — ใช้ระบายสีเส้นทางบนแผนที่
export function routeSegments(coords, nodeKeys, bIdx) {
  const segs = [];
  if (!coords.length) return segs;
  let curPts = [coords[0]];
  let curCat = inBuilding(coords[0], bIdx) ? "indoor" : "outdoor";
  for (let i = 1; i < coords.length; i++) {
    const cat = inBuilding(coords[i], bIdx) ? "indoor" : "outdoor";
    if (cat !== curCat) {
      curPts.push(coords[i]); // จุดเปลี่ยนหมวดอยู่ปลายช่วงเดิม กันเส้นขาดตรงรอยต่อ
      segs.push({ cat: curCat, coordinates: curPts });
      curPts = [coords[i]];
      curCat = cat;
    } else {
      curPts.push(coords[i]);
    }
  }
  segs.push({ cat: curCat, coordinates: curPts });
  return segs;
}
// สีตามหมวด (ตัดโทนร่ม/แดด/ไฟออก — เหลือแค่ในตึก/นอกตึก)
export const SEGMENT_COLORS = { indoor: "#1A73E8", outdoor: "#34A853" };
export function popupHtml(p) {
  const photo = p.photo ? `<img src="${p.photo}" alt="" style="width:100%;max-width:240px;border-radius:8px;margin-top:6px"/>` : "";
  const date = (p.timestamp || "").slice(0, 16); const lbl = CAT[p.cat]?.label || p.type || "ปัญหา";
  return `<div style="max-width:240px;font-family:system-ui"><div style="font-weight:700;color:${catColor(p.cat)}">${lbl}</div><div style="font-size:13px;margin:4px 0;white-space:pre-wrap">${(p.comment || "").slice(0, 240)}</div><div style="font-size:12px;color:#555">สถานะ: <b>${p.state || "-"}</b></div><div style="font-size:11px;color:#888">${date}</div>${photo}</div>`;
}
function catColor(c) { return CAT[c]?.color || "#888"; }

// ── 🧭 Routing ของเราเอง: กราฟทางเท้า OSM + Dijkstra ตามระยะทางจริง (ไม่ถ่วงน้ำหนักร่ม/แสงสว่างอีกต่อไป) ──
export async function fetchWalkNet(bbox) {
  const cacheKey = "walknet5:" + bbox.map((x) => Math.round(x * 1000)).join(",");
  try { const cch = localStorage.getItem(cacheKey); if (cch) return JSON.parse(cch); } catch (e) {}
  const b = bbox.join(",");
  // 1) ผ่านเซิร์ฟเวอร์ (มี cache — โหลดครั้งต่อไปเร็วทันที)
  try {
    const r = await fetch("/api/walknet?bbox=" + encodeURIComponent(b));
    if (r.ok) {
      const o = await r.json();
      if (o.ways && o.ways.length) {
        try { localStorage.setItem(cacheKey, JSON.stringify(o)); } catch (e) {}
        return o;
      }
    }
  } catch (e) {}
  // 2) สำรอง: Overpass ตรงจากเบราว์เซอร์
  const q = `[out:json][timeout:25];way["highway"~"footway|path|pedestrian|living_street|residential|unclassified|service|steps|primary|secondary|tertiary|primary_link|secondary_link|tertiary_link"](${b});out geom;`;
  for (const url of OVERPASS_MIRRORS) {
    const controller = new AbortController(); const t = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: controller.signal });
      clearTimeout(t); if (!res.ok) continue;
      const j = await res.json();
      const ways = [];
      for (const el of j.elements || []) if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length > 1) ways.push(el.geometry.map((g) => [g.lon, g.lat]));
      if (!ways.length) continue;
      const out = { ways };
      try { localStorage.setItem(cacheKey, JSON.stringify(out)); } catch (e) {}
      return out;
    } catch (e) { clearTimeout(t); continue; }
  }
  return null;
}
// รวม way เป็นกราฟ: โหนด = จุดพิกัด (ปัดทศนิยม 5 ตำแหน่ง ≈ 1 ม. → จุดตัดซอยเชื่อมถึงกัน)
export function buildGraph(ways, bldgs, skywalkWays) {
  const bIdx = buildingIndex(bldgs); // กรอง snap edge ที่ลัดทะลุตึก
  const skySet = new Set(skywalkWays || []); // 🌉 way ไหนเป็นเส้น skywalk จริง — tag edge ที่เกิดจาก way พวกนี้ (เดินได้แม้ฝนตก)
  const nodes = new Map();
  const keyOf = (p) => p[0].toFixed(5) + "," + p[1].toFixed(5);
  const addEdge = (a, b2, isSky) => {
    const d = haversine(a, b2);
    if (d < 0.5 || d > 400) return;
    const ka = keyOf(a), kb = keyOf(b2);
    if (!nodes.has(ka)) nodes.set(ka, { pt: a, edges: [] });
    if (!nodes.has(kb)) nodes.set(kb, { pt: b2, edges: [] });
    const mid = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2];
    const extra = isSky ? { skywalk: true } : null;
    nodes.get(ka).edges.push({ to: kb, d, mid, ...extra });
    nodes.get(kb).edges.push({ to: ka, d, mid, ...extra });
  };
  for (const w of ways) {
    const isSky = skySet.has(w);
    // แบ่งช่วงยาวเป็นท่อนละ ≤50 ม. — ให้กราฟละเอียดพอสำหรับ snap จุดใกล้เคียง
    for (let i = 0; i < w.length - 1; i++) {
      const a = w[i], b2 = w[i + 1];
      const d = haversine(a, b2);
      const n = Math.max(1, Math.ceil(d / 50));
      let prevPt = a;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const q = k === n ? b2 : [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t];
        addEdge(prevPt, q, isSky);
        prevPt = q;
      }
    }
  }
  // เชื่อม "โหนดที่เกือบชนกัน" (≤16 ม.) ที่ยังไม่ต่อกัน — กันซอยที่ปลายไม่ได้ต่อ node กันใน OSM
  const SNAP = 16, scs = SNAP / 111000;
  const cell = new Map();
  for (const [k, n] of nodes) { const cx = Math.round(n.pt[0] / scs), cy = Math.round(n.pt[1] / scs); const ck = cx + "_" + cy; if (!cell.has(ck)) cell.set(ck, []); cell.get(ck).push(k); }
  for (const [k, n] of nodes) {
    const cx = Math.round(n.pt[0] / scs), cy = Math.round(n.pt[1] / scs);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = cell.get((cx + dx) + "_" + (cy + dy)); if (!arr) continue;
      for (const k2 of arr) {
        if (k2 === k) continue;
        const n2 = nodes.get(k2); const d = haversine(n.pt, n2.pt);
        if (d > 0.5 && d <= SNAP && !n.edges.some((e) => e.to === k2)) {
          const mid = [(n.pt[0] + n2.pt[0]) / 2, (n.pt[1] + n2.pt[1]) / 2];
          if (inBuilding(mid, bIdx)) continue; // ❌ snap ข้ามช่องว่างได้ แต่ห้ามลัดทะลุตัวตึก
          n.edges.push({ to: k2, d, mid });
        }
      }
    }
  }
  return nodes;
}

// 🏢 รวมกราฟในตึก (ทางเดิน/บันได/ลิฟต์ + จุดเชื่อมออกนอกตึก) เข้ากับกราฟทางเท้ากลางแจ้ง (walkNet)
// เพื่อให้ Dijkstra เส้นเดียวเดินทะลุจากพื้นธรรมดา → เข้าตึก → ขึ้น/ลงชั้น → ออกอีกฝั่งได้เลย
export function mergeIndoorGraph(outdoorNodes, buildingGraphs = BUILDING_GRAPHS, bridgeMaxM = 60) {
  if (!outdoorNodes || !buildingGraphs || !buildingGraphs.length) return outdoorNodes;
  const merged = new Map(outdoorNodes); // shallow copy — ไม่แก้กราฟกลางแจ้งต้นฉบับ
  for (const bg of buildingGraphs) {
    const keyOf = (id) => `IN:${bg.name}:${id}`;
    for (const id in bg.nodes) {
      const n = bg.nodes[id];
      merged.set(keyOf(id), { pt: [n.lon, n.lat], edges: [] });
    }
    for (const [a, b, dir] of bg.edges) {
      const na = bg.nodes[a], nb = bg.nodes[b];
      if (!na || !nb) continue; // กัน edge ที่อ้าง node ไม่มีจริง
      const d = haversine([na.lon, na.lat], [nb.lon, nb.lat]);
      const mid = [(na.lon + nb.lon) / 2, (na.lat + nb.lat) / 2];
      const ka = keyOf(a), kb = keyOf(b);
      merged.get(ka).edges.push({ to: kb, d, mid, indoor: true });
      if (dir !== "oneway") merged.get(kb).edges.push({ to: ka, d, mid, indoor: true });
    }
    // 🌉 จุดเชื่อมออกนอกตึก — หาโหนดกลางแจ้งที่ใกล้ที่สุด แล้วต่อ edge จริงด้วยระยะ haversine
    for (const link of bg.exteriorLinks || []) {
      const inKey = keyOf(link.node);
      if (!merged.has(inKey)) continue;
      const pIn = [link.lon, link.lat];
      let bestKey = null, bestD = bridgeMaxM;
      for (const [k, n] of outdoorNodes) {
        const d = haversine(pIn, n.pt);
        if (d < bestD) { bestD = d; bestKey = k; }
      }
      if (!bestKey) continue; // ไกลจากกราฟกลางแจ้งเกินไป — ยังต่อพื้นไม่ได้
      const d = haversine(pIn, merged.get(bestKey).pt);
      merged.get(inKey).edges.push({ to: bestKey, d });
      merged.get(bestKey).edges.push({ to: inKey, d });
    }
  }
  return merged;
}

// Dijkstra บนกราฟรวม (นอกตึก+ในตึก) — cost = ระยะทางจริงล้วนๆ ไม่มีตัวคูณร่ม/แสงสว่าง/เวลา
export function graphRoute(nodes, start, end) {
  if (!nodes || !nodes.size || !start || !end) return null;
  // จุดเริ่ม/จบ = โหนดใกล้สุด (≤120 ม.)
  let sk = null, ek = null, sd = 120, ed = 120;
  for (const [k, n] of nodes) {
    const d1 = haversine(start, n.pt); if (d1 < sd) { sd = d1; sk = k; }
    const d2 = haversine(end, n.pt); if (d2 < ed) { ed = d2; ek = k; }
  }
  if (!sk || !ek || sk === ek) return null;
  const dist = new Map(), prev = new Map();
  const heap = [[0, sk]]; dist.set(sk, 0);
  const hpush = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const hpop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r2 = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [cd, k] = hpop();
    if (k === ek) break;
    if (cd > (dist.get(k) ?? Infinity)) continue;
    for (const e of nodes.get(k).edges) {
      const nd = cd + e.d;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, k); hpush([nd, e.to]); }
    }
  }
  if (!dist.has(ek)) return null;
  const pathKeys = []; let cur = ek;
  while (cur) { pathKeys.push(cur); cur = prev.get(cur); if (pathKeys.length > 5000) return null; }
  pathKeys.reverse();
  const coords = [start, ...pathKeys.map((k) => nodes.get(k).pt), end];
  const nodeKeys = [null, ...pathKeys, null]; // คู่กับ coords ทุกจุด — null = จุดเริ่ม/จบสังเคราะห์ ไม่ใช่ node จริงในกราฟ
  let distM = 0; for (let i = 1; i < coords.length; i++) distM += haversine(coords[i - 1], coords[i]);
  const hasIndoor = pathKeys.some((k) => k && k.startsWith("IN:")); // เส้นทางในตึกสั้นๆ (เช่น <50ม.) เป็นเรื่องปกติ ไม่ใช่ "เส้นทางปลอม" — ยกเว้นกฎระยะขั้นต่ำให้
  if (!hasIndoor && distM < 50) return null;
  return { graphed: true, coordinates: coords, nodeKeys, distance_m: Math.round(distM), duration_min: Math.max(1, Math.round(distM / 75)), steps: [] };
}

// เหลือทางเลือกเส้นเดียว: เร็วที่สุด/สั้นที่สุด (ตัดการเลือก "ร่ม/สว่าง" ออก — นำทางปกติล้วนๆ)
export function pickRoutes(scored) {
  const fast = scored.reduce((b, r) => ((r.duration_min ?? 1e9) < (b.duration_min ?? 1e9) ? r : b), scored[0]);
  return { fastIdx: fast ? fast.index : 0 };
}

// พจนานุกรมสถานที่สำคัญย่านลาดกระบัง (พิกัดจริงโดยประมาณ) — ใช้ก่อนถาม Nominatim เพื่อความแม่นยำ/กันชื่อกำกวม
export const LANDMARKS = [
  { aliases: ["สจล", "สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง", "kmitl", "พระจอมเกล้าลาดกระบัง"], coord: [100.7789, 13.7292], name: "สจล. (KMITL)" },
  { aliases: ["ลาดกระบัง", "lat krabang", "ladkrabang"], coord: [100.7789, 13.7292], name: "ลาดกระบัง" },
  { aliases: ["สนามบินสุวรรณภูมิ", "สุวรรณภูมิ", "suvarnabhumi"], coord: [100.7501, 13.6900], name: "สนามบินสุวรรณภูมิ" },
  {
    name: "ตึกพระจอมเกล้าฯ (Sc8)",
    coord: [100.779996, 13.728996],
    query: null,
    aliases: [
      "sc8",
      "sc08",
      "sc 8",
      "sc 08",
      "ตึกพระจอม",
      "ตึกพระจอมเกล้า",
      "ตึกพระจอมเกล้าฯ",
      "ตึกพระจอมเกล้าเจ้าอยู่หัว",
      "ตึกปฏิบัติการณ์หลังใหม่",
      "ตึกปฏิบัติการหลังใหม่",
      "ถนนหลวงพรตพิทยพยัต",
      "ถนนหลวงพรตพิทยพยัตต์",
    ],
  },
];
// แก้พิกัดแลนด์มาร์กให้ "ทนทาน": ถ้า lm มี query เฉพาะ -> ถาม OSM (Nominatim) เอาพิกัดจริง
// แต่ยอมรับเฉพาะเมื่ออยู่ใกล้พิกัด curated (<1.5 กม.) กัน Nominatim คืนที่ผิด/กำกวม
export async function resolveLandmark(lm) {
  if (!lm.query) return { coord: lm.coord, name: lm.name, landmark: true };
  const key = "lmpos:" + lm.name;
  try { const cc = localStorage.getItem(key); if (cc) { const o = JSON.parse(cc); if (o && o.coord) return { coord: o.coord, name: lm.name, landmark: true }; } } catch (e) {}
  try {
    const g = await geocodeNominatim(lm.query);
    if (g && g.coord && haversine(g.coord, lm.coord) < 1500) {
      try { localStorage.setItem(key, JSON.stringify({ coord: g.coord })); } catch (e) {}
      return { coord: g.coord, name: lm.name, landmark: true };
    }
  } catch (e) {}
  return { coord: lm.coord, name: lm.name, landmark: true };
}
export async function resolvePlace(q) {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  if (s.length < 2) return null;
  for (const lm of LANDMARKS) {
    for (const a of lm.aliases) {
      const al = a.toLowerCase();
      if (s.includes(al) || (al.length >= 3 && al.includes(s))) return await resolveLandmark(lm);
    }
  }
  return null;
}
// viewbox ค้นหา geocode/reverse/suggest ปรับเป็นกรอบเขตลาดกระบัง (กว้างกว่าเดิมเพื่อครอบคลุมทั้งเขต)
const SEARCH_VIEWBOX = "100.70,13.78,100.85,13.65"; // west,north,east,south (ครอบคลุมเขตลาดกระบัง)
export async function geocodeNominatim(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=th&countrycodes=th&viewbox=${SEARCH_VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } }); if (!r.ok) return null;
    const j = await r.json(); if (!j.length) return null;
    return { coord: [parseFloat(j[0].lon), parseFloat(j[0].lat)], name: (j[0].display_name || q).split(",")[0] };
  } catch (e) { return null; }
}

export function pointAtDistance(coords, cum, d) {
  if (d <= 0) return coords[0];
  const last = cum.length - 1;
  if (d >= cum[last]) return coords[last];
  let k = 0; while (k < last && cum[k + 1] < d) k++;
  const seg = (cum[k + 1] - cum[k]) || 1; const t = (d - cum[k]) / seg;
  return [coords[k][0] + (coords[k + 1][0] - coords[k][0]) * t, coords[k][1] + (coords[k + 1][1] - coords[k][1]) * t];
}

let _gcChain = Promise.resolve();
export function queuedGeocode(query) {
  const key = "fg:" + query;
  try { const c = localStorage.getItem(key); if (c) return Promise.resolve(JSON.parse(c)); } catch (e) {}
  const run = async () => {
    await new Promise((r) => setTimeout(r, 1100)); // เคารพ rate limit Nominatim
    const g = await geocodeNominatim(query);
    try { if (g) localStorage.setItem(key, JSON.stringify(g)); } catch (e) {}
    return g;
  };
  const pr = _gcChain.then(run, run);
  _gcChain = pr.catch(() => {});
  return pr;
}
// reverse geocode: พิกัด -> ชื่อถนน/ตึก/ย่าน
export async function reverseGeocode(lonlat) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=th&zoom=18&lon=${lonlat[0]}&lat=${lonlat[1]}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address || {};
    const road = a.road || a.pedestrian || a.footway || a.path || "";
    const place = a.building || a.amenity || a.leisure || a.shop || a.mall || a.office || a.tourism || a.neighbourhood || "";
    return { road, place };
  } catch (e) { return null; }
}
// ต่อคิวเดียวกับ geocode (เคารพ rate limit Nominatim 1 req/วิ) + cache ลง localStorage
export function queuedReverse(lonlat) {
  const key = "rev:" + lonlat.map((x) => x.toFixed(5)).join(",");
  try { const c = localStorage.getItem(key); if (c) return Promise.resolve(JSON.parse(c)); } catch (e) {}
  const run = async () => {
    await new Promise((r) => setTimeout(r, 1100));
    const g = await reverseGeocode(lonlat);
    try { if (g) localStorage.setItem(key, JSON.stringify(g)); } catch (e) {}
    return g;
  };
  const pr = _gcChain.then(run, run);
  _gcChain = pr.catch(() => {});
  return pr;
}

// แนะนำสถานที่แบบสด: รวมแลนด์มาร์กในเครื่อง + ค้นจาก OSM (Nominatim) ตามที่พิมพ์
export async function suggestPlaces(q) {
  const normalize = (text) =>
    String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

  const s = normalize(q);
  const out = [];

  const SC8_NAME = "ตึกพระจอมเกล้าฯ (Sc8)";

  const isSc8Search = [
    "sc8",
    "sc08",
    "ตึกพระจอม",
    "ตึกพระจอมเกล้า",
    "ตึกพระจอมเกล้าฯ",
    "ตึกพระจอมเกล้าเจ้าอยู่หัว",
    "ตึกปฏิบัติการณ์หลังใหม่",
    "ตึกปฏิบัติการหลังใหม่",
    "ถนนหลวงพรตพิทยพยัต",
    "ถนนหลวงพรตพิทยพยัตต์",
  ].some((alias) => {
    const a = normalize(alias);
    return a.includes(s) || s.includes(a);
  });

  if (isSc8Search) {
    const lm = LANDMARKS.find(
      (item) => item.name === SC8_NAME
    );

    out.push({
      name: SC8_NAME,
      coord: [100.780099, 13.729721],
      src: "landmark",
      lm: lm || {
        name: SC8_NAME,
        coord: [100.780099, 13.729721],
        aliases: [],
      },
    });

    return out;
  }

  for (const lm of LANDMARKS) {
    const matched = lm.aliases?.some((alias) => {
      const a = normalize(alias);
      return a.includes(s) || s.includes(a);
    });

    if (matched && !out.some((item) => item.name === lm.name)) {
      out.push({
        name: lm.name,
        coord: lm.coord,
        src: "landmark",
        lm,
      });
    }
  }

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      "?format=json" +
      "&limit=6" +
      "&accept-language=th" +
      "&countrycodes=th" +
      "&viewbox=100.70,13.80,100.85,13.65" +
      "&bounded=1" +
      `&q=${encodeURIComponent(q)}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const results = await response.json();

      for (const item of results) {
        let name = (item.display_name || "")
          .split(",")
          .slice(0, 2)
          .join(", ")
          .trim();

        const normalizedName = normalize(name);

        const isOldSc8Name =
          normalizedName.includes(
            normalize("ตึกปฏิบัติการณ์หลังใหม่")
          ) ||
          normalizedName.includes(
            normalize("ตึกปฏิบัติการหลังใหม่")
          ) ||
          normalizedName.includes(
            normalize("ถนนหลวงพรตพิทยพยัต")
          );

        if (isOldSc8Name) {
          name = SC8_NAME;
        }

        if (
          name &&
          !out.some((existing) => existing.name === name)
        ) {
          out.push({
            name,
            coord: [
              parseFloat(item.lon),
              parseFloat(item.lat),
            ],
            src: isOldSc8Name ? "landmark" : "osm",
          });
        }
      }
    }
  } catch (error) {
    console.error("suggestPlaces error:", error);
  }

  return out.slice(0, 8);
}