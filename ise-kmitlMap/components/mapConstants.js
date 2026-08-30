// mapConstants.js — เดินกรุงเทพ (walkwe)
// พื้นที่หลัก: อาคาร Sc8 เขตลาดกระบัง
// ตัดระบบกลางวัน/กลางคืน ความร่ม และความสว่างออก
// เหลือระบบแผนที่ การนำทางนอกอาคาร และการนำทางภายในอาคาร

// ============================================================
// 🗺️ ศูนย์กลางแผนที่ + กรอบพื้นที่หลัก
// ============================================================

export const WALKWAY_NODE_TYPES = ["walkway", "path", "corridor", "junction", "node", "hallway", "way"];
export const CENTER = [13.7292, 100.7789];
export const ZOOM = 15;

// [south, west, north, east]
export const DEMO_BBOX = [
  13.715,
  100.771,
  13.742,
  100.786,
];

// ============================================================
// 🧭 ประเภท Node สำหรับปักบนผังอาคาร
// ============================================================

// ⚠️ NODE_TYPES คือ "แหล่งความจริงเดียว" (single source of truth) ของการแม็ป
// type -> ไอคอน/สี/ป้ายกำกับ ของทุก node บนแผนที่/ผังอาคาร
//
// id ของแต่ละรายการต้อง "สะกดตรงตัว" กับค่า type ที่ใช้จริงใน
// SC8_FLOOR1_NODES ด้านล่าง (case-sensitive) — ก่อนหน้านี้ตารางนี้เคยเขียน
// id ผิด (เช่น "toilet"/"stairs" ตัวเล็กล้วน) ทำให้จุดห้องน้ำ/บันได/ห้อง
// ต่าง ๆ หาไม่เจอใน NODE_TYPES แล้ว fallback ไปใช้ไอคอนของ "path" หมด
// จึงมีการไปสร้างตาราง CHIP_NODE_TYPES/NODE_ICON แยกไว้อีกหลายชุดในหลายไฟล์
// เพื่อชดเชยปัญหานี้ — ตอนนี้แก้ที่ต้นตอแล้ว ให้ทุกไฟล์ import NODE_TYPES
// (หรือ getNodeType()) จากที่นี่ที่เดียว ไม่ต้องมีตาราง type->ไอคอนซ้ำอีก
//
// field "chip" (ไม่บังคับ) ใช้จัดกลุ่มสำหรับปุ่ม filter แบบ chip บน MapView/
// Buildingfloorpicker (room/toilet/lift/stairs) — CHIP_NODE_TYPES ด้านล่าง
// ถูกสร้างจาก field นี้อัตโนมัติ ไม่ต้องคัดลอกรายชื่อ id เองอีกต่อไป
export const NODE_TYPES = [
  {
    id: "path",
    label: "ทางเดิน",
    icon: "•",
    color: "#B3AFB8",
  },
  {
    id: "Stair",
    label: "บันได",
    icon: "🪜",
    color: "#5F6368",
    chip: "stairs",
  },
  {
    id: "escalator",
    label: "บันไดเลื่อน",
    icon: "⬆",
    color: "#8E24AA",
  },
  {
    id: "lift",
    label: "ลิฟต์",
    icon: "🛗",
    color: "#8E24AA",
    chip: "lift",
  },
  {
    id: "Toilet",
    label: "ห้องน้ำ",
    icon: "🚻",
    color: "#1A73E8",
    chip: "toilet",
  },
  {
    id: "atm",
    label: "ATM",
    icon: "🏧",
    color: "#D93025",
  },
  {
    id: "Entrance",
    label: "ทางเข้า-ออก",
    icon: "🚪",
    color: "#188038",
  },
  {
    id: "Fire_Exit",
    label: "ทางหนีไฟ",
    icon: "🚪",
    color: "#D93025",
  },
  {
    id: "Co_Work",
    label: "Co-working Space",
    icon: "💻",
    color: "#8E24AA",
    chip: "room",
  },
  {
    id: "Study_Room",
    label: "ห้องเรียน/ห้องศึกษา",
    icon: "📚",
    color: "#1A73E8",
    chip: "room",
  },
];

// หา entry ของ NODE_TYPES จาก type string — fallback ไปที่ NODE_TYPES[0] ("path")
// ถ้าไม่พบ (เช่น type สะกดผิด หรือเป็นชนิดใหม่ที่ยังไม่ได้เพิ่มไว้ในตารางนี้)
export function getNodeType(type) {
  return NODE_TYPES.find((t) => t.id === type) || NODE_TYPES[0];
}

// สร้างจาก field "chip" ของ NODE_TYPES โดยอัตโนมัติ:
// { room: ["Study_Room","Co_Work"], toilet: ["Toilet"], lift: ["lift"], stairs: ["Stair"] }
// ไม่ต้องพิมพ์รายชื่อ id ซ้ำมือในแต่ละไฟล์ที่ใช้ปุ่ม filter อีกต่อไป
export const CHIP_NODE_TYPES = NODE_TYPES.reduce((acc, t) => {
  if (!t.chip) return acc;
  if (!acc[t.chip]) acc[t.chip] = [];
  acc[t.chip].push(t.id);
  return acc;
}, {});

// ============================================================
// 🏢 Sc8 — อาคาร 8 ชั้น
// จุดกึ่งกลางอาคาร: 13.729721, 100.780099
//
// หมายเหตุ:
// SC8_BOUNDS เป็นกรอบเริ่มต้นโดยประมาณ
// สามารถใช้ระบบปรับตำแหน่ง SVG ใน MapView เพื่อเลื่อนและปรับขนาด
// ให้ตรงกับตำแหน่งอาคารจริงได้
// ============================================================

export const SC8_CENTER = [
  13.729721,
  100.780099,
];

// กรอบตำแหน่ง SVG
// รูปแบบ:
// [
//   [south, west],
//   [north, east],
// ]

export const SC8_BOUNDS = [
  [13.728306, 100.779664],
  [13.729686, 100.780328],
];

// พื้นที่ Outline สำหรับกดเลือกอาคารบนแผนที่
// ⚠️ อัปเดต: เดิมเป็นแค่สี่เหลี่ยมตาม SC8_BOUNDS ตรงๆ (bounding box) ทำให้ครอบคลุมพื้นที่
// เกิน/ขาดจากรูปทรงตึกจริง (มีปีกตึกที่เว้าเข้าไปทางฝั่งตะวันตก)
//
// ตอนนี้ปรับเป็นรูปหลายเหลี่ยม (polygon) ที่ประมาณรูปทรงจริงของตึกตามที่ทาบเส้นไว้บนแผนที่
// (มีรอยเว้า 2 จุดทางฝั่งตะวันตกของตัวตึก) — ค่านี้ยังเป็นการ "ประมาณ" จากสัดส่วนภายใน SC8_BOUNDS
// ไม่ใช่พิกัดที่วัดจริงจากพื้นที่ ถ้าต้องการให้แม่นยำ 100% ควรใช้โหมด "🔧 ปรับตำแหน่ง/คาลิเบรต"
// ใน MapView เพื่อลากปรับจุดแต่ละมุมให้ตรงกับตึกจริง แล้วนำพิกัดที่ได้มาแทนค่าด้านล่างนี้
export const SC8_OUTLINE = [
  [13.729617, 100.779691], // มุมบนซ้าย (เยื้องเข้ามาจากขอบ bounds เล็กน้อย)
  [13.729617, 100.780308], // มุมบนขวา
  [13.728375, 100.780315], // มุมล่างขวา
  [13.728375, 100.780029], // ขอบล่าง เดินเข้ามาก่อนถึงมุมซ้ายสุด
  [13.728858, 100.780029], // เว้าขึ้น (รอยหยักที่ 1 — บริเวณกลางตึก)
  [13.728858, 100.779797], // เว้าซ้าย
  [13.729272, 100.779797], // เว้าขึ้น (รอยหยักที่ 2 — ปีกตึกฝั่งบนซ้าย)
  [13.729272, 100.779691], // เว้าซ้ายสุด กลับไปทางขอบตะวันตก
];

// ============================================================
// 🏬 รายการชั้นของอาคาร Sc8
// ============================================================
//
// ขณะนี้มี SVG เฉพาะชั้น 1
// ชั้นอื่นกำหนด svg: null ไว้ก่อน
//
// เมื่อมีไฟล์ SVG ของชั้นอื่น สามารถแก้เป็น:
//
// {
//   id: "2",
//   label: "2",
//   svg: "/data/floorplans/Sc8/floor2.svg",
//   detail: "รายละเอียดของชั้นนี้ (ไม่บังคับ)",
// }
//
// field "detail" ใช้เก็บคำอธิบายเพิ่มเติมของชั้น (ไม่บังคับใส่ ปล่อย null ได้ถ้ายังไม่มี)
// จะแสดงต่อจากป้าย "Sc8" บนแผนที่ (MapView) และในทูลทิปปุ่มเลือกชั้น (MapPicker) เมื่อมีข้อมูล
//
// ============================================================

export const SC8_FLOORS = [
  {
    id: "8",
    label: "8",
    svg: null, // ⚠️ ยังไม่มีไฟล์ floor8.svg ใน public/data/floorplans/Sc8/ — ใส่กลับเมื่อได้ไฟล์มา
    detail: null,
    bounds: [
      [13.728375, 100.779664], // SE (South, West)
      [13.729658, 100.780322]  // NW (North, East)
    ],
  },
  {
    id: "7",
    label: "7",
    svg: null,
    detail: null,
    bounds: [
      [13.728375, 100.779664], // SE (South, West)
      [13.729658, 100.780322]  // NW (North, East)
    ],
  },
  {
    id: "6",
    label: "6",
    svg: "/data/floorplans/Sc8/floor6.svg",
    detail: null,
    bounds: [
      [13.728375, 100.779664], // SE (South, West)
      [13.729658, 100.780322]  // NW (North, East)
    ],
  },
  {
    id: "5",
    label: "5",
    svg: "/data/floorplans/Sc8/floor5.svg",
    detail: null,
    bounds: [
      [13.728375, 100.779664], // SE (South, West)
      [13.729658, 100.780322]  // NW (North, East)
    ],
  },
  {
    id: "4",
    label: "4",
    svg: "/data/floorplans/Sc8/floor4.svg",
    detail: null,
    bounds: [
      [13.728375, 100.779664], // SE (South, West)
      [13.729658, 100.780322]  // NW (North, East)
    ],
  },
  {
    id: "3",
    label: "3",
    svg: "/data/floorplans/Sc8/floor3.svg",
    detail: null,
    bounds: [
      [13.728375, 100.779664], // SE (South, West)
      [13.729658, 100.780322]  // NW (North, East)
    ],
  },
  {
    id: "2",
    label: "2",
    svg: "/data/floorplans/Sc8/floor2.svg",
    detail: null,
    bounds: [
      [13.728306, 100.779664],
      [13.729686, 100.780328],
    ],
  },
  {
    id: "1",
    label: "1",
    svg: "/data/floorplans/Sc8/floor1.svg",
    detail: null,
    bounds: [
      [13.728306, 100.779664],
      [13.729686, 100.780328],
    ],
  },
];

// ============================================================
// 🔵 Node และ Edge ของ Sc8 ชั้น 1
// ============================================================
//
// ตอนนี้ยังเป็นข้อมูลว่าง
//
// ตัวอย่าง Node:
//
// export const SC8_FLOOR1_NODES = {
//   Sc8F1P1: {
//     lat: 13.729700,
//     lon: 100.780050,
//     type: "path",
//     label: "",
//   },
//
//   Sc8F1Lift1: {
//     lat: 13.729730,
//     lon: 100.780100,
//     type: "lift",
//     label: "ลิฟต์",
//   },
// };
//
// ตัวอย่าง Edge:
//
// export const SC8_FLOOR1_EDGES = [
//   ["Sc8F1P1", "Sc8F1Lift1"],
// ];
//#1 [ทางเดิน]: 13.7290372, 100.7799219


// ============================================================

export const SC8_FLOOR1_NODES = {
  Sc8Lift1F1: { lat:13.7291256 , lon:100.7802095 , type: "lift", label: "ลิฟต์ ชั้น1" },
  Sc8Toilet1F1: { lat:13.7291665, lon:100.7800143, type: "Toilet", label: "ห้องน้ำชั้น 1" },
  Sc8FireExit1F1: { lat:13.7288873, lon:100.7799855, type: "Fire_Exit", label: "ทางหนึไฟชั้น 1" },
  Sc8Entrance1F1: { lat:13.7290372, lon:100.7799219, type: "Entrance", label: "ทางเข้าอาคารพระจอมชั้น 1" },
  Sc8Stair1F1: { lat:13.7291831, lon:100.7801042, type: "Stair", label: "ทางหนึไฟข้างลิฟต์ชั้น 1"},
  Sc8Stair2F1: { lat:13.7290097, lon:100.7801518, type: "Stair", label: "บันไดกลางโถงชั้น 1"},
  Sc8CoWork1F1: { lat:13.7288521, lon:100.7800338, type: "Co_Work", label: "coworking space KDAI"},
  Sc8StudyRoom1F1: { lat:13.7291126, lon:100.7802591, type: "Study_Room", label: "ห้อง 108 ตึกพระจอมฯ"},
  Sc8StudyRoom2F1: { lat:13.7289785, lon:100.7802711, type: "Study_Room", label: "ห้อง 107 ตึกพระจอมฯ"},
  Sc8StudyRoom3F1: { lat:13.7288756, lon:100.7802738, type: "Study_Room", label: "ห้อง 106 ตึกพระจอมฯ"},
  Sc8PC1: { lat:13.7290345 , lon:100.7800217 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC2: { lat:13.7290358 , lon:100.7800928 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC3: { lat:13.7290358 , lon:100.7801504 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC4: { lat:13.7290866 , lon:100.7800230 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC5: { lat:13.7290879 , lon:100.7800968 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC6: { lat:13.7290853 , lon:100.7801518 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC7: { lat:13.7291296 , lon:100.7801518 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC8: { lat:13.7291556 , lon:100.7801303 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC9: { lat:13.7291544 , lon:100.7800131 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC9_5: { lat:13.7291570 , lon:100.7800801 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC10: { lat:13.7291818 , lon:100.7800788 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC11: { lat:13.7290853 , lon:100.7802229 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC12: { lat:13.7290345 , lon:100.7802242 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC13: { lat:13.7289798 , lon:100.7802255 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC14: { lat:13.7289212 , lon:100.7802282 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC15: { lat:13.7288769 , lon:100.7802269 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC16: { lat:13.7288769 , lon:100.7800847 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC17: { lat:13.7289811 , lon:100.7800888 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC18: { lat:13.7289303 , lon:100.7800834 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC19: { lat:13.7289016 , lon:100.7800552 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC20: { lat:13.7288899 , lon:100.7800123 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8PC21: { lat:13.7288730 , lon:100.7800364 , type: "path", label: "ทางเดินอาคารพระจอมชั้น 1" },
  Sc8StudyRoom1CenterF1: { lat:13.7291617 , lon:100.7802781 , type: "path", label: "ห้อง 108 ตึกพระจอมฯ" },
  Sc8StudyRoom2CenterF1: { lat:13.7289767 , lon:100.7802956 , type: "path", label: "ห้อง 107 ตึกพระจอมฯ" },
  Sc8StudyRoom3CenterF1: { lat:13.7288620 , lon:100.7803023 , type: "path", label: "ห้อง 106 ตึกพระจอมฯ" },
  Sc8CoWork1F1Center: { lat:13.7288373 , lon:100.7800917, type: "path", label: "coworking space KDAI" },

};

export const SC8_FLOOR1_EDGES = [
  ["Sc8Entrance1F1", "Sc8PC1"],
  ["Sc8PC1", "Sc8PC2"],
  ["Sc8PC1", "Sc8PC4"],
  ["Sc8PC4", "Sc8PC5"],
  ["Sc8PC6", "Sc8PC5"],
  ["Sc8PC2", "Sc8PC3"],
  ["Sc8PC1", "Sc8PC17"],
  ["Sc8PC2", "Sc8PC5"],
  ["Sc8PC11", "Sc8PC12"],
  ["Sc8PC3", "Sc8PC6"],
  ["Sc8Entrance1F1", "Sc8PC4"],
  ["Sc8PC6", "Sc8PC7"],
  ["Sc8PC7", "Sc8PC8"],
  ["Sc8PC8", "Sc8PC9"],
  ["Sc8PC9_5", "Sc8PC9"],
  ["Sc8PC9", "Sc8Toilet1F1"],
  ["Sc8PC9_5", "Sc8PC10"],
  ["Sc8PC10", "Sc8Stair1F1"],
  ["Sc8PC3", "Sc8Stair2F1"],
  ["Sc8PC6", "Sc8Lift1F1"],
  ["Sc8PC6", "Sc8PC11"],
  ["Sc8PC11", "Sc8StudyRoom1F1"],
  ["Sc8PC3", "Sc8PC12"],
  ["Sc8PC12", "Sc8PC13"],
  ["Sc8PC13", "Sc8StudyRoom2F1"],
  ["Sc8PC13", "Sc8PC14"],
  ["Sc8PC14", "Sc8PC15"],
  ["Sc8PC15", "Sc8StudyRoom3F1"],
  ["Sc8PC15", "Sc8PC16"],
  ["Sc8PC16", "Sc8PC21"],
  ["Sc8PC21", "Sc8CoWork1F1"],
  ["Sc8PC21", "Sc8PC20"],
  ["Sc8PC20", "Sc8FireExit1F1"],
  ["Sc8PC2", "Sc8PC17"],
  ["Sc8PC17", "Sc8PC18"],
  ["Sc8PC18", "Sc8PC19"],
  ["Sc8PC19", "Sc8PC20"],
  ["Sc8PC19", "Sc8PC21"],
  ["Sc8PC19", "Sc8PC16"],
];
export const SC8_FLOOR2_NODES = {
  
};

export const SC8_FLOOR2_EDGES = [];

// ============================================================
// 🔗 เส้นเชื่อมระหว่างชั้น
// ============================================================
//
// ตัวอย่าง:
//
// [
//   "Sc8F1Lift1",
//   "Sc8F2Lift1",
// ]


export const SC8_INTER_FLOOR_EDGES = [

];

// ============================================================
// 🚪 จุดเชื่อมภายในอาคารกับภายนอกอาคาร
// ============================================================
//
// ตัวอย่าง:
//
// {
//   indoor: "Sc8F1Entrance1",
//   outdoor: "Sc8Outside1",
// }
//
// ============================================================

export const SC8_EXTERIOR_LINKS = [
  { node: "Sc8Entrance1F1", lat: 13.7290371, lon: 100.7799681, type: "Entrance", label: "ทางเข้า Sc8" },
];

// 🌳 Node ภายนอกอาคาร

export const SC8_EXTERIOR_NODES = Object.fromEntries(
  SC8_EXTERIOR_LINKS.map((e, i) => [`Sc8Ext${i}`, { lat: e.lat, lon: e.lon, label: e.label || "ทางเข้า-ออก" }])
);

// ============================================================
// 🛣️ Edge ภายนอกอาคาร
// ============================================================

export const SC8_EXTERIOR_EDGES = SC8_EXTERIOR_LINKS.map((e, i) => [e.node, `Sc8Ext${i}`]);
// ============================================================
// 🧩 รวม Node ของ Sc8
// ============================================================

export const SC8_ALL_NODES = {
  ...SC8_FLOOR1_NODES,
  ...SC8_EXTERIOR_NODES,
};

// ============================================================
// 🧩 รวม Edge ของ Sc8

export const SC8_ALL_EDGES = [
  ...SC8_FLOOR1_EDGES,
  ...SC8_INTER_FLOOR_EDGES,
  ...SC8_EXTERIOR_EDGES,
];

// ============================================================
// 🏷️ ระบุว่าแต่ละ Node อยู่ชั้นไหน
// ============================================================

export const SC8_NODE_FLOOR = {};

for (const id in SC8_FLOOR1_NODES) {
  SC8_NODE_FLOOR[id] = "1";
}

// ============================================================
// 🔄 Alias ชื่อ KMITL เดิม
// ============================================================
//
// MapView เดิมยังเรียกชื่อ KMITL_BOUNDS, KMITL_FLOORS และชื่ออื่น ๆ
// จึงสร้าง Alias ให้ชี้ไปที่ Sc8
//
// วิธีนี้ช่วยให้ไม่ต้องแก้ Routing ทั้งไฟล์ MapView
// ============================================================

export const KMITL_BOUNDS = SC8_BOUNDS;

export const KMITL_OUTLINE = SC8_OUTLINE;

export const KMITL_FLOORS = SC8_FLOORS;

export const KMITL_FLOOR1_NODES =
  SC8_FLOOR1_NODES;

export const KMITL_FLOOR1_EDGES =
  SC8_FLOOR1_EDGES;

export const KMITL_INTER_FLOOR_EDGES =
  SC8_INTER_FLOOR_EDGES;

export const KMITL_EXTERIOR_LINKS =
  SC8_EXTERIOR_LINKS;

export const KMITL_EXTERIOR_NODES =
  SC8_EXTERIOR_NODES;

export const KMITL_EXTERIOR_EDGES =
  SC8_EXTERIOR_EDGES;

export const KMITL_ALL_NODES =
  SC8_ALL_NODES;

export const KMITL_ALL_EDGES =
  SC8_ALL_EDGES;

export const KMITL_NODE_FLOOR =
  SC8_NODE_FLOOR;

// ============================================================
// 🏢 กราฟอาคารทั้งหมด
// ============================================================

export const BUILDING_GRAPHS = [
  {
    name: "kmitl",
    nodes: SC8_ALL_NODES,
    edges: SC8_ALL_EDGES,
    exteriorLinks: SC8_EXTERIOR_LINKS,
  },
];

// ============================================================
// 🏙️ รายชื่ออาคารทั้งหมด
// ============================================================
//
// key ยังใช้ชื่อ kmitl เพื่อรองรับ MapView เดิม
// แต่ชื่อที่แสดงผลจะเป็น Sc8
//
// ============================================================

export const BUILDINGS = {
  kmitl: {
    name: "Sc8",
    bounds: SC8_BOUNDS,
    outline: SC8_OUTLINE,
    floors: SC8_FLOORS,
  },
};

// อาคารที่ห้ามเปิดหรือยังไม่พร้อมใช้งาน
export const LOCKED_BUILDINGS = new Set([]);

// Prefix ของกลุ่ม Node
export const NODE_GROUP_PREFIXES = [];

// ============================================================
// 🧭 Route Graph แยกตามอาคารและชั้น
// ============================================================

export const ROUTE_GRAPHS = {
  "kmitl:1": {
    nodes: SC8_FLOOR1_NODES,
    edges: SC8_FLOOR1_EDGES,
  },
};

// ============================================================
// 🌐 Overpass API
// ============================================================

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// ============================================================
// 🗂️ ประเภทข้อมูลบนแผนที่
// ============================================================

export const CAT = {
  sidewalk: {
    color: "#e63946",
    label: "ทางเท้า",
  },

  road: {
    color: "#f4a261",
    label: "ถนน",
  },

  flood: {
    color: "#1d6fb8",
    label: "น้ำท่วม",
  },

  obstruct: {
    color: "#9d4edd",
    label: "กีดขวาง",
  },

  cctv_broken: {
    color: "#ff5da2",
    label: "กล้องเสีย (ร้องเรียน)",
  },
};

export const catColor = (category) => {
  return CAT[category]?.color || "#888";
};

// ============================================================
// 🧭 แปลงคำสั่งนำทาง ORS เป็นภาษาไทย
// ============================================================

export const MAN = {
  0: "เลี้ยวซ้าย",
  1: "เลี้ยวขวา",
  2: "เลี้ยวซ้ายหักศอก",
  3: "เลี้ยวขวาหักศอก",
  4: "เบี่ยงซ้าย",
  5: "เบี่ยงขวา",
  6: "ตรงไป",
  7: "เข้าวงเวียน",
  8: "ออกวงเวียน",
  9: "กลับรถ",
  10: "ถึงปลายทาง",
  11: "เริ่มเดิน",
  12: "ชิดซ้าย",
  13: "ชิดขวา",
};

export const thaiInstr = (step) => {
  const instruction =
    MAN[step.type] || "ไปต่อ";

  const roadName =
    step.name
      ? ` เข้า ${step.name}`
      : "";

  return instruction + roadName;
};

// ============================================================
// 🇬🇧 คำสั่งนำทางภาษาอังกฤษ
// ============================================================

export const TURN_EN = {
  เลี้ยวซ้าย: "turn left",
  เลี้ยวขวา: "turn right",
  เบี่ยงซ้าย: "keep left",
  เบี่ยงขวา: "keep right",
  เลี้ยวซ้ายหักศอก: "sharp left turn",
  เลี้ยวขวาหักศอก: "sharp right turn",
  ตรงไป: "go straight",
  กลับตัว: "make a U-turn",
};

// ============================================================
// 🛣️ ชื่อถนนภาษาอังกฤษ
// ============================================================

export const ROAD_EN = {
  // ตัวอย่าง:
  // "ฉลองกรุง": "Chalong Krung Road",
};

export function roadEN(thaiRoadName) {
  if (!thaiRoadName) {
    return "";
  }

  if (ROAD_EN[thaiRoadName]) {
    return ROAD_EN[thaiRoadName];
  }

  const matchedKey =
    Object.keys(ROAD_EN).find((key) =>
      thaiRoadName.includes(key)
    );

  return matchedKey
    ? ROAD_EN[matchedKey]
    : "";
}