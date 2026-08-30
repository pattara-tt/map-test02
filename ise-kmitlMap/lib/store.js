// ────────────────────────────────────────────────────────────────
// Mock in-memory store สำหรับ SciMap
// เก็บไว้บน globalThis เพื่อให้ข้อมูลไม่หายตอน Next.js hot-reload
// TODO(prod): เปลี่ยนไปต่อฐานข้อมูลจริง (Prisma/Postgres) — โครง collection เหมือนเดิม
// ────────────────────────────────────────────────────────────────

export const ROLES = {
  exec: "บริหาร",
  marketing: "ฝ่ายการตลาด",
  gis: "ผู้ดูแลข้อมูลสถานที่และอาคาร",
  admin: "ฝ่ายดูแลระบบ",
  pr: "ฝ่ายประชาสัมพันธ์",
  registrar: "ฝ่ายทะเบียน",
  user: "ผู้ใช้งานทั่วไป",
};

const today = () => new Date().toISOString().slice(0, 10);
const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 8);

function seed() {
  return {
    // ── บัญชีผู้ใช้ (UC10, UC12, UC16, UC27, UC28) ─────────────
    users: [
      { id: "U001", email: "exec@kmitl.ac.th", password: "1234", name: "ผศ.ดร. วราภรณ์ ศรีบุญ", username: "exec", role: "exec", institution: "KMITL", status: "active", createdAt: "2026-01-12" },
      { id: "U002", email: "marketing@kmitl.ac.th", password: "1234", name: "ชนิดา พงษ์ทวี", username: "marketing", role: "marketing", institution: "KMITL", status: "active", createdAt: "2026-01-12" },
      { id: "U003", email: "gis@kmitl.ac.th", password: "1234", name: "ธนกฤต อินทโชติ", username: "gis", role: "gis", institution: "KMITL", status: "active", createdAt: "2026-01-15" },
      { id: "U004", email: "admin@kmitl.ac.th", password: "1234", name: "ปิยะพงษ์ แก้วมณี", username: "admin", role: "admin", institution: "KMITL", status: "active", createdAt: "2026-01-10" },
      { id: "U005", email: "pr@kmitl.ac.th", password: "1234", name: "ณัฐริกา สุขเกษม", username: "pr", role: "pr", institution: "KMITL", status: "active", createdAt: "2026-02-02" },
      { id: "U006", email: "registrar@kmitl.ac.th", password: "1234", name: "อรพรรณ ทองดี", username: "registrar", role: "registrar", institution: "KMITL", status: "active", createdAt: "2026-02-02" },
      { id: "U007", email: "student@kmitl.ac.th", password: "1234", name: "กิตติพัฒน์ ใจงาม", username: "student", role: "user", institution: "KMITL", status: "active", createdAt: "2026-03-01" },
      { id: "U008", email: "somchai@kmitl.ac.th", password: "1234", name: "สมชาย ตั้งมั่น", username: "somchai", role: "user", institution: "KMITL", status: "suspended", createdAt: "2026-03-04" },
    ],

    // ── คำร้องขอแก้ไขข้อมูลสถานที่ (ผู้ใช้ส่งจากหน้าแผนที่) ────
    // before/after เก็บข้อมูลก่อน-หลัง เพื่อให้ฝ่ายดูแลระบบเทียบแล้วกดอนุมัติได้ทันที
    requests: [
      {
        id: "RQ-1001",
        userId: "U007",
        subject: "ขอแก้ไขข้อมูลห้อง 106",
        detail: "ขอเปลี่ยนประเภทห้อง 106 จากห้องเรียนเป็นห้องปฏิบัติการ",
        status: "pending",
        createdAt: "2026-08-24",
        note: "",
        roomId: "RM-01",
        nodeId: "Sc8StudyRoom1F1",

        before: {
          name: "ห้อง 106",
          type: "ห้องเรียน",
          capacity: 45,
          teacher: "อ.ดร. ปรีชา วงศ์ทอง",
        },

        after: {
          name: "ห้อง 106",
          type: "ห้องปฏิบัติการ",
          capacity: 45,
          teacher: "อ.ดร. ปรีชา วงศ์ทอง",
        },
      },

      {
        id: "RQ-1002",
        userId: "U007",
        subject: "แจ้งข้อมูลอาจารย์ประจำห้อง 107 ไม่ถูกต้อง",
        detail: "ชื่ออาจารย์ประจำห้อง 107 ไม่ตรงกับข้อมูลที่แสดงในระบบ",
        status: "pending",
        createdAt: "2026-08-24",
        note: "",
        roomId: "RM-02",
        nodeId: "Sc8StudyRoom2F1",

        before: {
          name: "ห้อง 107",
          type: "ห้องปฏิบัติการ",
          capacity: 40,
          teacher: "อ.ดร. สุนิสา ภูผา",
        },

        after: {
          name: "ห้อง 107",
          type: "ห้องปฏิบัติการ",
          capacity: 40,
          teacher: "อ.ดร. วิชัย ใจดี",
        },
      },

      {
        id: "RQ-1003",
        userId: "U008",
        subject: "แจ้งข้อมูลความจุ Coworking Space KDAI",
        detail: "ขอให้ตรวจสอบจำนวนที่นั่งของ Coworking Space KDAI",
        status: "pending",
        createdAt: "2026-08-24",
        note: "",
        roomId: "RM-03",
        nodeId: "Sc8StudyRoom3F1",

        before: {
          name: "Coworking Space KDAI",
          type: "พื้นที่ทำงานร่วม",
          capacity: 60,
          teacher: "-",
        },

        after: {
          name: "Coworking Space KDAI",
          type: "พื้นที่ทำงานร่วม",
          capacity: 70,
          teacher: "-",
        },
      },
    ],
    requestQuota: { perUserPerDay: 3, perUserPerMonth: 20, updatedAt: today(), updatedBy: "U004" },
    notifications: [],

    // ── ข้อเสนอแนะ/แจ้งปัญหาจากผู้ใช้ (UC2, UC25) ─────────────
    feedback: [
      { id: "FB-2001", userId: "U007", userName: "กิตติพัฒน์ ใจงาม", topic: "การใช้งานแผนที่", detail: "อยากให้ค้นหาด้วยรหัสวิชาได้", status: "new", createdAt: "2026-08-19", reply: "" },
      { id: "FB-2002", userId: "U008", userName: "สมชาย ตั้งมั่น", topic: "ปัญหาการใช้ระบบ", detail: "กดค้นหาห้องน้ำแล้วหมุดไม่ขึ้น", status: "reviewed", createdAt: "2026-08-12", reply: "แก้ไขแล้วในเวอร์ชัน 1.2.3" },
    ],

    // ── บันทึกประวัติการแก้ไขข้อมูลแผนที่ (UC3) ────────────────
    mapEdits: [
      { id: "ML-3001", at: "2026-08-20 14:02", actorId: "U003", actorName: "ธนกฤต อินทโชติ", action: "แก้ไขขอบเขตแผนผัง", target: "ขอบเขตอาคารพระจอมเกล้าฯ (Sc8)", before: "polygon v2", after: "polygon v3" },
      { id: "ML-3002", at: "2026-08-19 09:41", actorId: "U006", actorName: "อรพรรณ ทองดี", action: "แก้ไขข้อมูลห้อง", target: "ห้อง 107 ชั้น 1", before: "ห้องเรียนรวม", after: "ห้องปฏิบัติการ" },
      { id: "ML-3003", at: "2026-08-17 16:20", actorId: "U005", actorName: "ณัฐริกา สุขเกษม", action: "เพิ่มตำแหน่งกิจกรรม", target: "ISE Open House 2026", before: "-", after: "ลานหน้าอาคาร Sc8" },
    ],

    // ── สัญญาบริการรายสถาบัน (UC4, UC6) ───────────────────────
    contracts: [
      { id: "CT-01", institution: "สจล. (KMITL)", plan: "Campus Pro", startDate: "2025-09-01", endDate: "2026-08-31", status: "active", contact: "ict@kmitl.ac.th" },
      { id: "CT-02", institution: "มหาวิทยาลัย A", plan: "Campus Basic", startDate: "2025-06-01", endDate: "2026-09-15", status: "active", contact: "it@univ-a.ac.th" },
      { id: "CT-03", institution: "มหาวิทยาลัย B", plan: "Campus Pro", startDate: "2024-10-01", endDate: "2026-08-26", status: "active", contact: "admin@univ-b.ac.th" },
      { id: "CT-04", institution: "มหาวิทยาลัย C", plan: "Trial", startDate: "2026-05-01", endDate: "2026-07-31", status: "expired", contact: "office@univ-c.ac.th" },
    ],
    institutionAccess: [
      { id: "IA-01", institution: "สจล. (KMITL)", level: "full", modules: ["map", "events", "rooms", "reports"], seats: 5000, updatedAt: "2026-07-01" },
      { id: "IA-02", institution: "มหาวิทยาลัย A", level: "standard", modules: ["map", "events"], seats: 2000, updatedAt: "2026-06-11" },
      { id: "IA-03", institution: "มหาวิทยาลัย B", level: "full", modules: ["map", "events", "rooms"], seats: 3500, updatedAt: "2026-05-20" },
      { id: "IA-04", institution: "มหาวิทยาลัย C", level: "readonly", modules: ["map"], seats: 300, updatedAt: "2026-05-01" },
    ],
    broadcasts: [
      { id: "BC-01", title: "แจ้งปิดปรับปรุงระบบ", body: "ระบบจะปิดปรับปรุง 30 ส.ค. 2026 เวลา 01:00–03:00 น.", audience: "ทุกมหาวิทยาลัย", sentAt: "2026-08-15 10:00", sentBy: "ชนิดา พงษ์ทวี" },
    ],

    // ── ข้อมูลแผนผัง (UC7, UC8, UC9) ──────────────────────────
    mapBoundaries: [
      { id: "MB-01", name: "ขอบเขตวิทยาเขตลาดกระบัง", type: "campus", points: 42, updatedAt: "2026-08-01", status: "published" },
      { id: "MB-02", name: "ขอบเขตอาคารพระจอมเกล้าฯ (Sc8)", type: "building", points: 8, updatedAt: "2026-08-20", status: "published" },
    ],
    mapAssets: [
      { id: "MA-01", name: "ผังชั้น 1 อาคาร Sc8", kind: "floorplan", file: "/data/floorplans/Sc8/floor1.svg",status:"published", building:'Sc8',floor:'1',updatedAt: "2026-08-06" },
      { id: "MA-02", name: "ผังชั้น 2 อาคาร Sc8", kind: "floorplan", file: "/data/floorplans/Sc8/floor2.svg", status:"published",building:'Sc8',floor:'2',updatedAt: "2026-08-06" },
      { id: "MA-03", name: "ภาพอาคาร Sc8", kind: "image", file: "/data/places/sc8.png",status:"published", building:'Sc8',floor:null, updatedAt: "2026-07-28" },
    ],
    mapDrafts: [
      { id: "MD-01", name: "ปรับพิกัดทางเข้าอาคาร Sc8", note: "ย้ายจุดทางเข้าฝั่งเหนือ 3 เมตร", savedAt: "2026-08-22 11:15", savedBy: "ธนกฤต อินทโชติ", status: "draft" },
    ],

    // ── หมวดหมู่ ข่าวสาร และกิจกรรม (ฝ่ายประชาสัมพันธ์) ─────────
    categories: [
      { id: "CAT-01", name: "วิชาการ", kind: "event", color: "#1A73E8", desc: "สัมมนา บรรยาย อบรม" },
      { id: "CAT-02", name: "กีฬา/นันทนาการ", kind: "event", color: "#188038", desc: "กิจกรรมกีฬาและสันทนาการ" },
      { id: "CAT-03", name: "อาคารเรียน", kind: "place", color: "#E37400", desc: "อาคารสำหรับการเรียนการสอน" },
      { id: "CAT-04", name: "โรงอาหาร", kind: "place", color: "#D93025", desc: "จุดจำหน่ายอาหารและเครื่องดื่ม" },
      { id: "CAT-05", name: "ลานกิจกรรม", kind: "place", color: "#8430CE", desc: "พื้นที่โล่งสำหรับจัดกิจกรรม" },
    ],

    // ข่าวสาร — published = เผยแพร่แล้วหรือยัง, ใช้ร่วมกับ publishAt/expireAt คำนวณสถานะจริง
    news: [
      { id: "NW-01", title: "ประกาศตารางสอบกลางภาค 1/2569", body: "นักศึกษาสามารถตรวจสอบตารางสอบกลางภาคได้ที่ระบบทะเบียน ตั้งแต่วันที่ประกาศเป็นต้นไป", publishAt: "2026-08-20", expireAt: "2026-09-30", published: true, author: "ณัฐริกา สุขเกษม", createdAt: "2026-08-18" },
      { id: "NW-02", title: "เปิดรับสมัครทุนการศึกษา ประจำปี 2569", body: "เปิดรับสมัครทุนการศึกษาสำหรับนักศึกษาชั้นปีที่ 2 ขึ้นไป ยื่นเอกสารได้ที่งานกิจการนักศึกษา", publishAt: "2026-09-01", expireAt: "2026-10-15", published: true, author: "ณัฐริกา สุขเกษม", createdAt: "2026-08-22" },
      { id: "NW-03", title: "แจ้งปิดปรับปรุงลิฟต์อาคาร Sc8", body: "ลิฟต์ฝั่งทิศเหนือปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก", publishAt: "2026-07-01", expireAt: "2026-07-31", published: true, author: "ณัฐริกา สุขเกษม", createdAt: "2026-06-28" },
      { id: "NW-04", title: "ร่าง: กำหนดการปฐมนิเทศนักศึกษาใหม่", body: "อยู่ระหว่างรอยืนยันกำหนดการจากคณะ", publishAt: "", expireAt: "", published: false, author: "ณัฐริกา สุขเกษม", createdAt: "2026-08-23" },
    ],

    // กิจกรรม — มีพิกัดสถานที่จัดงาน และหมวดหมู่สถานที่ชั่วคราวระหว่างจัดงาน
    events: [
      {
        id: "EV-01", name: "ISE Open House 2026",
        detail: "เปิดบ้านคณะวิศวกรรมศาสตร์นานาชาติ พบกิจกรรมและ workshop ตลอดวัน",
        categoryId: "CAT-01", startAt: "2026-09-05T09:00", endAt: "2026-09-05T16:00",
        placeName: "ลานหน้าอาคารพระจอมเกล้าฯ (Sc8)", lat: 13.729721, lon: 100.780099,
        tempPlaceCategoryId: "CAT-05", published: true, author: "ณัฐริกา สุขเกษม", createdAt: "2026-08-10",
      },
      {
        id: "EV-02", name: "กีฬาสีภาควิชา",
        detail: "แข่งขันกีฬาสีประจำปี ณ สนามกีฬากลาง",
        categoryId: "CAT-02", startAt: "2026-09-18T08:00", endAt: "2026-09-19T17:00",
        placeName: "สนามกีฬากลาง สจล.", lat: 13.7275, lon: 100.7772,
        tempPlaceCategoryId: "", published: true, author: "ณัฐริกา สุขเกษม", createdAt: "2026-08-12",
      },
      {
        id: "EV-03", name: "อบรมการใช้งาน SciMap",
        detail: "อบรมการใช้งานระบบแผนที่สำหรับเจ้าหน้าที่ภาควิชา",
        categoryId: "CAT-01", startAt: "2026-08-01T13:00", endAt: "2026-08-01T16:00",
        placeName: "Coworking Space KDAI", lat: 13.729, lon: 100.7799,
        tempPlaceCategoryId: "", published: true, author: "ณัฐริกา สุขเกษม", createdAt: "2026-07-20",
      },
    ],

    eventInterest: [
      { id: "EI-01", eventId: "EV-01", userId: "U007", createdAt: "2026-08-20" },
    ],
    eventStats: [
      { eventId: "EV-01", interested: 176, searched: 402 },
      { eventId: "EV-02", interested: 41, searched: 88 },
      { eventId: "EV-03", interested: 33, searched: 51 },
    ],

    // ── ข้อมูลอาคาร/ชั้น/ห้อง (UC21, UC22) ────────────────────
    floors: [
      { id: "FL-01", building: "Sc8", floor: "1", name: "ชั้น 1", svg: "/data/floorplans/Sc8/floor1.svg", note: "โถงต้อนรับ / Coworking", status: "active" },
      { id: "FL-02", building: "Sc8", floor: "2", name: "ชั้น 2", svg: "/data/floorplans/Sc8/floor2.svg", note: "ห้องเรียนรวม", status: "active" },
    ],
    rooms: [
      { id: "RM-01", building: "Sc8", floor: "1", code: "106", name: "ห้อง 106", type: "ห้องเรียน", capacity: 45, teacher: "อ.ดร. ปรีชา วงศ์ทอง", nodeId: "Sc8StudyRoom1F1", categoryId: "CAT-03" },
      { id: "RM-02", building: "Sc8", floor: "1", code: "107", name: "ห้อง 107", type: "ห้องปฏิบัติการ", capacity: 40, teacher: "อ.ดร. สุนิสา ภูผา", nodeId: "Sc8StudyRoom2F1", categoryId: "CAT-03" },
      { id: "RM-03", building: "Sc8", floor: "1", code: "KDAI", name: "Coworking Space KDAI", type: "พื้นที่ทำงานร่วม", capacity: 60, teacher: "-", nodeId: "Sc8StudyRoom3F1", categoryId: "CAT-03" },
    ],

    // ── สถิติภาพรวมระบบ (UC1) ─────────────────────────────────
    usage: [
      { month: "2026-03", activeUsers: 1820, searches: 9120, routes: 4310 },
      { month: "2026-04", activeUsers: 2110, searches: 10480, routes: 5020 },
      { month: "2026-05", activeUsers: 2450, searches: 12240, routes: 6110 },
      { month: "2026-06", activeUsers: 1980, searches: 8830, routes: 3990 },
      { month: "2026-07", activeUsers: 2680, searches: 13910, routes: 6840 },
      { month: "2026-08", activeUsers: 3120, searches: 16240, routes: 7930 },
    ],
  };
}

const g = globalThis;
if (!g.__KMITL_MAP_DB__) g.__KMITL_MAP_DB__ = seed();
export const db = g.__KMITL_MAP_DB__;

// ────────────────────────────────────────────────────────────────
// เลือก backend อัตโนมัติ
//   - มี DATABASE_URL หรือ INSTANCE_UNIX_SOCKET → ใช้ PostgreSQL (Cloud SQL) ผ่าน lib/pg.js
//   - ไม่มี → ใช้ mock in-memory ตามเดิม (ไม่ต้องตั้งค่าอะไรก็รันได้)
// ทุกฟังก์ชันเป็น async เพื่อให้ API route ใช้โค้ดชุดเดียวกันได้ทั้งสองแบบ
// ────────────────────────────────────────────────────────────────
export const USE_PG = !!(process.env.DATABASE_URL || process.env.INSTANCE_UNIX_SOCKET);
async function pg() {
  const mod = await import("./pg.js");
  return mod;
}

export async function list(name) {
  if (USE_PG) return (await pg()).list(name);
  return db[name] || [];
}

export async function insert(name, item) {
  if (USE_PG) return (await pg()).insert(name, item);
  if (!Array.isArray(db[name])) db[name] = [];
  const row = { id: item.id || uid(name.slice(0, 2).toUpperCase()), createdAt: item.createdAt || today(), ...item };
  db[name].unshift(row);
  return row;
}

export function getRequestQuota(userId) {
  const quota = db.requestQuota;
  const requests = db.requests || [];

  const todayStr = today();
  const monthStr = todayStr.slice(0, 7);

  const dailyCount = requests.filter(
    (r) =>
      r.userId === userId &&
      r.createdAt === todayStr &&
      r.status !== "cancelled"
  ).length;

  const monthlyCount = requests.filter(
    (r) =>
      r.userId === userId &&
      r.createdAt?.startsWith(monthStr) &&
      r.status !== "cancelled"
  ).length;

  return {
    dailyCount,
    monthlyCount,
    dailyLimit: quota.perUserPerDay,
    monthlyLimit: quota.perUserPerMonth,
    canSubmit:
      dailyCount < quota.perUserPerDay &&
      monthlyCount < quota.perUserPerMonth,
  };
}

export async function update(name, id, patch) {
  if (USE_PG) return (await pg()).update(name, id, patch);
  const arr = db[name] || [];
  const i = arr.findIndex((r) => r.id === id);
  if (i < 0) return null;
  arr[i] = { ...arr[i], ...patch };
  return arr[i];
}

export async function remove(name, id) {
  if (USE_PG) return (await pg()).remove(name, id);
  const arr = db[name] || [];
  const i = arr.findIndex((r) => r.id === id);
  if (i < 0) return false;
  arr.splice(i, 1);
  return true;
}

// บันทึก log ทุกครั้งที่มีการแก้ไขข้อมูลแผนที่ (ให้ผู้บริหารตรวจสอบได้)
export async function logMapEdit({ actorName, actorId, action, target, before = "-", after = "-" }) {
  if (USE_PG) return (await pg()).logMapEdit({ actorName, actorId, action, target, before, after });
  const at = new Date().toISOString().slice(0, 16).replace("T", " ");
  db.mapEdits.unshift({ id: uid("ML"), at, actorId: actorId || "-", actorName: actorName || "ระบบ", action, target, before, after });
}

export { uid, today };

// ล้างคิวคำร้องคนที่ถูกระงับ
export function cancelPendingRequestsByUser(userId, { actorName = "ระบบ" } = {}) {
  const arr = db.requests || [];
  const cancelled = [];
  for (const r of arr) {
    if (r.userId === userId && r.status === "pending") {
      r.status = "cancelled";
      r.note = "ยกเลิก: บัญชีผู้ยื่นถูกระงับ";
      cancelled.push(r.id);
    }
  }
  return cancelled;
}

export function notifyUser(userId, title, message) {
  return insert("notifications", { userId, title, message, read: false });
}