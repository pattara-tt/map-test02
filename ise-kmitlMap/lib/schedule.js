// ตัวช่วยคำนวณสถานะของข่าวสาร/กิจกรรมจากวัน-เวลา (ใช้ร่วมกันทั้งฝั่งจัดการและฝั่งผู้ใช้)

export function nowTs() { return Date.now(); }

function ts(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// ข่าวสาร: ร่าง → รอเผยแพร่ → กำลังเผยแพร่ → หมดอายุ
export function newsState(n, now = nowTs()) {
  if (!n.published) return "draft";
  const start = ts(n.publishAt);
  const end = ts(n.expireAt);
  if (start && now < start) return "scheduled";
  if (end && now > end) return "expired";
  return "live";
}

export const NEWS_STATE_LABEL = {
  draft: "ฉบับร่าง",
  scheduled: "รอเผยแพร่",
  live: "กำลังเผยแพร่",
  expired: "หมดอายุ",
};

// กิจกรรม: ร่าง → กำลังจะเกิดขึ้น → กำลังจัด → สิ้นสุดแล้ว
export function eventState(e, now = nowTs()) {
  if (!e.published) return "draft";
  const start = ts(e.startAt);
  const end = ts(e.endAt);
  if (end && now > end) return "ended";
  if (start && now < start) return "upcoming";
  return "ongoing";
}

export const EVENT_STATE_LABEL = {
  draft: "ฉบับร่าง",
  upcoming: "กำลังจะเกิดขึ้น",
  ongoing: "กำลังจัด",
  ended: "สิ้นสุดแล้ว",
};

// ตรวจความถูกต้องของช่วงวัน-เวลา
export function validateRange(startAt, endAt, { requireStart = true, labelStart = "วันเริ่มต้น", labelEnd = "วันสิ้นสุด" } = {}) {
  if (requireStart && !startAt) return `กรุณาระบุ${labelStart}`;
  const s = ts(startAt), e = ts(endAt);
  if (startAt && s === null) return `รูปแบบ${labelStart}ไม่ถูกต้อง`;
  if (endAt && e === null) return `รูปแบบ${labelEnd}ไม่ถูกต้อง`;
  if (s !== null && e !== null && e < s) return `${labelEnd}ต้องไม่มาก่อน${labelStart}`;
  return null;
}

export function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const date = d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  return String(v).includes("T")
    ? `${date} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
    : date;
}

// ค่า default สำหรับ input type="datetime-local" / "date"
export function localNow(withTime = true) {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}
