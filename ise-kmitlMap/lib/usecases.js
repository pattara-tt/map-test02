// สารบัญ Use Case ของ SciMap — ใช้สร้างเมนูของแต่ละ Actor อัตโนมัติ
export const ROLE_LABEL = {
  exec: "บริหาร",
  marketing: "ฝ่ายการตลาด",
  gis: "ผู้ดูแลข้อมูลสถานที่และอาคาร",
  admin: "ฝ่ายดูแลระบบ",
  pr: "ฝ่ายประชาสัมพันธ์",
  registrar: "ฝ่ายทะเบียน",
  user: "ผู้ใช้งานทั่วไป",
};

export const USE_CASES = {
  exec: [
    { code: "", key: "overview", title: "ดูรายงานและสถิติภาพรวมระบบ", icon: "svg:growth_graph" },
    { code: "", key: "feedback", title: "ตรวจสอบข้อเสนอแนะและคำขอจากผู้ใช้งานทั่วไป", icon: "svg:Chat_search_light" },
    { code: "", key: "contracts", title: "ตรวจสอบสัญญาที่ฝ่ายการตลาดทำกับฝ่ายการตลาด", icon: "svg:Folder_search_light" },
    { code: "", key: "audit", title: "ตรวจสอบบันทึกประวัติการแก้ไขข้อมูลแผนที่", icon: "svg:Map_light" },
  ],
  marketing: [
    { code: "", key: "contracts", title: "ติดตามวันหมดอายุสัญญาบริการ", icon: "svg:document" },
    { code: "", key: "broadcast", title: "ส่งข้อความแจ้งเตือนระบบถึงมหาวิทยาลัยในระบบ", icon: "svg:bullhorn" },
    { code: "", key: "access", title: "จัดการสิทธิ์การเข้าถึงระดับสถาบัน", icon: "svg:dataflow" },
  ],
  gis: [
    { code: "", key: "boundary", title: "จัดการขอบเขตแผนผัง", icon: "🗺️" },
    { code: "", key: "assets", title: "จัดการข้อมูลประกอบแผนผัง", icon: "🧩" },
    { code: "", key: "save", title: "บันทึกข้อมูลแผนที่", icon: "💾" },
  ],
  admin: [
    { key: "users", title: "ข้อมูลผู้ใช้งาน", icon: "👥" },
    { key: "requests", title: "คำร้อง", icon: "🔎" },
    { key: "roles", title: "สิทธิ์ผู้ใช้งาน", icon: "🔑" },
    { key: "status", title: "สถานะบัญชีผู้ใช้งาน", icon: "🚦" },
  ],
  pr: [
    { code: "", key: "news", title: "ข้อมูลข่าวสาร", icon: "svg:news" },
    { code: "", key: "events", title: "ข้อมูลกิจกรรม", icon: "svg:bullhorn" },
    { code: "", key: "interest", title: "ตรวจสอบสถิติความสนใจของกิจกรรม", icon: "svg:growth" },
    { code: "", key: "categories", title: "เพิ่ม / แก้ไข / ลบหมวดหมู่กิจกรรมและสถานที่", icon: "svg:folder" },
  ],
  registrar: [
    { code: "", key: "rooms", title: "จัดการรายละเอียดข้อมูลบนแผนที่", icon: "🗺️" },
  ],
  user: [
    { code: "", key: "search", title: "ค้นหาห้องเรียน อาคาร หรือชื่ออาจารย์", icon: "🔍" },
    { code: "", key: "route", title: "ค้นหาวิธีไปยังจุดหมาย", icon: "svg:compass" },
    { code: "", key: "feedback", title: "ส่งข้อเสนอแนะหรือแจ้งปัญหาการใช้ระบบ", icon: "✉️" },
    { code: "", key: "events", title: "เพิ่มกิจกรรมที่สนใจเข้าร่วม", icon: "⭐" },
  ],
};

// UC27/UC28 เป็นของผู้ใช้งานทุกคนในระบบ (อยู่ในหน้า Auth)
export const COMMON_UC = [
  { code: "", title: "ลงทะเบียนเข้าใช้ระบบ" },
  { code: "", title: "เข้าสู่ระบบด้วย E-mail" },
];
