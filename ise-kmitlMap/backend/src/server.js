// ────────────────────────────────────────────────────────────────
// SciMap Backend — Express API
// แยกออกจาก frontend เพื่อให้ deploy เป็นคนละคอนเทนเนอร์ได้
// endpoint เหมือนเดิมทุกตัว frontend จึงไม่ต้องแก้โค้ดที่เรียก fetch
// ────────────────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import { list, insert, update, remove, logMapEdit, ROLES, USE_PG } from "./store.js";
import { osmHandler, walknetHandler } from "./overpass.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Express 4 ไม่จับ rejection ของ async handler เอง — ถ้าไม่ห่อไว้ error ตัวเดียว
// จะกลายเป็น unhandled rejection แล้ว Node 22 จะ kill process ทั้งคอนเทนเนอร์
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);


// ── health check สำหรับ docker healthcheck / load balancer ──
app.get("/health", (_req, res) => res.json({ ok: true, backend: "scimap", storage: USE_PG ? "postgres" : "memory" }));

/* ═══════════════ auth ═══════════════ */
app.post("/api/auth", wrap(async (req, res) => {
  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const users = await list("users");

  if (body.action === "register") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" });
    if (!body.password || String(body.password).length < 4) return res.status(400).json({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร" });
    if (users.some((u) => u.email.toLowerCase() === email)) return res.status(409).json({ ok: false, error: "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว" });
    const role = ROLES[body.role] ? body.role : "user";
    // TODO(prod): เก็บ bcrypt hash แทนรหัสผ่านตรงๆ
    const user = await insert("users", {
      id: "U" + String(users.length + 1).padStart(3, "0"),
      email, password: String(body.password),
      name: body.name || email.split("@")[0],
      username: body.username || email.split("@")[0],
      role, institution: body.institution || "KMITL", status: "active",
    });
    const { password, ...safe } = user;
    return res.json({ ok: true, user: safe });
  }

  if (body.action === "login") {
    const user = users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== String(body.password || "")) return res.status(401).json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    if (user.status !== "active") return res.status(403).json({ ok: false, error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายดูแลระบบ" });
    const { password, ...safe } = user;
    return res.json({ ok: true, user: safe });
  }

  return res.status(400).json({ ok: false, error: "action ไม่ถูกต้อง" });
}));

/* ═══════════════ CRUD กลางของทุก collection ═══════════════ */
const ALLOWED = new Set([
  "users", "requests", "feedback", "mapEdits", "contracts", "institutionAccess", "broadcasts",
  "mapBoundaries", "mapAssets", "mapDrafts", "categories", "news", "events",
  "eventInterest", "eventStats", "floors", "rooms", "usage", "requestQuota", "notifications",
]);
// collection ที่ถือว่าเป็นข้อมูลแผนที่ → บันทึกประวัติให้ผู้บริหารตรวจสอบ
const MAP_COLLECTIONS = {
  mapBoundaries: "ขอบเขตแผนผัง", mapAssets: "ข้อมูลประกอบแผนผัง", mapDrafts: "ข้อมูลแผนที่",
  rooms: "ข้อมูลห้อง", floors: "ข้อมูลชั้นอาคาร", events: "ข้อมูลกิจกรรม",
};

function guard(req, res) {
  if (ALLOWED.has(req.params.name)) return true;
  res.status(404).json({ ok: false, error: "ไม่พบชุดข้อมูล" });
  return false;
}


app.get("/api/data/:name", wrap(async (req, res) => {
  if (!guard(req, res)) return;
  res.json({ ok: true, items: await list(req.params.name) });
}));

app.post("/api/data/:name", wrap(async (req, res) => {
  if (!guard(req, res)) return;
  const { name } = req.params;
  const { _actor, ...item } = req.body || {};
  const row = await insert(name, item);
  if (MAP_COLLECTIONS[name]) {
    await logMapEdit({ actorName: _actor?.name, actorId: _actor?.id, action: "เพิ่ม" + MAP_COLLECTIONS[name], target: row.name || row.label || row.code || row.id, after: "สร้างใหม่" });
  }
  res.json({ ok: true, item: row });
}));

app.patch("/api/data/:name", wrap(async (req, res) => {
  if (!guard(req, res)) return;
  const { name } = req.params;
  const { id, _actor, ...patch } = req.body || {};
  const row = await update(name, id, patch);
  if (!row) return res.status(404).json({ ok: false, error: "ไม่พบรายการ" });
  if (MAP_COLLECTIONS[name]) {
    await logMapEdit({ actorName: _actor?.name, actorId: _actor?.id, action: "แก้ไข" + MAP_COLLECTIONS[name], target: row.name || row.label || row.code || row.id, after: JSON.stringify(patch).slice(0, 80) });
  }
  res.json({ ok: true, item: row });
}));

app.delete("/api/data/:name", wrap(async (req, res) => {
  if (!guard(req, res)) return;
  const { name } = req.params;
  const id = req.query.id;
  const actor = req.query.actor || "";
  const before = (await list(name)).find((r) => r.id === id) || {};
  const ok = await remove(name, id);
  if (ok && MAP_COLLECTIONS[name]) {
    await logMapEdit({ actorName: actor, action: "ลบ" + MAP_COLLECTIONS[name], target: before.name || before.label || before.code || id, before: "มีอยู่", after: "ถูกลบ" });
  }
  res.json({ ok });
}));

/* ═══════════════ สถิติรวม ═══════════════ */
app.get("/api/stats", wrap(async (_req, res) => {
  const [users, requests, feedback, news, events, eventStats, rooms, contracts, usage] = await Promise.all([
    list("users"), list("requests"), list("feedback"), list("news"),
    list("events"), list("eventStats"), list("rooms"), list("contracts"), list("usage"),
  ]);

  const last = usage[usage.length - 1] || {};
  const requestsByStatus = requests.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  const requestsByType = requests.reduce((a, r) => {
    const k = r.subject || r.type || "อื่นๆ";
    return { ...a, [k]: (a[k] || 0) + 1 };
  }, {});
  const daysLeft = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

  res.json({
    ok: true,
    overview: {
      totalUsers: users.length,
      activeUsers: last.activeUsers || 0,
      suspendedUsers: users.filter((u) => u.status !== "active").length,
      searches: last.searches || 0,
      routes: last.routes || 0,
      pendingRequests: requests.filter((r) => r.status === "pending").length,
      newFeedback: feedback.filter((f) => f.status === "new").length,
      publishedNews: news.filter((n) => n.published).length,
      buildings: new Set(rooms.map((r) => r.building)).size,
      rooms: rooms.length,
    },
    usage,
    requestsByStatus,
    requestsByType,
    contracts: contracts.map((c) => ({ ...c, daysLeft: daysLeft(c.endDate) })),
    eventStats: eventStats.map((s) => ({ ...s, title: (events.find((e) => e.id === s.eventId) || {}).name || s.eventId })),
  });
}));

/* ═══════════════ พร็อกซี OpenStreetMap ═══════════════ */
app.get("/api/osm", osmHandler);
app.get("/api/walknet", walknetHandler);

// ── ตัวจับ error สุดท้าย: ตอบ 500 แทนที่จะให้ process ตาย ──
app.use((err, _req, res, _next) => {
  console.error("[scimap-backend] error:", err);
  res.status(500).json({ ok: false, error: "เกิดข้อผิดพลาดภายในระบบ" });
});

// กันไม่ให้ error ที่หลุดรอดออกมาทำให้คอนเทนเนอร์ restart วนไปเรื่อยๆ
process.on("unhandledRejection", (e) => console.error("[scimap-backend] unhandledRejection:", e));

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[scimap-backend] listening on :${PORT} · storage=${USE_PG ? "postgres" : "memory"}`);
});
