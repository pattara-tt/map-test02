// ────────────────────────────────────────────────────────────────
// PostgreSQL backend (Cloud SQL) — ใช้แทน mock in-memory เมื่อมี DATABASE_URL
// interface เหมือน lib/store.js ทุกอย่าง: list / insert / update / remove
// ────────────────────────────────────────────────────────────────
// โหลด driver แบบ lazy ตอนใช้งานจริงเท่านั้น
// magic comment turbopackIgnore/webpackIgnore บอก bundler ว่าอย่าไปตามหา "pg" ตอน build
// ทำให้โหมด mock (ไม่มี DATABASE_URL) ไม่ต้องติดตั้ง pg เลย และไม่มี warning

// ชื่อ collection ฝั่งแอป → ชื่อ table ฝั่ง DB
export const TABLES = {
  users: "users",
  requests: "requests",
  requestQuota: "request_quota",
  notifications: "notifications",
  feedback: "feedback",
  mapEdits: "map_edits",
  contracts: "contracts",
  institutionAccess: "institution_access",
  broadcasts: "broadcasts",
  mapBoundaries: "map_boundaries",
  mapAssets: "map_assets",
  mapDrafts: "map_drafts",
  categories: "categories",
  news: "news",
  events: "events",
  eventInterest: "event_interest",
  eventStats: "event_stats",
  floors: "floors",
  rooms: "rooms",
  usage: "usage",
};

// ตารางที่ไม่มีคอลัมน์ id (ใช้คีย์อื่นเป็น primary key)
const PK = { eventStats: "event_id", usage: "month" };
// ลำดับการเรียงเริ่มต้นของแต่ละตาราง
const ORDER = {
  mapEdits: '"at" DESC',
  news: "created_at DESC",
  events: "start_at DESC NULLS LAST",
  requests: "created_at DESC",
  feedback: "created_at DESC",
  usage: "month ASC",
};

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const snake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const rowOut = (r) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v])) : r);

let pool;
export async function getPool() {
  if (pool) return pool;
  let Pool;
  try {
    const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "pg");
    Pool = (mod.default || mod).Pool;
  } catch (e) {
    throw new Error("ต้องติดตั้งไดรเวอร์ฐานข้อมูลก่อนใช้งานโหมด PostgreSQL — รัน: npm install pg");
  }
  // รองรับทั้ง Cloud SQL Unix socket (App Engine / Cloud Run) และ TCP (Auth Proxy / local)
  const socket = process.env.INSTANCE_UNIX_SOCKET; // เช่น /cloudsql/PROJECT:REGION:INSTANCE
  pool = new Pool(
    socket
      ? { host: socket, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, max: 5 }
      : { connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined }
  );
  return pool;
}

export async function query(text, params) {
  const db = await getPool();
  return db.query(text, params);
}

function table(name) {
  const t = TABLES[name];
  if (!t) throw new Error("ไม่รู้จัก collection: " + name);
  return t;
}

export async function list(name) {
  const order = ORDER[name] || (PK[name] ? snake(PK[name]) : "created_at DESC");
  const { rows } = await query(`SELECT * FROM ${table(name)} ORDER BY ${order}`);
  return rows.map(rowOut);
}

export async function insert(name, item) {
  const pk = PK[name] || "id";
  const row = { ...item };
  if (pk === "id" && !row.id) row.id = name.slice(0, 2).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8);

  const keys = Object.keys(row).filter((k) => row[k] !== undefined);
  const cols = keys.map((k) => `"${snake(k)}"`).join(", ");
  const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
  const vals = keys.map((k) => row[k]);

  const { rows } = await query(
    `INSERT INTO ${table(name)} (${cols}) VALUES (${ph})
     ON CONFLICT ("${snake(pk)}") DO UPDATE SET ${keys.filter((k) => k !== pk).map((k) => `"${snake(k)}" = EXCLUDED."${snake(k)}"`).join(", ") || `"${snake(pk)}" = EXCLUDED."${snake(pk)}"`}
     RETURNING *`,
    vals
  );
  return rowOut(rows[0]);
}

export async function update(name, id, patch) {
  const pk = PK[name] || "id";
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== pk);
  if (!keys.length) return null;
  const sets = keys.map((k, i) => `"${snake(k)}" = $${i + 1}`).join(", ");
  const { rows } = await query(
    `UPDATE ${table(name)} SET ${sets} WHERE "${snake(pk)}" = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => patch[k]), id]
  );
  return rows[0] ? rowOut(rows[0]) : null;
}

export async function remove(name, id) {
  const pk = PK[name] || "id";
  const { rowCount } = await query(`DELETE FROM ${table(name)} WHERE "${snake(pk)}" = $1`, [id]);
  return rowCount > 0;
}

export async function logMapEdit({ actorName, actorId, action, target, before = "-", after = "-" }) {
  const at = new Date().toISOString().slice(0, 16).replace("T", " ");
  await insert("mapEdits", { at, actorId: actorId || "-", actorName: actorName || "ระบบ", action, target, before, after });
}
