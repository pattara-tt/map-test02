// ── CRUD กลางของทุก collection (ย้ายมาจาก backend/src/server.js) ──
import { list, insert, update, remove, logMapEdit } from "../../../../lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

const notFound = () => Response.json({ ok: false, error: "ไม่พบชุดข้อมูล" }, { status: 404 });
const oops = (e) => {
  console.error("[api/data]", e);
  return Response.json({ ok: false, error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
};

export async function GET(_req, { params }) {
  const { name } = await params;
  if (!ALLOWED.has(name)) return notFound();
  try {
    return Response.json({ ok: true, items: await list(name) });
  } catch (e) { return oops(e); }
}

export async function POST(req, { params }) {
  const { name } = await params;
  if (!ALLOWED.has(name)) return notFound();
  try {
    const { _actor, ...item } = (await req.json().catch(() => ({}))) || {};
    const row = await insert(name, item);
    if (MAP_COLLECTIONS[name]) {
      await logMapEdit({
        actorName: _actor?.name, actorId: _actor?.id,
        action: "เพิ่ม" + MAP_COLLECTIONS[name],
        target: row.name || row.label || row.code || row.id,
        after: "สร้างใหม่",
      });
    }
    return Response.json({ ok: true, item: row });
  } catch (e) { return oops(e); }
}

export async function PATCH(req, { params }) {
  const { name } = await params;
  if (!ALLOWED.has(name)) return notFound();
  try {
    const { id, _actor, ...patch } = (await req.json().catch(() => ({}))) || {};
    const row = await update(name, id, patch);
    if (!row) return Response.json({ ok: false, error: "ไม่พบรายการ" }, { status: 404 });
    if (MAP_COLLECTIONS[name]) {
      await logMapEdit({
        actorName: _actor?.name, actorId: _actor?.id,
        action: "แก้ไข" + MAP_COLLECTIONS[name],
        target: row.name || row.label || row.code || row.id,
        after: JSON.stringify(patch).slice(0, 80),
      });
    }
    return Response.json({ ok: true, item: row });
  } catch (e) { return oops(e); }
}

export async function DELETE(req, { params }) {
  const { name } = await params;
  if (!ALLOWED.has(name)) return notFound();
  try {
    const sp = new URL(req.url).searchParams;
    const id = sp.get("id");
    const actor = sp.get("actor") || "";
    const before = (await list(name)).find((r) => r.id === id) || {};
    const ok = await remove(name, id);
    if (ok && MAP_COLLECTIONS[name]) {
      await logMapEdit({
        actorName: actor,
        action: "ลบ" + MAP_COLLECTIONS[name],
        target: before.name || before.label || before.code || id,
        before: "มีอยู่", after: "ถูกลบ",
      });
    }
    return Response.json({ ok });
  } catch (e) { return oops(e); }
}
