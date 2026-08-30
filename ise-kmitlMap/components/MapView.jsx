"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PlaceInput from "./PlaceInput";
import { Btn, Field, Input, Textarea, useCollection } from "./ui";
import { speak, speakNow, unlockSpeech, loadVoices, hasThaiVoice } from "./speech";
import { drawGoogleLikeBaseMap } from "./mapBaseLayer";
import {
  CENTER,
  ZOOM,
  DEMO_BBOX,
  KMITL_BOUNDS,
  KMITL_OUTLINE,
  KMITL_FLOORS as KMITL_FLOORS_STATIC,
  NODE_TYPES,
  CHIP_NODE_TYPES,
  WALKWAY_NODE_TYPES,
  getNodeType,
  KMITL_FLOOR1_NODES,
  KMITL_FLOOR1_EDGES,
  KMITL_ALL_NODES,
  KMITL_NODE_FLOOR,
  KMITL_EXTERIOR_LINKS,
  CAT,
  MAN,
  ROAD_EN,
  catColor,
  thaiInstr,
  roadEN,
  OVERPASS_MIRRORS,
  BUILDINGS,
} from "./mapConstants";
import {
  loadLeaflet,
  haversine,
  bearing,
  turnTH,
  walkFrom,
  turnAt,
  turnSide,
  sampleLine,
  ratioNear,
  countNear,
  pointToSegM,
  nearPolyline,
  nearestOnRoute,
  buildingIndex,
  inBuilding,
  fetchOSM,
  scoreRoutes,
  popupHtml,
  fetchWalkNet,
  buildGraph,
  mergeIndoorGraph,
  routeSegments,
  SEGMENT_COLORS,
  graphRoute,
  pickRoutes,
  resolveLandmark,
  resolvePlace,
  geocodeNominatim,
  pointAtDistance,
  queuedGeocode,
  reverseGeocode,
  queuedReverse,
  suggestPlaces,
  LANDMARKS,
} from "./mapGeo";


const SC8_SEARCH_NODES = [
  {
    id: "Sc8Toilet1F1",
    // ⚠️ เดิมชี้ไป "Sc8Toilet1CenterF1" ซึ่งไม่มี node นี้อยู่จริงใน mapConstants.js เลย ทำให้ผลค้นหาห้องน้ำถูกกรองทิ้งทุกครั้ง (markerNode = undefined)
    // ยังไม่มีข้อมูลจุดกลางห้องน้ำจริง เลยไม่ใส่ markerId ไปก่อน (fallback เป็น id เดียวกับ route = หน้าประตู จนกว่าจะมีพิกัดจริง)
    name: "ห้องน้ำ ชั้น 1 ตึกพระจอมเกล้าฯ",

    aliases: [
      "ห้องน้ำ",
      "ห้องน้ำชั้น1",
      "ห้องน้ำ sc8",
      "toilet sc8",
    ],

    extract:
      "ห้องน้ำ ชั้น 1 ภายในตึกพระจอมเกล้าฯ (Sc8)",
    icon: "🚻",
  },
  {
    id: "Sc8Lift1F1",
    name: "ลิฟต์ ชั้น 1 ตึกพระจอมเกล้าฯ",
    aliases: ["ลิฟต์", "ลิฟต์ชั้น1", "ลิฟต์ sc8", "lift sc8"],
    extract: "ลิฟต์ ชั้น 1 ภายในตึกพระจอมเกล้าฯ (Sc8)",
    icon: "🛗",
  },
  {
    id: "Sc8StudyRoom1F1",
    markerId: "Sc8StudyRoom1CenterF1", // 📍 หมุดแสดงกลางห้อง — เส้นทางยังคำนวณไปหน้าประตู (id ด้านบน) เหมือนเดิม
    name: "ห้อง 108 ตึกพระจอมฯ",
    aliases: ["ห้อง108", "108", "ห้อง 108", "study room 108"],
    extract: "ห้อง 108 ชั้น 1 ตึกพระจอมเกล้าฯ (Sc8)",
    icon: "🚪",
  },
  {
    id: "Sc8StudyRoom2F1",
    markerId: "Sc8StudyRoom2CenterF1",
    name: "ห้อง 107 ตึกพระจอมฯ", // ⚠️ แก้แล้ว: node นี้ label จริงใน mapConstants.js คือห้อง 107 (เดิมพิมพ์ผิดเป็น 106 ไปชนกับ Sc8StudyRoom3F1)
    aliases: ["ห้อง107", "107", "ห้อง 107", "study room 107"],
    extract: "ห้อง 107 ชั้น 1 ตึกพระจอมเกล้าฯ (Sc8)",
    icon: "🚪",
  },
  {
    id: "Sc8StudyRoom3F1",
    markerId: "Sc8StudyRoom3CenterF1", // ⚠️ เพิ่มกลับเข้ามา: entry นี้หายไปจากไฟล์ ทำให้ค้นหา "ห้อง 106" ไม่เจอเลย
    name: "ห้อง 106 ตึกพระจอมฯ",
    aliases: ["ห้อง106", "106", "ห้อง 106", "study room 106"],
    extract: "ห้อง 106 ชั้น 1 ตึกพระจอมเกล้าฯ (Sc8)",
    icon: "🚪",
  },
  {
    id: "Sc8CoWork1F1",
    markerId: "Sc8CoWork1F1Center", // ⚠️ เพิ่ม markerId ที่ขาดไป — ไม่งั้นหมุดจะไปใช้พิกัดหน้าประตู (id เดียวกับ route) แทนจุดกลางห้องจริง
    name: "Coworking Space KDAI",
    aliases: ["coworking", "coworking space", "kdai", "co working", "โคเวิร์กกิ้ง"],
    extract: "Coworking Space KDAI ชั้น 1 ตึกพระจอมเกล้าฯ (Sc8)",
    icon: "💻", // ⚠️ แก้ไอคอนจาก 🚪 เป็น 💻 ให้สื่อความหมายตรงกับ coworking space
  },
];

const normalizeSearch = (text) =>
  String(text || "").trim().toLowerCase().replace(/\s+/g, "");

// กิจกรรมที่ยังไม่สิ้นสุด ถึงจะขึ้นบนแผนที่
const isEventVisible = (e) => {
  if (!e?.endAt) return true;
  const end = new Date(e.endAt).getTime();
  return Number.isNaN(end) || end >= Date.now();
};

const fmtEventTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
};

// ไอคอนในหมุดกิจกรรม — เรนเดอร์เป็นสีขาวผ่าน CSS mask ให้ตัดกับพื้นหมุด
const EVENT_PIN_ICON = "/data/icon/ui/bullhorn.svg";

// ไอคอนเข็มทิศจากไฟล์ SVG — ย้อมสีตามบริบทที่ใช้
function CompassIcon({ size = 16, color = "currentColor", style }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block", verticalAlign: "-2px", width: size, height: size, backgroundColor: color,
        WebkitMask: `url("/data/icon/ui/compass.svg") center/contain no-repeat`,
        mask: `url("/data/icon/ui/compass.svg") center/contain no-repeat`,
        ...style,
      }}
    />
  );
}

function SearchPlaceInput({ value, onChange, onPick, placeholder, rooms = [] }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  
  const buildNodeItems = (text) => {
    const q = normalizeSearch(text);

    if (q.length < 1) return [];

    const roomByNodeId = new Map(
      rooms.map((room) => [room.nodeId, room])
    );

    return SC8_SEARCH_NODES.flatMap((entry) => {
      const room = roomByNodeId.get(entry.id);
      const displayName = room?.name || entry.name;
      // node ที่ใช้คำนวณเส้นทาง เช่น จุดหน้าประตู
      const routeNode = KMITL_ALL_NODES[entry.id];

      // node ที่ใช้แสดงหมุด เช่น จุดกลางห้อง
      const markerNode =
        KMITL_ALL_NODES[entry.markerId || entry.id];

      if (
        !routeNode ||
        !markerNode ||
        !Number.isFinite(routeNode.lat) ||
        !Number.isFinite(routeNode.lon) ||
        !Number.isFinite(markerNode.lat) ||
        !Number.isFinite(markerNode.lon)
      ) {
        return [];
      }

      const words = [
        displayName,
        entry.name,
        entry.id,
        routeNode.label,
        markerNode.label,
        ...(entry.aliases || []),
      ].filter(Boolean);

      const matched = words.some((word) => {
        const normalizedWord = normalizeSearch(word);

        return (
          normalizedWord.includes(q) ||
          q.includes(normalizedWord)
        );
      });

      if (!matched) return [];

      return [
        {
          name: displayName,

          // ใช้พิกัดกลางห้องสำหรับแสดงหมุด
          coord: [
            markerNode.lon,
            markerNode.lat,
          ],

          src: "indoor-node",

          // node ประตูสำหรับนำทาง
          nodeId: entry.id,
          routeNodeId: entry.id,

          // node กลางห้องสำหรับแสดงผล
          markerNodeId: entry.markerId || entry.id,

          floor:
            KMITL_NODE_FLOOR[entry.id] || "1",

          extract: entry.extract,
          icon: entry.icon,
        },
      ];
    });
  };

  const handleChange = (next) => {
    onChange(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    const local = buildNodeItems(next);
    setItems(local);
    setOpen(Boolean(next.trim()) && local.length > 0);
    if (next.trim().length < 2) return;
    timerRef.current = setTimeout(async () => {
      try {
        const remote = await suggestPlaces(next);
        const merged = [...local];
        for (const item of remote || []) {
          if (!merged.some((x) => x.name === item.name)) merged.push(item);
        }
        setItems(merged.slice(0, 8));
        setOpen(merged.length > 0);
      } catch (e) {}
    }, 250);
  };

  const choose = (item) => {
    onChange(item.name);
    setOpen(false);
    onPick(item);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && items[0]) {
            e.preventDefault();
            choose(items[0]);
          }
        }}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid #DADCE0", background: "#fff", color: "#202124", fontSize: 16, outline: "none" }}
      />
      {open ? (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 2600, background: "#fff", borderRadius: 12, boxShadow: "0 4px 18px rgba(60,64,67,.28)", overflow: "hidden" }}>
          {items.map((item, index) => (
            <button
              type="button"
              key={`${item.src || "place"}-${item.nodeId || item.name}-${index}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
              style={{ width: "100%", border: 0, borderBottom: index === items.length - 1 ? 0 : "1px solid #ECEFF1", background: "#fff", padding: "11px 13px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={{ fontSize: 18 }}>{item.icon || "📍"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", color: "#202124", fontWeight: 700, fontSize: 14 }}>{item.name}</span>
                <span style={{ display: "block", color: "#5F6368", fontSize: 11.5, marginTop: 2 }}>{item.src === "event" ? `กิจกรรม · ${item.subtitle || ""}` : item.nodeId ? `ชั้น ${item.floor} · ${item.nodeId}` : item.src === "osm" ? "OSM" : "สถานที่"}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function MapView({ apiRef, viewMode = "auto", user = null }) {
  // 🎪 กิจกรรมจากฝ่ายประชาสัมพันธ์ — แสดงเป็นหมุดบนแผนที่ ค้นหาได้ และกดสนใจได้จากการ์ด
  const [events, setEvents] = useState([]);
  const [interests, setInterests] = useState([]);
  const [eventCard, setEventCard] = useState(null);
  // 🚩 แจ้งปัญหา/ขอแก้ไขข้อมูลสถานที่ — ส่งเป็นคำร้องให้ฝ่ายดูแลระบบพิจารณา
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState(null);
  const [reportSending, setReportSending] = useState(false);
  const { items: rooms } = useCollection("rooms");
  const { items: requests, create: createRequest } = useCollection("requests");
  const { items: quotaItems } = useCollection("requestQuota");
  const requestQuota = quotaItems[0] || {};
  // viewMode ถูกควบคุมจากปุ่มสลับ "มือถือ/คอม" ที่แถบบนของแอป (app/page.jsx)
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const ctx = useRef({ L: null, routeLayer: null, problems: [], osmPromise: null, select: () => {}, scored: null, voiceOn: true, voiceLang: "th", crossings: [], placeCache: {} });
  const [toilets, setToilets] = useState(null);
  const [cams, setCams] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [active, setActive] = useState(null);
  const [nav, setNav] = useState(null);
  const [voice, setVoice] = useState(true);
  const [voiceLang, setVoiceLang] = useState("th");

  const [sFrom, setSFrom] = useState("");
  const [sTo, setSTo] = useState("");
  // chips คุมเลเยอร์แผนที่ (ตัด Street light/lamp ออกแล้ว — เหลือแค่ทางเชื่อม/ห้องน้ำ)
  const [chips, setChips] = useState({ room: true, toilet: true, lift: true, stairs: true });
  const [mapZoom, setMapZoom] = useState(ZOOM);
  const [mapReady, setMapReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [routeFormOpen, setRouteFormOpen] = useState(false);
  const [placeCard, setPlaceCard] = useState(null); // { name, coord, extract, image, loading, error } — การ์ดรายละเอียดสถานที่หลังค้นหา
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);


  // 🗂️ ผังชั้นที่แอดมิน (GIS Panel → UC8) อัปโหลด+กด "เผยแพร่" ไว้ — โหลดจาก /api/data/mapAssets
  // เอามาสมทบกับรายชื่อชั้นตั้งต้นใน mapConstants.js (KMITL_FLOORS): ถ้ามีไฟล์ที่เผยแพร่แล้วตรงกับชั้นนั้น ใช้ไฟล์นั้นแทน
  const { items: mapAssetItems } = useCollection("mapAssets");
  const effectiveFloors = useMemo(() => {
    return KMITL_FLOORS_STATIC.map((f) => {
      const published = mapAssetItems.find(
        (a) => a.kind === "floorplan" && a.status === "published" && (a.building || "Sc8") === "Sc8" && String(a.floor) === String(f.id)
      );
      return published ? { ...f, svg: published.file } : f;
    });
  }, [mapAssetItems]);


  const reloadEvents = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/data/events").then((r) => r.json()),
        fetch("/api/data/eventInterest").then((r) => r.json()),
      ]);
      setEvents((a.items || []).filter((e) => e.published && isEventVisible(e)));
      setInterests(b.items || []);
    } catch (e) {}
  }, []);
  useEffect(() => { reloadEvents(); }, [reloadEvents]);

  const myInterest = (eventId) => interests.find((i) => i.eventId === eventId && i.userId === user?.id);

  async function toggleInterest(ev) {
    if (!user?.id) return alert("กรุณาเข้าสู่ระบบก่อนกดสนใจกิจกรรม");
    const mine = myInterest(ev.id);
    if (mine) {
      await fetch(`/api/data/eventInterest?id=${encodeURIComponent(mine.id)}`, { method: "DELETE" });
    } else {
      await fetch("/api/data/eventInterest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id, userId: user.id }),
      });
    }
    await reloadEvents();
  }
  // 🔧 สลับโหมดแล้วต้องสั่ง Leaflet คำนวณขนาด container ใหม่เอง — ไม่งั้นแผนที่ค้างขนาดเดิม (เห็นแค่ UI overlay ขยับนิดเดียว แผนที่ไม่เต็มจอ)
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const t1 = setTimeout(() => m.invalidateSize(), 50);   // เรียกซ้ำหลายจังหวะ กัน transition/reflow ของ CSS ยังไม่จบตอนเรียกครั้งแรก
    const t2 = setTimeout(() => m.invalidateSize(), 250);
    const t3 = setTimeout(() => m.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [viewMode]);

  // 🏢 ตึก Sc8 — ตึกเดียว (ตัดของเก่า SD/BACC/CEN/LD/BTS/SW ทั้งหมดออกแล้ว)
  const [kmitlOpen, setKmitlOpen] = useState(false);
  const kmitlOpenRef = useRef(kmitlOpen);
  useEffect(() => { kmitlOpenRef.current = kmitlOpen; }, [kmitlOpen]);
  // เครื่องมือผู้พัฒนา (คาลิเบรตผัง / ปักหมุด / ทดสอบเส้นทางในตึก) ถูกถอดออกจากหน้าผู้ใช้ทั่วไป
  // คงตัวแปรไว้เป็นค่าคงที่เพื่อให้ effect ที่อ้างถึงยังทำงานได้ตามปกติ (ปิดอยู่เสมอ)
  const kmitlCalibrate = false;
  const kmitlNodeMode = false;
  const kmitlNodes = [];
  const kmitlRouteResult = null;
  const setKmitlCalReadout = () => {};
  const setKmitlNodes = () => {};
  const setKmitlRouteResult = () => {};
  const [kmitlFloor, setKmitlFloor] = useState("1");
  const kmitlFloorRef = useRef(kmitlFloor);
  useEffect(() => { kmitlFloorRef.current = kmitlFloor; ctx.current.drawFloorOverlay?.(); }, [kmitlFloor]);

  // 📋 ดึง "รายละเอียดชั้น" ที่ฝ่ายทะเบียนกรอกไว้ (collection "floors") มาผสานกับข้อมูลชั้นแบบ static (svg, id, label)
  // — ใช้ id ชั้น + ชื่ออาคาร (BUILDINGS.kmitl.name = "Sc8") จับคู่ ถ้าไม่มีข้อมูลในระบบ จะ fallback เป็นค่า detail เดิมใน mapConstants (ปกติเป็น null)
  const { items: floorRecords } = useCollection("floors");
  const KMITL_FLOORS = useMemo(
    () =>
      KMITL_FLOORS_STATIC.map((f) => {
        const rec = floorRecords.find((r) => r.building === BUILDINGS.kmitl.name && String(r.floor) === String(f.id));
        return rec?.note ? { ...f, detail: rec.note } : f;
      }),
    [floorRecords]
  );

  // 🧭 กราฟ node/edge ของชั้นที่กำลังดูอยู่ — เพิ่มชั้นใหม่ในอนาคตแค่ต่อ ternary นี้
  const kmitlFloorNodes = kmitlFloor === "1" ? KMITL_FLOOR1_NODES : {};
  const kmitlFloorEdges = kmitlFloor === "1" ? KMITL_FLOOR1_EDGES : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await loadLeaflet();
      if (cancelled || mapRef.current) return;
      ctx.current.L = L;
      loadVoices();
      try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { loadVoices(); if (!hasThaiVoice()) { ctx.current.voiceLang = "en"; setVoiceLang("en"); } }; } catch (e) {}
      setTimeout(() => { if (!hasThaiVoice()) { ctx.current.voiceLang = "en"; setVoiceLang("en"); } }, 800);
      const map = L.map(mapEl.current, { zoomControl: false }).setView(CENTER, ZOOM);
      mapRef.current = map;
      setMapZoom(map.getZoom());
      setMapReady(true);
      // 🏢 เลนแยกสำหรับผัง SVG ตึก — z-index ต่ำกว่า overlayPane เริ่มต้น (400) ที่เส้นทางเดินใช้อยู่
      map.createPane("bdiFloorPane");
      map.getPane("bdiFloorPane").style.zIndex = 350;
      // แผนที่พื้นขาวแบบ Google Maps: ถนนไล่เทา, น้ำสีฟ้า, อาคารสีเหลืองอ่อน และมีเส้นขอบบาง
      drawGoogleLikeBaseMap(L, map, DEMO_BBOX).then((layers) => {
        if (layers) ctx.current.googleLikeBase = layers;
      }).catch(() => {});
      // 📍 ระบุตำแหน่งผู้ใช้ทันทีตอนเปิดแอป
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !mapRef.current) return;
            const lon = pos.coords.longitude, lat = pos.coords.latitude;
            ctx.current.myLocation = [lon, lat];
            if (!ctx.current.myLocMarker) {
              ctx.current.myLocMarker = L.marker([lat, lon], {
                icon: L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 1px 8px rgba(26,115,232,.65)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
                zIndexOffset: 900,
              }).bindPopup("ตำแหน่งของฉัน").addTo(mapRef.current);
            } else {
              ctx.current.myLocMarker.setLatLng([lat, lon]);
            }
            if (!ctx.current.routeKey) mapRef.current.setView([lat, lon], Math.max(mapRef.current.getZoom(), 16), { animate: true });
          },
          () => { /* ผู้ใช้ไม่อนุญาต/หา GPS ไม่เจอ — เงียบไว้ ใช้ศูนย์กลางย่าน demo ต่อไปตามเดิม */ },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }
      // เลเยอร์คุมผ่าน "chips" (ทางเชื่อม/skywalk, ห้องน้ำ) — ตัด Street light chip/lamp system ออกแล้ว
      const toiletsLayer = L.layerGroup();
      const crossLayer = L.layerGroup();
      const routeLayer = L.layerGroup().addTo(map);

      // 🏢 เปิดผังตึกได้ทีละอันเดียว (ตอนนี้มีแค่ KMITL — ฟังก์ชันนี้เตรียมไว้รองรับเพิ่มตึกใหม่ในอนาคต)
      ctx.current.openOnly = (which) => {
        setKmitlOpen(which === "kmitl");
      };
      // 🏢 แสดงปุ่มเลือกชั้นอัตโนมัติ เมื่อ SVG/อาคารอยู่บริเวณกึ่งกลางหน้าจอ
      ctx.current.updateCenteredBuilding = () => {
        if (!map || ctx.current.navActive || ctx.current.kmitlCalibrateActive) return;
        if (map.getZoom() < 16) { ctx.current.openOnly(null); return; }
        const center = map.getCenter();
        const lat = center.lat, lng = center.lng;

        const currentFloorObj = KMITL_FLOORS.find(f => f.id === (kmitlFloorRef.current || "1")) || KMITL_FLOORS[0];
        const activeBounds = currentFloorObj.bounds || KMITL_BOUNDS;
        const kmitlBoundsL = L.latLngBounds(activeBounds).pad(0.12);

        if (pipTH(lat, lng, KMITL_OUTLINE) || kmitlBoundsL.contains(center)) return ctx.current.openOnly("kmitl");
        ctx.current.openOnly(null);
      };
      // point-in-polygon แบบเดียวกับที่ mapGeo ใช้ (pip อยู่ใน mapGeo แต่ export เป็น (x,y,ring) ไม่ใช่ (lat,lng,ring) — ห่อไว้ให้ตรงลำดับ)
      function pipTH(lat, lng, ring) {
        let c = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
          if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) c = !c;
        }
        return c;
      }
      map.on("moveend zoomend", ctx.current.updateCenteredBuilding);
      setTimeout(() => ctx.current.updateCenteredBuilding?.(), 0);

      // 📍 แตะที่แผนที่เพื่อปักหมุด แล้วเลือกว่าจะตั้งเป็นต้นทาง/ปลายทาง (แบบแอปแผนที่ทั่วไป)
      map.on("click", (e) => {
        if (ctx.current.navActive || ctx.current.kmitlCalibrateActive) return;
        const { lat, lng } = e.latlng;
        // 📍 โหมดปักหมุด node บนผังตึก — แตะแล้วปักหมุดพร้อมประเภทที่เลือกไว้
        if (ctx.current.kmitlNodeModeActive) { ctx.current.kmitlAddNode?.(lat, lng); return; }

        if (ctx.current.pinMarker) map.removeLayer(ctx.current.pinMarker);
        // 🏢📍 แตะขณะเปิดผังตึกอยู่ + แตะโดนตัวตึกจริง → สแนปไปที่ node ในชั้นที่กำลังเปิดดูอยู่
        let snapLat = lat, snapLng = lng;
        // 🔗 เฉพาะ node ที่มี edge เชื่อมอยู่จริง (กันสแนปไปโดน node กลางห้อง/จุดลอยที่ไม่ได้ต่อกราฟ เดินนำทางไปไม่ได้)
        const connectedNodeIds = new Set(KMITL_FLOOR1_EDGES.flatMap(([a, b]) => [a, b]));
        const nearestInFloor = (nodesObj, maxM = 80) => {
          let bestId = null, bestD = maxM;
          for (const id in nodesObj) {
            if (!connectedNodeIds.has(id)) continue; // ข้าม node ที่ไม่มี edge เชื่อมเลย
            const n = nodesObj[id];
            const d = haversine([lng, lat], [n.lon, n.lat]);
            if (d < bestD) { bestD = d; bestId = id; }
          }
          return bestId ? { id: bestId, ...nodesObj[bestId] } : null;
        };
        let snapNode = null; // 🏢 node จริงที่สแนปติด (ถ้ามี) — ใช้ตั้งชื่อป้ายจาก label ของ node เองแทนการ reverse-geocode
        if (kmitlOpenRef.current && pipTH(lat, lng, KMITL_OUTLINE)) {
          const floorNodes = Object.fromEntries(Object.keys(KMITL_ALL_NODES).filter((id) => KMITL_NODE_FLOOR[id] === kmitlFloorRef.current).map((id) => [id, KMITL_ALL_NODES[id]]));
          const near = nearestInFloor(floorNodes);
          if (near) { snapLat = near.lat; snapLng = near.lon; snapNode = near; }
        }
        ctx.current.pinMarker = L.marker([snapLat, snapLng], {
          icon: L.divIcon({ className: "", html: '<div style="width:14px;height:14px;background:#D93025;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 14] }),
        }).addTo(map);
        const box = document.createElement("div");
        box.style.cssText = "display:flex;flex-direction:column;gap:6px;min-width:160px";
        const mk = (txt, bg) => { const b = document.createElement("button"); b.textContent = txt; b.style.cssText = `padding:8px 10px;border:none;border-radius:8px;background:${bg};color:#fff;font-weight:700;cursor:pointer;font-size:13px`; return b; };
        const btnFrom = mk("⦿ ตั้งเป็นต้นทาง", "#1A73E8");
        const btnTo = mk("📍 ตั้งเป็นปลายทาง", "#188038");
        box.appendChild(btnFrom); box.appendChild(btnTo);
        const setPin = (setter) => async () => {
          map.closePopup();
          let label;
          if (snapNode) {
            // 🏢 สแนปติด node ในตึก — ใช้ label ของ node เอง (ไม่ reverse-geocode กันได้ชื่อซ้ำกันทั้งต้นทาง/ปลายทาง)
            const t = getNodeType(snapNode.type);
            label = snapNode.label || `${t ? t.label : snapNode.type} · ${snapNode.id}`;
          } else {
            label = `หมุด ${snapLat.toFixed(5)},${snapLng.toFixed(5)}`;
            try { const g = await queuedReverse([snapLng, snapLat]); if (g && (g.place || g.road)) label = g.place || g.road; } catch (err) {}
          }
          ctx.current.placeCache[label] = { coord: [snapLng, snapLat], name: label };
          setter(label);
          // 📍 ปักหมุดเลือกต้นทาง/ปลายทางแล้ว → ข้ามหน้าค้นหาสถานที่ ไปแถบสองช่อง (ต้นทาง/ปลายทาง) ตรงๆ เลย
          setSearchOpen(true);
          setRouteFormOpen(true);
        };
        btnFrom.onclick = setPin(setSFrom);
        btnTo.onclick = setPin(setSTo);
        L.popup({ closeButton: true, offset: [0, -8] }).setLatLng([snapLat, snapLng]).setContent(box).openOn(map);
      });

      // 🏢 พื้นที่ตึก Sc8 — กดบริเวณ SVG ของอาคารเพื่อเปิดผังและปุ่มเลือกชั้น
      ctx.current.kmitlFlash = () => {
        const hit = ctx.current.kmitlRect;
        if (hit) {
          hit.setStyle({ fill: true, fillColor: "#ffffff", fillOpacity: 0.72 });
          setTimeout(() => hit.setStyle({ fill: false, fillOpacity: 0 }), 220);
        }
        setTimeout(() => { ctx.current.openOnly("kmitl"); }, 230);
      };
      const kmitlRect = L.polygon(KMITL_OUTLINE, { stroke: false, fill: false, interactive: true })
        .on("click", (e) => { L.DomEvent.stopPropagation(e); ctx.current.kmitlFlash(); })
        .addTo(map);
      kmitlRect.getElement()?.style && (kmitlRect.getElement().style.cursor = "pointer");
      ctx.current.kmitlRect = kmitlRect;

      map.on("zoomend moveend", () => {
        const z = map.getZoom();
        setMapZoom(z);
        if (z < 15) ctx.current.openOnly(null);
      });
      ctx.current.routeLayer = routeLayer;
      ctx.current.layers = { toilets: toiletsLayer, cross: crossLayer };
      const crossIcon = L.divIcon({ className: "", html: '<div class="bdi-cross-ic"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
      ctx.current.crossSeen = new Set();
      ctx.current.addCrossMarkers = (pts) => {
        for (const p of (pts || [])) {
          const k = p[0].toFixed(5) + "," + p[1].toFixed(5);
          if (ctx.current.crossSeen.has(k)) continue;
          ctx.current.crossSeen.add(k);
          L.marker([p[1], p[0]], { icon: crossIcon }).bindPopup("ทางข้าม/ทางม้าลาย (OSM)").addTo(crossLayer);
        }
      };
      // Skywalk / ทางเชื่อมมีหลังคา (จาก OSM coveredWays) → เส้นเขียวบน chip ทางเชื่อม
      ctx.current.skySeen = new Set();
      ctx.current.addSkywalks = (ways) => {
        for (const line of (ways || [])) {
          if (!line || line.length < 2) continue;
          const k = line[0][0].toFixed(5) + "," + line[0][1].toFixed(5) + "|" + line.length;
          if (ctx.current.skySeen.has(k)) continue;
          ctx.current.skySeen.add(k);
          L.polyline(line.map(([lon, lat]) => [lat, lon]), { color: "#4285F4", weight: 4, opacity: 0.75, dashArray: "8 7", lineCap: "round" }).bindPopup("Skywalk / ทางเดินมีหลังคา (OSM)").addTo(crossLayer);
        }
      };

      // 🟩 พื้นที่สีเขียว (park/สนามหญ้า/ป่า/สนามกีฬา) ย้ายไปวาดรวมอยู่ใน drawGoogleLikeBaseMap (mapBaseLayer.js) แล้ว — ตัด query ซ้ำตรงนี้ออก กันวาดซ้อนกัน 2 ชั้น

      // แผนผังตึกโชว์เฉพาะตอนซูมใกล้พอ (≥16)
      ctx.current.updateIndoor = () => {
        const m = mapRef.current; if (!m || !ctx.current.indoorLayer) return;
        if (ctx.current.indoorOn && m.getZoom() >= 16) ctx.current.indoorLayer.addTo(m);
        else m.removeLayer(ctx.current.indoorLayer);
      };
      map.on("zoomend", () => ctx.current.updateIndoor?.());

      const toiletIcon = L.divIcon({ className: "", html: '<div style="font-size:12px;line-height:18px;background:#2a9d8f;color:white;border-radius:50%;width:18px;height:18px;text-align:center;font-weight:700">W</div>', iconSize: [18, 18], iconAnchor: [9, 9] });
      ctx.current.toiletSeen = new Set(); ctx.current.camSeen = new Set();
      ctx.current.problems = [];
      // 🏢🌳 สร้างกราฟทางเท้ากลางแจ้งแล้ว merge กราฟในตึก (ทางเดิน/บันได/ลิฟต์/จุดเชื่อมออกนอกตึก) เข้าไปด้วยเสมอ
      ctx.current.setWalkNet = (ways) => { ctx.current.walkNet = mergeIndoorGraph(buildGraph(ways, ctx.current.bldgs, ctx.current.skywalkWays)); };
      ctx.current.osmToilets = []; ctx.current.osmCameras = [];
      ctx.current.addOsmMarkers = (osm) => {
        if (!osm) return;
        for (const t of (osm.toilets || [])) { const [lon, lat] = t.pt; const k = lon.toFixed(5) + "," + lat.toFixed(5); if (ctx.current.toiletSeen.has(k)) continue; ctx.current.toiletSeen.add(k); ctx.current.osmToilets.push(t); const name = t.tags?.name || t.tags?.["name:th"] || "ห้องน้ำสาธารณะ"; L.marker([lat, lon], { icon: toiletIcon }).bindPopup(`<b>ห้องน้ำ: ${name}</b>`).addTo(toiletsLayer); }
        setToilets(ctx.current.toiletSeen.size); setCams(ctx.current.camSeen.size);
      };

      // ความสูงตึกจริง (ใช้กันเส้นทางลัดทะลุตึก — ไม่เกี่ยวกับร่ม/เงาอีกต่อไป)
      (async () => {
        try {
          const r = await fetch("/data/walkbkk_heights_2023.geojson");
          if (!r.ok) return;
          const gj = await r.json();
          const bl = [];
          for (const f of gj.features || []) {
            const g = f.geometry; if (!g) continue;
            const h = (f.properties && (f.properties.height || f.properties.height_mean)) || 12;
            const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.type === "MultiPolygon" ? g.coordinates.map((cc) => cc[0]) : [];
            for (const ring of rings) if (ring && ring.length >= 4) bl.push({ ring, h });
          }
          ctx.current.bldgs = bl;
          if (ctx.current.walkNetWays) { ctx.current.setWalkNet(ctx.current.walkNetWays); ctx.current.refresh?.(ctx.current.lastOsm || null, false); }
        } catch (e) {}
      })();

      // โหลดโครงข่ายทางเท้า OSM มาสร้างกราฟสำหรับ routing (cache ใน localStorage)
      fetchWalkNet(DEMO_BBOX).then((d) => {
        if (cancelled || !d) return;
        ctx.current.walkNetWays = d.ways;
        ctx.current.setWalkNet(d.ways);
        ctx.current.refresh?.(ctx.current.lastOsm || null, false);
      }).catch(() => {});
      ctx.current.osmPromise = fetchOSM(DEMO_BBOX).then((osm) => {
        if (cancelled) return osm;
        ctx.current.addOsmMarkers(osm); ctx.current.crossings = osm.crossings || [];
        ctx.current.addCrossMarkers?.(osm.crossings);
        ctx.current.addSkywalks?.(osm.coveredWays);
        if (osm.coveredWays && osm.coveredWays.length) {
          const merged = (ctx.current.walkNetWays || []).concat(osm.coveredWays);
          ctx.current.walkNetWays = merged;
          ctx.current.skywalkWays = osm.coveredWays;
          ctx.current.setWalkNet(merged);
          ctx.current.refresh?.(osm, false);
        }
        return osm;
      });

    })();
    return () => { cancelled = true; setMapReady(false); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // 🎓 ป้ายชื่ออาคาร — วางกลางตึกตาม bounds ใน BUILDINGS registry พร้อมไอคอนหมวกปริญญาบอกพิกัด
  // (แทนที่ label สำเร็จรูปจาก CARTO tile ที่ถูกเอาออกไปแล้วใน mapBaseLayer.js เพราะชื่อผิด/ไม่ตรงกับชื่อจริงของอาคาร)
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m || !mapReady) return;
    const layer = L.layerGroup().addTo(m);
    for (const key in BUILDINGS) {
      const b = BUILDINGS[key];
      if (!b.bounds || !b.bounds.length) continue;
      const [[south, west], [north, east]] = b.bounds;
      const lat = (south + north) / 2, lon = (west + east) / 2;
      L.marker([lat, lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none">
            <img src="/data/icon/building.svg" alt="" style="width:18px;height:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))" />
            <span style="background:rgba(255,255,255,.92);color:#202124;font-weight:800;font-size:11px;padding:2px 8px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.25);white-space:nowrap">${b.name}</span>
          </div>`,
          iconSize: [140, 40], iconAnchor: [70, 20],
        }),
        interactive: false,
        zIndexOffset: 500,
      }).addTo(layer);
    }
    return () => m.removeLayer(layer);
  }, [mapReady]);

  // 📍 หมุด POI ถาวรสำหรับห้อง/ห้องน้ำที่มีจุด "กลาง" (center) แยกจากหน้าประตู — โชว์บนแผนที่เสมอเหมือน POI ทั่วไป ไม่ต้องรอค้นหาก่อน
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m || !mapReady) return;
    const layer = L.layerGroup().addTo(m);
    const iconFor = (type) => (type === "Toilet" ? "/data/icon/toilet.svg" : "/data/icon/room.svg");
    for (const entry of SC8_SEARCH_NODES) {
      const room = rooms.find((r) => r.nodeId === entry.id);
      const displayName = room?.name || entry.name;

      if (!entry.markerId) continue; // ยังไม่มีจุดกลางจริง (เช่นห้องน้ำตอนนี้) — ข้ามไปก่อน จนกว่าจะมีพิกัด
      const center = KMITL_ALL_NODES[entry.markerId];
      const routeNode = KMITL_ALL_NODES[entry.id];
      if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) continue;
      const src = iconFor(routeNode?.type);
      L.marker([center.lat, center.lon], {
        icon: L.divIcon({
          className: "",
          html: `<img src="${src}" alt="" style="width:20px;height:20px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35))" />`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        }),
        zIndexOffset: 700,
      })
        .bindTooltip(displayName, { direction: "top", offset: [0, -10] })
        // กดหมุดแล้วเปิดการ์ดสถานที่ชุดเดียวกับผลการค้นหา — มีข้อมูลห้อง ปุ่มนำทาง และปุ่มแจ้งปัญหา
        .on("click", () => openPlaceCard(displayName, [center.lon, center.lat], {
          nodeId: entry.id,
          markerNodeId: entry.markerId,
          floor: KMITL_NODE_FLOOR[entry.id] || "1",
          icon: entry.icon,
          extract: entry.extract,
        }))
        .addTo(layer);
    }
    return () => m.removeLayer(layer);
  }, [mapReady, rooms]);

  // 🏢 วาด/ลบ overlay ผังชั้น KMITL ตาม state เปิด/ปิด และชั้นที่เลือก
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m) return;

    if (c.kmitlOverlay) { 
      m.removeLayer(c.kmitlOverlay); 
      c.kmitlOverlay = null; 
    }
    if (!kmitlOpen && mapZoom < 16) return;

    const shownFloor = kmitlOpen ? kmitlFloor : "1";
    const f = effectiveFloors.find((x) => x.id === shownFloor);

    const targetBounds = f?.bounds?.length === 2 ? f.bounds : (SC8_BOUNDS || KMITL_BOUNDS || FALLBACK_BOUNDS);


    if (f && f.svg && !kmitlCalibrate) {
      c.kmitlOverlay = L.imageOverlay(f.svg, targetBounds, { opacity: 0.96, interactive: false, pane: "bdiFloorPane" }).addTo(m);
    }else return;
    // ถ้าชั้นที่เลือกยังไม่มีไฟล์ผัง (f.svg == null) จะไม่วาดอะไร — UI ฝั่งแถบเลือกชั้นจะโชว์ข้อความแจ้งแทน
  }, [kmitlOpen, kmitlFloor, kmitlCalibrate, mapZoom]);

  // เก็บ flag ล่าสุดไว้ใน ctx เพื่อให้ map click handler (ผูกครั้งเดียวตอน mount) อ่านค่าปัจจุบันได้เสมอ
  useEffect(() => { ctx.current.navActive = !!nav?.active; }, [nav]);
  useEffect(() => { ctx.current.kmitlCalibrateActive = kmitlCalibrate; }, [kmitlCalibrate]);
  useEffect(() => { ctx.current.kmitlNodeModeActive = kmitlNodeMode; }, [kmitlNodeMode]);

  // 🔧 โหมดปรับเทียบ — ลากมุม NW/SE ของภาพให้ตรงกับตึกจริงบนแผนที่ฐาน แล้วอ่านค่าพิกัดที่ถูกต้องออกมา
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m) return;
    const cleanup = () => {
      if (c.calNW) { m.removeLayer(c.calNW); c.calNW = null; }
      if (c.calSE) { m.removeLayer(c.calSE); c.calSE = null; }
      if (c.calImg) { m.removeLayer(c.calImg); c.calImg = null; }
    };
    if (!kmitlOpen || !kmitlCalibrate) { cleanup(); return; }
    const f = effectiveFloor.find((x) => x.id === kmitlFloor);

    if (!f || !f.svg) return;

    let nw = [KMITL_BOUNDS[1][0], KMITL_BOUNDS[0][1]]; // [north, west]
    let se = [KMITL_BOUNDS[0][0], KMITL_BOUNDS[1][1]]; // [south, east]

    const update = () => {
      // const bounds = [[se[0], nw[1]], [nw[0], se[1]]];
      if (c.calImg) m.removeLayer(c.calImg);
      c.calImg = L.imageOverlay(f.svg, f.bounds, { opacity: 0.85, interactive: false, pane: "bdiFloorPane" }).addTo(m);
      const dms = (d) => { const dir = d >= 0 ? "" : "-"; d = Math.abs(d); const deg = Math.floor(d); const minF = (d - deg) * 60; const min = Math.floor(minF); const sec = ((minF - min) * 60).toFixed(2); return `${dir}${deg}°${min}'${sec}"`; };
      setKmitlCalReadout({
        nw: `${dms(nw[0])}N ${dms(nw[1])}E`,
        se: `${dms(se[0])}N ${dms(se[1])}E`,
        nwDec: [+nw[0].toFixed(7), +nw[1].toFixed(7)],
        seDec: [+se[0].toFixed(7), +se[1].toFixed(7)],
      });
    };
    const mk = (pos, color) => L.marker(pos, { draggable: true, icon: L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.6)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 2000 }).addTo(m);
    c.calNW = mk(nw, "#16a34a").bindTooltip("มุมบนซ้าย (NW)", { permanent: false });
    c.calSE = mk(se, "#dc2626").bindTooltip("มุมล่างขวา (SE)", { permanent: false });
    c.calNW.on("drag", (e) => { const p = e.target.getLatLng(); nw = [p.lat, p.lng]; update(); });
    c.calSE.on("drag", (e) => { const p = e.target.getLatLng(); se = [p.lat, p.lng]; update(); });
    update();
    return cleanup;
  }, [kmitlOpen, kmitlCalibrate, kmitlFloor]);

  // 📍 โหมดปักหมุด node บนผังตึก — วาด marker ตามประเภท ลากปรับตำแหน่งได้ คลิกขวาลบ
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m) return;
    (c.kmitlNodeMarkers || []).forEach((mk) => m.removeLayer(mk));
    c.kmitlNodeMarkers = [];
    
    if (!kmitlOpen) return;
    kmitlNodes.filter((n) => n.floor === kmitlFloor).forEach((n) => {
      const t = getNodeType(n.type);
      const mk = L.marker([n.lat, n.lon], {
        draggable: true,
        icon: L.divIcon({ className: "", html: `<div style="width:22px;height:22px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:grid;place-items:center;font-size:11px;color:#fff">${t.icon}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        zIndexOffset: 1800,
        pane: "bdiFloorPane",
      }).addTo(m).bindTooltip(`${t.label} #${n.id}`, { permanent: false });
      mk.on("drag", (e) => { const p = e.target.getLatLng(); setKmitlNodes((prev) => prev.map((x) => (x.id === n.id ? { ...x, lat: p.lat, lon: p.lng } : x))); });
      mk.on("contextmenu", () => setKmitlNodes((prev) => prev.filter((x) => x.id !== n.id))); // คลิกขวา = ลบหมุดนั้น
      c.kmitlNodeMarkers.push(mk);
    });
  }, [kmitlOpen, kmitlFloor, kmitlNodes]);

  // 🧭 วาดกราฟชั้นที่สำรวจจริง + ผลลัพธ์เส้นทางที่หาได้จาก indoorFloorRoute
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m) return;
    (c.kmitlGraphLayer || []).forEach((ly) => m.removeLayer(ly));
    c.kmitlGraphLayer = [];
    if (!kmitlOpen || !Object.keys(kmitlFloorNodes).length) { setKmitlRouteResult(null); return; }
    // 🔗 เส้น edge ระหว่าง node เป็นโครงกราฟสำหรับคำนวณเส้นทางเท่านั้น ไม่วาดให้ผู้ใช้เห็น
    //    (ผู้ใช้จะเห็นเฉพาะ "เส้นทางที่ระบบนำทางให้" ตอนกดนำทางจริงเท่านั้น)
    // 📍 วาด node ทุกจุดของชั้นที่กำลังดูอยู่ ให้เห็นบน SVG จริง — กรองตามชิปที่เปิดอยู่ (ห้องเรียน/ห้องน้ำ/ลิฟต์/บันได) ส่วน type อื่น (ทางเดิน/ทางเข้า/ทางหนีไฟ) ยังโชว์เสมอไม่เกี่ยวกับชิป
    for (const id of Object.keys(kmitlFloorNodes)) {
      const n = kmitlFloorNodes[id];
      if (!Number.isFinite(n?.lat) || !Number.isFinite(n?.lon)) continue;
      // node ทางเดินมีไว้ให้อัลกอริทึมเดินกราฟตอนนำทางเท่านั้น ไม่แสดงเป็นหมุดบนผัง
      if (WALKWAY_NODE_TYPES.includes(String(n.type || "").toLowerCase())) continue;
      const chipKey = Object.keys(CHIP_NODE_TYPES).find((k) => CHIP_NODE_TYPES[k].includes(n.type));
      if (chipKey && !chips[chipKey]) continue; // ชิปหมวดนี้ปิดอยู่ — ข้าม node ประเภทนี้ไป
      const t = NODE_TYPES.find((x) => x.id === n.type) || NODE_TYPES[0];
      const marker = L.circleMarker([n.lat, n.lon], { radius: 5, color: "#FFFFFF", weight: 1.5, fillColor: t.color, fillOpacity: 0.95, pane: "bdiFloorPane" }).addTo(m);
      const nodeName = n.label || t.label;
      marker.bindTooltip(nodeName, { direction: "top", offset: [0, -8] });
      // กดที่ node แล้วเปิดการ์ดสถานที่แบบเดียวกับการค้นหา (มีปุ่มนำทาง / แจ้งปัญหา)
      marker.on("click", () => {
        const entry = SC8_SEARCH_NODES.find((x) => x.id === id || x.markerId === id);
        openPlaceCard(entry?.name || nodeName, [n.lon, n.lat], {
          nodeId: entry?.id || id,
          markerNodeId: entry?.markerId || id,
          floor: kmitlFloor,
          icon: entry?.icon || t.icon,
          extract: entry?.extract || `${t.label} ชั้น ${kmitlFloor} อาคารพระจอมเกล้าฯ (Sc8)`,
        });
      });
      c.kmitlGraphLayer.push(marker);
    }
    if (kmitlRouteResult?.path?.length > 1) {
      const latlngs = kmitlRouteResult.path.map((id) => kmitlFloorNodes[id]).filter(Boolean).map((n) => [n.lat, n.lon]);
      if (latlngs.length > 1) c.kmitlGraphLayer.push(L.polyline(latlngs, { color: "#F9AB00", weight: 6, opacity: 0.95, pane: "bdiFloorPane" }).addTo(m));
    }
    return () => { (c.kmitlGraphLayer || []).forEach((ly) => { if (m.hasLayer(ly)) m.removeLayer(ly); }); c.kmitlGraphLayer = []; };
  }, [kmitlOpen, kmitlFloor, kmitlFloorNodes, kmitlRouteResult, chips]);

  // 🎪 หมุดกิจกรรม — กิจกรรมที่ผู้ใช้กดสนใจจะเป็นหมุดแดงเด่น แสดงตลอดไม่ว่าจะซูมระดับไหน
  useEffect(() => {
    const c = ctx.current, L = c.L, m = mapRef.current;
    if (!L || !m) return;
    (c.eventMarkers || []).forEach((mk) => m.removeLayer(mk));
    c.eventMarkers = [];

    for (const ev of events) {
      if (!Number.isFinite(Number(ev.lat)) || !Number.isFinite(Number(ev.lon))) continue;
      const on = !!interests.find((i) => i.eventId === ev.id && i.userId === user?.id);
      const color = on ? "#D93025" : "#1A73E8";
      const size = on ? 42 : 34;
      const html = `
        <div style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px">
          ${on ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.22"></span>` : ""}
          <span style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:grid;place-items:center">
            <span style="transform:rotate(45deg);width:${on ? 19 : 16}px;height:${on ? 19 : 16}px;background:#fff;-webkit-mask:url('${EVENT_PIN_ICON}') center/contain no-repeat;mask:url('${EVENT_PIN_ICON}') center/contain no-repeat"></span>
          </span>
        </div>`;
      const mk = L.marker([Number(ev.lat), Number(ev.lon)], {
        icon: L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        zIndexOffset: on ? 3000 : 2200,
        title: ev.name,
      }).addTo(m);
      mk.on("click", () => openEventCard(ev));
      c.eventMarkers.push(mk);
    }
    return () => { (c.eventMarkers || []).forEach((mk) => { if (m.hasLayer(mk)) m.removeLayer(mk); }); c.eventMarkers = []; };
  }, [events, interests, mapReady, user?.id]);


  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      showRoutes: async (from, to) => {
        const c = ctx.current, L = c.L; if (!L) return null;
        const key = `${from || ""}|${to || ""}`;
        if (c.routeKey === key && c.scored) { c.select(c.best); return c.scored; }
        c.routeLayer.clearLayers(); setRouteData({ loading: true });
        c.indoorOn = false; c.updateIndoor?.();
        let sName = "Sc8", eName = "สถานีแอร์พอร์ตลิงก์ลาดกระบัง", sCoord = null, eCoord = null, note = null;
        if (!from && c.myLocation) { sCoord = c.myLocation; sName = "ตำแหน่งของฉัน"; }
        const resolve = async (x) => { if (!x) return null; const pc = c.placeCache && c.placeCache[x]; if (pc) return pc; return (await resolvePlace(x)) || (await geocodeNominatim(x)); };
        const [gFrom, gTo] = await Promise.all([resolve(from), resolve(to)]);
        if (from) { if (gFrom) { sCoord = gFrom.coord; sName = gFrom.name; } else note = `หา "${from}" ไม่เจอ (ใช้ สจล. แทน) — ลองพิมพ์ชื่อให้ชัดขึ้น`; }
        if (to) { if (gTo) { eCoord = gTo.coord; eName = gTo.name; } else note = (note ? note + " · " : "") + `หา "${to}" ไม่เจอ (ใช้สถานีแอร์พอร์ตลิงก์ลาดกระบังแทน)`; }
        // ใช้ graphRoute (Dijkstra บนกราฟ OSM + กราฟในตึกทั้งหมด) เป็นแหล่งเดียว — ไม่มี ORS/`/api/route` แล้ว
        const DEF_START = [100.780099, 13.729721]; // Sc8
        const DEF_END = [100.7469, 13.7229]; // สถานีแอร์พอร์ตเรลลิงก์ลาดกระบัง
        const start = sCoord || DEF_START;
        const end = eCoord || DEF_END;
        const routes = []; // ไม่มีเส้นทางสำเร็จรูป — c.refresh ด้านล่างจะคำนวณจาก graphRoute
        c.baseRoutes = routes; c.lastStart = start; c.lastEnd = end; c.sName = sName; c.eName = eName; c.note = note; c.lastOsm = null;
        c.routeKey = key;
        const pinIcon = (letter, bg, tag, glow) => L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))">
            <div style="background:${bg};color:#fff;font-weight:800;font-size:10.5px;letter-spacing:.5px;padding:2px 9px;border-radius:999px;white-space:nowrap;border:1.5px solid #fff;margin-bottom:2px">${tag}</div>
            <div style="background:${bg};color:#fff;border:3px solid #fff;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;font-weight:800;font-size:16px;line-height:1;box-shadow:0 0 0 4px ${glow}">${letter}</div>
            <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #fff;margin-top:-1px"></div>
          </div>`,
          iconSize: [80, 68], iconAnchor: [40, 64],
        });
        c.redrawRoutes = (cands) => {
          c.routeLayer.clearLayers();
          const bc = (cands[c.best] && cands[c.best].coordinates) || [[start[0], start[1]], [end[0], end[1]]];
          const anchor = (searched, pt) => (!searched || haversine(searched, pt) <= 60) ? pt : searched;
          const sPt = anchor(c.lastStart, bc[0]), ePt = anchor(c.lastEnd, bc[bc.length - 1]);
          const connectPin = (pin, pt) => { if (haversine(pin, pt) > 25) L.polyline([[pin[1], pin[0]], [pt[1], pt[0]]], { color: "#AECBFA", weight: 3, opacity: 0.7, dashArray: "3 7" }).addTo(c.routeLayer); };
          connectPin(sPt, bc[0]); connectPin(ePt, bc[bc.length - 1]);
          L.marker([sPt[1], sPt[0]], { icon: pinIcon("S", "#16a34a", "จุดเริ่ม", "rgba(22,163,74,.35)"), zIndexOffset: 1000 }).bindPopup("จุดเริ่ม: " + sName).addTo(c.routeLayer);
          L.marker([ePt[1], ePt[0]], { icon: pinIcon("E", "#dc2626", "ปลายทาง", "rgba(220,38,38,.35)"), zIndexOffset: 1000 }).bindPopup("ปลายทาง: " + eName).addTo(c.routeLayer);
          c.polylines = cands.map((r) => L.polyline(r.coordinates.map(([lon, lat]) => [lat, lon]), { color: "#9AA0A6", weight: 5, opacity: 0.72, dashArray: "8 8", lineCap: "round" }).addTo(c.routeLayer));
          c.select = (i) => {
            c.polylines.forEach((pl, j) => {
              if (j === i) pl.setStyle({ color: "#1A73E8", weight: 7, opacity: 0, lineCap: "round", lineJoin: "round", dashArray: null }).bringToFront();
              else pl.setStyle({ color: "#8AB4F8", weight: 5, opacity: 0.62, dashArray: "7 8", lineCap: "round", lineJoin: "round" });
            });
            // 🎨 เส้นทางที่เลือก = สีตามหมวด "ในตึก/นอกตึก" ล้วนๆ (ตัดร่ม/แดด/ไฟออกแล้ว)
            if (c.segLayer) c.routeLayer.removeLayer(c.segLayer);
            c.segLayer = L.layerGroup();
            const bIdx = buildingIndex(c.bldgs);
            const segs = routeSegments(cands[i].coordinates, cands[i].nodeKeys, bIdx);
            const SEGMENT_LABELS = { indoor: "🔵 ทางเดินในอาคาร", outdoor: "🟢 ทางเดินนอกอาคาร" };
            for (const seg of segs) {
              if (seg.coordinates.length < 2) continue;
              const latlngs = seg.coordinates.map(([lon, lat]) => [lat, lon]);
              // 🔵⚪ เส้นนำทางแบบจุด: วาดซ้อน 2 ชั้น — ชั้นขาวหนากว่าเป็นขอบ + ชั้นฟ้าบางกว่าทับด้านบน ให้ดูเป็นจุดกลมสีฟ้าขอบขาว
              L.polyline(latlngs, { color: "#FFFFFF", weight: 11, opacity: 1, dashArray: "1 14", lineCap: "round", lineJoin: "round" }).addTo(c.segLayer);
              L.polyline(latlngs, { color: "#1A73E8", weight: 7, opacity: 1, dashArray: "1 14", lineCap: "round", lineJoin: "round" })
                .bindPopup(SEGMENT_LABELS[seg.cat] || seg.cat)
                .addTo(c.segLayer);
            }
            c.segLayer.addTo(c.routeLayer);

            // 🏢🟣 จุดเปลี่ยนชั้น (escalator/lift) + จางเส้นทางชั้นที่ไม่ตรงกับชั้นที่กำลังดูอยู่
            const BLDG_CFG = {
              kmitl: { nodes: KMITL_ALL_NODES, floorOf: KMITL_NODE_FLOOR, doorIds: new Set(KMITL_EXTERIOR_LINKS.map((e) => e.node)), floorRef: kmitlFloorRef, setFloor: setKmitlFloor, setOpen: setKmitlOpen },
            };
            const nk = cands[i].nodeKeys || [];
            const info = nk.map((k) => {
              if (!k) return null;
              const m = /^IN:([^:]+):(.+)$/.exec(k);
              if (!m) return null;
              const [, bldg, id] = m;
              const cfg = BLDG_CFG[bldg];
              const n = cfg && cfg.nodes[id];
              if (!cfg || !n) return null;
              return { bldg, id, floor: cfg.floorOf[id] || null, type: n.type, label: n.label, isDoor: cfg.doorIds.has(id) };
            });
            const searchKey = c.lastStart + "|" + c.lastEnd;
            if (c.lastEntranceKey !== searchKey) {
              const seenBldg = new Set();
              for (const it of info) {
                if (!it || !it.floor || seenBldg.has(it.bldg)) continue;
                seenBldg.add(it.bldg);
                const cfg = BLDG_CFG[it.bldg];
                cfg.setFloor(it.floor); cfg.setOpen(true); cfg.floorRef.current = it.floor;
              }
              c.lastEntranceKey = searchKey;
            }
            c.drawFloorOverlay = () => {
              if (c.floorLayer) c.routeLayer.removeLayer(c.floorLayer);
              c.floorLayer = L.layerGroup();
              const curOf = (bldg) => BLDG_CFG[bldg]?.floorRef.current;
              const coordsArr = cands[i].coordinates;
              let runStart = null;
              for (let idx = 0; idx <= coordsArr.length; idx++) {
                const it = idx < coordsArr.length ? info[idx] : null;
                const dim = it && it.floor && it.floor !== curOf(it.bldg);
                if (dim && runStart == null) runStart = idx;
                if (!dim && runStart != null) {
                  const pts = coordsArr.slice(runStart, idx + 1);
                  if (pts.length >= 2) L.polyline(pts.map(([lon, lat]) => [lat, lon]), { color: "#fff", weight: 7, opacity: 0.55, lineCap: "round", lineJoin: "round" }).addTo(c.floorLayer);
                  runStart = null;
                }
              }
              for (let idx = 0; idx < coordsArr.length; idx++) {
                const it = info[idx];
                if (!it || !(it.type === "escalator" || it.type === "lift" || it.isDoor)) continue;
                const [lon, lat] = coordsArr[idx];
                L.circleMarker([lat, lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#8E24AA", fillOpacity: 0.95, pane: "bdiFloorPane" })
                  .bindPopup(`${it.label || it.id}${it.floor ? " · ชั้น " + it.floor : ""}`)
                  .addTo(c.floorLayer);
              }
              c.floorLayer.addTo(c.routeLayer);
            };
            c.drawFloorOverlay();
            c.indoorOn = !!cands[i]?.skywalk; c.updateIndoor?.();
            setActive(i);
          };
        };
        // คำนวณ candidates + คะแนน + วาด (นำทางปกติ — ไม่มีเวลา/ร่ม/สว่างอีกต่อไป)
        c.refresh = (osm, fit) => {
          const cands = c.baseRoutes.map((r, i) => ({ ...r, index: i }));
          const g = c.walkNet ? graphRoute(c.walkNet, c.lastStart, c.lastEnd) : null;
          if (g) { g.index = cands.length; cands.push(g); }
          if (!cands.length) {
            setRouteData({ error: "กำลังเตรียมข้อมูลแผนที่ ลองใหม่อีกครั้งในสักครู่" });
            return [];
          }
          const scored = scoreRoutes(cands, osm || { ok: false, trees: [], green: [], toilets: [], cameras: [] });
          const picks = pickRoutes(scored);
          c.picks = picks;
          const best = picks.fastIdx;
          c.best = best; c.scored = scored.map((r, i) => ({ ...r, recommended: i === best }));
          c.redrawRoutes(cands);
          c.select(best);
          if (fit && mapRef.current && c.polylines[best]) mapRef.current.fitBounds(c.polylines[best].getBounds().pad(0.15));
          setRouteData({ routes: scored, best, picks, graphOk: !!g, osmOk: !!(osm && osm.ok), startName: c.sName, endName: c.eName, note: c.note, scoring: !osm });
          return scored;
        };
        c.refresh(null, true);
        let lons = [], lats = []; routes.forEach((r) => r.coordinates.forEach(([lo, la]) => { lons.push(lo); lats.push(la); }));
        const within = lats.length && Math.min(...lats) >= DEMO_BBOX[0] && Math.min(...lons) >= DEMO_BBOX[1] && Math.max(...lats) <= DEMO_BBOX[2] && Math.max(...lons) <= DEMO_BBOX[3];
        const mg = 0.004;
        const lo0 = Math.min(start[0], end[0]), la0 = Math.min(start[1], end[1]), lo1 = Math.max(start[0], end[0]), la1 = Math.max(start[1], end[1]);
        (async () => {
          const osm = within ? await c.osmPromise : await fetchOSM([la0 - mg, lo0 - mg, la1 + mg, lo1 + mg]);
          if (c.routeKey !== key) return;
          if (osm.crossings && osm.crossings.length) { c.crossings = osm.crossings; c.addCrossMarkers?.(osm.crossings); }
          c.addSkywalks?.(osm.coveredWays);
          if (c.addOsmMarkers) c.addOsmMarkers(osm);
          c.lastOsm = osm;
          const full = c.refresh(osm, false);
          (async () => {
            const seen = {};
            for (const r of full) {
              for (const t of (r.toiletsNearby || [])) {
                if (!t.pt) continue;
                const kk = t.pt.map((x) => x.toFixed(5)).join(",");
                if (!(kk in seen)) seen[kk] = await queuedReverse(t.pt);
                if (c.routeKey !== key) return;
                const g = seen[kk];
                if (g) { if (g.place) t.place = g.place; if (!t.road && g.road) t.road = g.road; }
              }
            }
            c.scored = full.map((r, i) => ({ ...r, recommended: i === c.best }));
          })();
        })();
        return c.scored;
      },
      getRoutes: () => ctx.current.scored,
    };
  }, [apiRef]);

  // ---------- โหมดนำทาง GPS ----------
  function updateNav(u) {
    const c = ctx.current, n = c.nav; if (!n) return;
    const lang = c.voiceLang || "th";
    c.userMarker?.setLatLng([u[1], u[0]]);
    if (c.prevPos && c.userMarker && c.L && haversine(c.prevPos, u) > 1.5) {
      const hd = bearing(c.prevPos, u);
      c.userMarker.setIcon(c.L.divIcon({ className: "", html: `<div style="width:24px;height:24px;line-height:24px;text-align:center;font-size:22px;color:#1d6fb8;transform:rotate(${hd}deg)">\u25B2</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }));
    }
    c.prevPos = u;
    if (mapRef.current) mapRef.current.setView([u[1], u[0]], Math.max(mapRef.current.getZoom(), 17), { animate: true });
    let idx = 0, bd = Infinity;
    for (let i = 0; i < n.coords.length; i++) { const d = haversine(u, n.coords[i]); if (d < bd) { bd = d; idx = i; } }
    const distDest = Math.max(0, Math.round(n.cum[n.cum.length - 1] - n.cum[idx]));
    let k = n.steps.findIndex((st) => idx <= st.wpEnd); if (k < 0) k = n.steps.length - 1;
    let mWp = null, mTurn = null, mName = "";
    for (let j = k + 1; j < n.steps.length; j++) {
      const wp = n.steps[j].wpStart;
      const tt = turnAt(n.coords, wp);
      if (tt && tt !== "ตรงไป") { mWp = wp; mName = n.steps[j].name || ""; const ts = turnSide(n.coords, wp, u); mTurn = (ts && ts !== "ตรงไป") ? ts : tt; break; }
    }
    const distTurn = mWp != null ? Math.max(0, Math.round(n.cum[mWp] - n.cum[idx])) : distDest;
    const nameEN = roadEN(mName);
    const instr = lang === "en"
      ? (TURN_EN[mTurn] || "continue to the destination") + (nameEN ? " onto " + nameEN : "")
      : (mTurn || "ตรงไปยังปลายทาง") + (mName ? ` เข้า ${mName}` : "");
    let crossAhead = null, cbest = Infinity;
    for (const cp of c.crossings || []) {
      if (haversine(u, cp) > 60) continue;
      let ci = 0, cb = Infinity; for (let i = 0; i < n.coords.length; i++) { const dd = haversine(cp, n.coords[i]); if (dd < cb) { cb = dd; ci = i; } }
      if (cb > 10 || ci < idx) continue;
      let nearTurn = false;
      for (const st of n.steps) {
        const wp = st.wpStart;
        if (wp <= 0 || wp >= n.coords.length - 1) continue;
        if (Math.abs(n.cum[wp] - n.cum[ci]) > 25) continue;
        const tt = turnAt(n.coords, wp);
        if (tt && tt !== "ตรงไป") { nearTurn = true; break; }
      }
      if (!nearTurn) continue;
      const al = Math.round(n.cum[ci] - n.cum[idx]);
      if (al >= 0 && al < cbest) { cbest = al; crossAhead = { dist: al, id: cp.join(",") }; }
    }
    let hazard = null, hbest = Infinity, hid = null;
    for (const p of (c.problems || [])) {
      if (haversine(u, p.pt) > 80) continue;
      let pidx = 0, pbd = Infinity; for (let i = 0; i < n.coords.length; i++) { const dd = haversine(p.pt, n.coords[i]); if (dd < pbd) { pbd = dd; pidx = i; } }
      if (pbd > 28 || pidx < idx - 4) continue;
      const along = Math.round(n.cum[pidx] - n.cum[idx]);
      if (along > 90) continue;
      const near = Math.abs(along);
      if (near < hbest) { hbest = near; hazard = { label: CAT[p.cat]?.label || "จุดเสี่ยง", dist: Math.max(0, along) }; hid = p.pt.join(","); }
    }
    let toiletAhead = null, tbest = Infinity;
    const userAlong = n.cum[idx];
    for (const t of (n.toilets || [])) {
      if (!t || t.along == null) continue;
      const ahead = t.along - userAlong;
      if (ahead < -10 || ahead > 300) continue;
      if ((t.off || 0) > 90) continue;
      const walk = Math.max(0, ahead) + (t.off || 0);
      if (walk < tbest) { tbest = walk; toiletAhead = { dist: Math.max(0, Math.round(ahead)), off: Math.round(t.off || 0), name: t.name || "ห้องน้ำ", where: [t.place, t.road].filter(Boolean).join(" · "), id: (t.pt || []).join(",") }; }
    }
    // 🛗 จุดเปลี่ยนชั้น/ขึ้นตึกข้างหน้า (บันไดเลื่อน/ลิฟต์ ที่มี label สำรวจไว้)
    const BLDG_LOOKUP = { kmitl: KMITL_ALL_NODES };
    let transitAhead = null, xbest = Infinity;
    for (let i = idx; i < (n.nodeKeys || []).length; i++) {
      const key = n.nodeKeys[i];
      if (!key) continue;
      const mtc = /^IN:([^:]+):(.+)$/.exec(key);
      if (!mtc) continue;
      const [, bldg, nid] = mtc;
      const node = BLDG_LOOKUP[bldg]?.[nid];
      if (!node || !node.label) continue;
      if (!(node.type === "escalator" || node.type === "lift")) continue;
      const ahead = Math.round(n.cum[i] - n.cum[idx]);
      if (ahead < -5 || ahead > 60) continue;
      if (ahead < xbest) { xbest = ahead; transitAhead = { dist: Math.max(0, ahead), label: node.label, type: node.type, id: `${bldg}:${nid}` }; }
    }
    const arrived = distDest < 20;
    setNav({ active: true, instr, distTurn, distDest, hazard, arrived, cross: crossAhead, toilet: toiletAhead, transit: transitAhead });
    if (c.voiceOn) {
      const rnd = (m) => Math.max(10, Math.round(m / 10) * 10);
      const en = lang === "en";
      if (transitAhead && transitAhead.dist <= 30 && c.spokenTransit && !c.spokenTransit.has(transitAhead.id)) {
        c.spokenTransit.add(transitAhead.id);
        const tm = rnd(transitAhead.dist);
        speakNow(en ? `${transitAhead.label}, ${tm} meters ahead` : `${transitAhead.label} อีก ${tm} เมตรข้างหน้า`, lang);
      } else if (crossAhead && crossAhead.dist <= 35 && c.spokenCross && !c.spokenCross.has(crossAhead.id)) {
        c.spokenCross.add(crossAhead.id);
        speakNow(en ? "Prepare to cross the road, watch for traffic" : "เตรียมข้ามถนน ระวังรถ", lang);
      } else if (mWp != null && distTurn <= 55 && !c.spokenTurns.has(mWp)) {
        c.spokenTurns.add(mWp);
        const m = rnd(distTurn);
        if (distTurn <= 12) speakNow(instr, lang);
        else speakNow(en ? `In ${m} meters, ${TURN_EN[mTurn] || "continue"}${nameEN ? " onto " + nameEN : ""}` : `ในอีก ${m} เมตร ${instr}`, lang);
      }
      if ((mWp == null || distTurn > 90) && distDest > 40 && !c.straightSpoken) { c.straightSpoken = true; speakNow(en ? "Continue straight" : "เดินตรงไป", lang); }
      if (mWp != null && distTurn < 60) c.straightSpoken = false;
      if (hazard && hazard.dist < 50 && !c.spokenHaz.has(hid)) { c.spokenHaz.add(hid); speak(en ? "Caution, obstacle ahead" : `ระวัง ${hazard.label} ข้างหน้า`, lang); }
      if (toiletAhead && toiletAhead.dist <= 45 && c.spokenToilet && !c.spokenToilet.has(toiletAhead.id)) { c.spokenToilet.add(toiletAhead.id); const tm = rnd(toiletAhead.dist); speak(en ? `Toilet ${tm} meters ahead` : `ห้องน้ำอีก ${tm} เมตรข้างหน้า`, lang); }
      if (arrived && !c.spokenArrived) { c.spokenArrived = true; speak(en ? "You have arrived" : "ถึงปลายทางแล้ว", lang); }
    }
  }
  function onPos(pos) { updateNav([pos.coords.longitude, pos.coords.latitude]); }
  function onErr() { setNav((p) => ({ ...(p || { active: true }), instr: "เปิด GPS ไม่สำเร็จ — อนุญาตตำแหน่ง แล้วเปิดเว็บแบบ HTTPS บนมือถือ", distTurn: null, distDest: null, hazard: null })); }
  function startNav(i) {
    const c = ctx.current, L = c.L; const r = c.scored?.[i]; if (!r || !L) return;
    const coords = r.coordinates; const cum = [0];
    for (let k = 1; k < coords.length; k++) cum[k] = cum[k - 1] + haversine(coords[k - 1], coords[k]);
    c.nav = { coords, cum, steps: r.steps || [], toilets: r.toiletsNearby || [], nodeKeys: r.nodeKeys || [] };
    c.spokenTurns = new Set(); c.spokenHaz = new Set(); c.spokenCross = new Set(); c.spokenToilet = new Set(); c.spokenTransit = new Set(); c.spokenArrived = false; c.prevPos = null; c.straightSpoken = false;
    if (!c.userMarker) c.userMarker = L.marker([coords[0][1], coords[0][0]], { icon: L.divIcon({ className: "", html: '<div style="width:18px;height:18px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 1px 8px rgba(26,115,232,.65)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(mapRef.current);
    setNav({ active: true, instr: "กำลังหาตำแหน่ง…", distTurn: null, distDest: Math.round(cum[cum.length - 1]), hazard: null, arrived: false });
    if (!navigator.geolocation) { onErr(); return; }
    c.navWatch = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }
  function startSim(i) {
    const c = ctx.current, L = c.L; const r = c.scored?.[i]; if (!r || !L) return;
    if (c.simTimer) { clearInterval(c.simTimer); c.simTimer = null; }
    const coords = r.coordinates; const cum = [0];
    for (let k = 1; k < coords.length; k++) cum[k] = cum[k - 1] + haversine(coords[k - 1], coords[k]);
    c.nav = { coords, cum, steps: r.steps || [], toilets: r.toiletsNearby || [], nodeKeys: r.nodeKeys || [] };
    c.spokenTurns = new Set(); c.spokenHaz = new Set(); c.spokenCross = new Set(); c.spokenToilet = new Set(); c.spokenTransit = new Set(); c.spokenArrived = false; c.prevPos = null; c.straightSpoken = false;
    if (!c.userMarker) c.userMarker = L.marker([coords[0][1], coords[0][0]], { icon: L.divIcon({ className: "", html: '<div style="width:18px;height:18px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 1px 8px rgba(26,115,232,.65)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(mapRef.current);
    setNav({ active: true, instr: "เริ่มเดิน (โหมดจำลอง)", distTurn: null, distDest: Math.round(cum[cum.length - 1]), hazard: null, arrived: false });
    let d = 0; const total = cum[cum.length - 1];
    c.simTimer = setInterval(() => {
      d += 7; if (d > total) d = total;
      updateNav(pointAtDistance(coords, cum, d));
      if (d >= total) { clearInterval(c.simTimer); c.simTimer = null; }
    }, 650);
  }
  function stopNav() {
    const c = ctx.current;
    if (c.navWatch != null) { navigator.geolocation.clearWatch(c.navWatch); c.navWatch = null; }
    if (c.simTimer) { clearInterval(c.simTimer); c.simTimer = null; }
    if (c.userMarker && mapRef.current) { mapRef.current.removeLayer(c.userMarker); c.userMarker = null; }
    c.nav = null; setNav(null);
  }

  function toggleVoice() { const c = ctx.current; c.voiceOn = !c.voiceOn; setVoice(c.voiceOn); if (!c.voiceOn && window.speechSynthesis) window.speechSynthesis.cancel(); }
  function toggleVoiceLang() { const c = ctx.current; c.voiceLang = c.voiceLang === "en" ? "th" : "en"; setVoiceLang(c.voiceLang); }

  function doSearch() { const f = sFrom.trim(), t = sTo.trim(); setSearchOpen(false); setRouteSheetOpen(false); try { apiRef?.current?.showRoutes?.(f || null, t || null); } catch (e) {} }

  // 📚 ดึงข้อมูลสถานที่จาก Wikipedia อัตโนมัติ (ข้อความย่อ + รูปภาพ) — ลองภาษาไทยก่อน ถ้าไม่มีค่อย fallback เป็นอังกฤษ
  // ✏️ ใส่ข้อมูลสถานที่เอง — เช็คตารางนี้ก่อนเสมอ (key = ชื่อที่ขึ้นในช่องค้นหา/BUILDINGS registry) เพิ่ม entry ใหม่ตรงนี้ได้เลย
  const PLACE_INFO = {
    "ตึกพระจอมเกล้าฯ (Sc8)": {
      extract: "อาคารเรียน/ปฏิบัติการของ สจล. ภายในมีห้องเรียน และ Co-Working Space",
      image: "/data/places/sc8.png",
    },
  };

  // 📚 ดึงข้อมูลสถานที่ — เช็ค PLACE_INFO (ใส่เอง) ก่อนเสมอ ถ้าไม่มีค่อย fallback ไป OpenStreetMap/Nominatim (ไม่ใช้ Wikipedia แล้ว)
  async function fetchPlaceInfo(query) {
    if (PLACE_INFO[query]) return { title: query, extract: PLACE_INFO[query].extract, image: PLACE_INFO[query].image };
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&accept-language=th&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const arr = await res.json();
      if (!arr.length) return null;
      const j = arr[0];
      const category = [j.type, j.class].filter(Boolean).join(" · ");
      const extract = j.extratags?.description || [category, j.display_name].filter(Boolean).join(" — ");
      return { title: j.namedetails?.name || query, extract: extract || null, image: null }; // OSM/Nominatim ไม่มีรูปแนบมาด้วย — ใส่เองผ่าน PLACE_INFO ถ้าต้องการรูป
    } catch (e) { return null; }
  }

  // 🎪 เปิดการ์ดรายละเอียดกิจกรรม (ข้อมูลตามที่ฝ่ายประชาสัมพันธ์กรอกไว้)
  function openEventCard(ev) {
    setPlaceCard(null);
    setSearchOpen(false);
    setEventCard(ev);
    const map = mapRef.current;
    if (map && Number.isFinite(Number(ev.lat))) {
      map.setView([Number(ev.lat), Number(ev.lon)], Math.max(map.getZoom(), 18), { animate: true });
      setTimeout(() => map.panBy([0, 110], { animate: true }), 280);
    }
  }

  // 📍 ผู้ใช้เลือกสถานที่ปลายทางจากช่องค้นหา — แสดงการ์ดรายละเอียดกลางจอก่อน ยังไม่ขึ้นเส้นทางทันที (กด "นำทาง" ในการ์ดค่อยขึ้น)
  async function openPlaceCard(name, coord, meta = {}) {
    const routeNode = meta.nodeId
    ? KMITL_ALL_NODES[meta.nodeId]
    : null;

    const markerNode = meta.markerNodeId
      ? KMITL_ALL_NODES[meta.markerNodeId]
      : routeNode;

    const finalCoord = markerNode
      ? [markerNode.lon, markerNode.lat]
      : coord;

    if (
      !finalCoord ||
      !Number.isFinite(finalCoord[0]) ||
      !Number.isFinite(finalCoord[1])
    ) {
      return;
    }

    ctx.current.placeCache[name] = {
      coord: routeNode
        ? [routeNode.lon, routeNode.lat]
        : finalCoord,

      markerCoord: finalCoord,
      name,
      nodeId: meta.nodeId || null,
      markerNodeId: meta.markerNodeId || null,
    };
      setSearchQuery(name);
    setSTo(name);
    setSearchOpen(false);
    setRouteFormOpen(false);

    if (meta.nodeId) {
      setKmitlFloor(meta.floor || KMITL_NODE_FLOOR[meta.nodeId] || "1");
      setKmitlOpen(true);
    }

    const map = mapRef.current;
    if (map) {
      // เว้นพื้นที่ด้านล่างไว้ให้ bottom sheet แล้วเลื่อน node มาอยู่กลางพื้นที่แผนที่ที่ยังมองเห็น
      map.setView([finalCoord[1], finalCoord[0]], Math.max(map.getZoom(), meta.nodeId ? 20 : 18), { animate: true });
      setTimeout(() => map.panBy([0, 105], { animate: true }), 280);
    }

    const c = ctx.current;
    if (c.searchPlaceMarker && map) map.removeLayer(c.searchPlaceMarker);
    if (c.L && map) {
      c.searchPlaceMarker = c.L.marker([finalCoord[1], finalCoord[0]], {
        icon: c.L.divIcon({
          className: "",
          html: '<div style="width:18px;height:18px;background:#D93025;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 18],
        }),
        zIndexOffset: 1800,
      }).addTo(map);
    }

    setPlaceCard({
      name,
      coord: finalCoord,
      nodeId: meta.nodeId || null,
      floor: meta.floor || null,
      icon: meta.icon || "📍",
      extract: meta.extract || null,
      image: null,
      loading: !meta.extract,
      error: false,
    });

    if (!meta.extract) {
      const info = await fetchPlaceInfo(name);
      setPlaceCard((prev) => prev && prev.name === name
        ? {
            ...prev,
            name: info?.title || prev.name,
            loading: false,
            extract: info?.extract || null,
            image: info?.image || null,
            error: !info,
          }
        : prev);
    }
  }

  function navigateFromCard() {
    if (!placeCard) return;
    setSTo(placeCard.name);
    // 🚪 ใช้พิกัดหน้าประตู (route node) สำหรับนำทางจริง — ไม่ใช่พิกัดกลางห้อง (placeCard.coord/marker) ที่ node ไม่มี edge เชื่อมเลย ทำให้หาเส้นทางไม่เจอ
    const routeNode = placeCard.nodeId ? KMITL_ALL_NODES[placeCard.nodeId] : null;
    const routeCoord = routeNode ? [routeNode.lon, routeNode.lat] : placeCard.coord;
    ctx.current.placeCache[placeCard.name] = {
      coord: routeCoord,
      name: placeCard.name,
      nodeId: placeCard.nodeId || null,
    };
    setPlaceCard(null);
    setRouteFormOpen(true);
    setSearchOpen(true);
    setRouteSheetOpen(false);
  }

  // เปิดฟอร์มแจ้งปัญหาของสถานที่ที่กำลังเปิดการ์ดอยู่
 function openReportForm() {
    if (!placeCard) return;
    const room = rooms.find((r) => r.nodeId === placeCard.nodeId);
    if (room) {
      // มีข้อมูลห้องอยู่ในระบบ (rooms) แล้ว → prefill เป็นข้อมูลเดิมให้แก้
      setReportForm({
        roomId: room.id,
        nodeId: room.nodeId,
        before: { name: room.name, type: room.type, capacity: room.capacity, teacher: room.teacher },
        subject: "",
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        teacher: room.teacher,
        note: "",
      });
    } else {
      // สถานที่ประเภทนี้ยังไม่มีข้อมูลโครงสร้างใน rooms (เช่น ห้องน้ำ/ลิฟต์) → ใช้ฟอร์มข้อความอย่างเดียว
      setReportForm({
        roomId: null,
        nodeId: placeCard.nodeId || null,
        before: { name: placeCard.name },
        subject: "",
        name: placeCard.name,
        note: "",
      });
    }
    setReportOpen(true);
  }

async function submitReport() {
    if (!reportForm || !user) return;

    if (!reportForm.note?.trim()) {
      alert("กรุณากรอกรายละเอียดปัญหา");
      return;
    }

    if (reportForm.roomId != null) {
      const before = reportForm.before || {};

      const after = {
        name: String(reportForm.name ?? "").trim(),
        type: String(reportForm.type ?? "").trim(),
        capacity:
          reportForm.capacity === "" || reportForm.capacity == null
            ? null
            : Number(reportForm.capacity),
        teacher: String(reportForm.teacher ?? "").trim(),
      };

      const changed =
        after.name !== String(before.name ?? "").trim() ||
        after.type !== String(before.type ?? "").trim() ||
        after.capacity !== (before.capacity == null ? null : Number(before.capacity)) ||
        after.teacher !== String(before.teacher ?? "").trim();

      if (!changed) {
        alert("กรุณาแก้ไขข้อมูลอย่างน้อย 1 รายการก่อนส่งคำร้อง");
        return;
      }
    }

    const dailyLimit = Number(requestQuota?.perUserPerDay ?? 3);
    const monthlyLimit = Number(requestQuota?.perUserPerMonth ?? 20);

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    const userRequests = requests.filter(
      (r) =>
        r.userId === user.id &&
        r.status !== "cancelled"
    );

    const todayCount = userRequests.filter(
      (r) => String(r.createdAt || "").slice(0, 10) === today
    ).length;

    const monthlyCount = userRequests.filter(
      (r) => String(r.createdAt || "").slice(0, 7) === currentMonth
    ).length;

    if (todayCount >= dailyLimit) {
      alert(`ส่งคำร้องได้สูงสุด ${dailyLimit} เรื่องต่อวัน`);
      return;
    }

    if (monthlyCount >= monthlyLimit) {
      alert(`ส่งคำร้องได้สูงสุด ${monthlyLimit} เรื่องต่อเดือน`);
      return;
    }

    setReportSending(true);

    const after =
      reportForm.roomId != null
        ? {
            name: String(reportForm.name ?? "").trim(),
            type: String(reportForm.type ?? "").trim(),
            capacity:
              reportForm.capacity === "" || reportForm.capacity == null
                ? null
                : Number(reportForm.capacity),
            teacher: String(reportForm.teacher ?? "").trim(),
          }
        : {
            name: String(reportForm.name ?? "").trim(),
          };

    try {
      await createRequest({
        userId: user.id,
        roomId: reportForm.roomId,
        nodeId: reportForm.nodeId,
        subject: reportForm.subject?.trim() || "แจ้งแก้ไขข้อมูลสถานที่",
        detail: reportForm.note.trim(),
        before: reportForm.before,
        after,
        status: "pending",
      });

      alert("ส่งคำร้องแจ้งปัญหาเรียบร้อย รอผู้ดูแลระบบตรวจสอบ");
      setReportOpen(false);
      setReportForm(null);
    } catch (e) {
      console.error("submitReport error:", e);
      alert(`ส่งคำร้องไม่สำเร็จ: ${e.message}`);
    } finally {
      setReportSending(false);
    }
  }


  // เปิด/ปิดเลเยอร์บนแผนที่ตาม chip (ทางเชื่อม/skywalk, ห้องน้ำ) — ตัด Street light chip ออกแล้ว
  function toggleChip(k) {
    setChips((p) => ({ ...p, [k]: !p[k] }));
  }
  function WalkIcon() {
    return (
      <svg width="10" height="17" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0.75 16.125L2.85 5.55L1.5 6.075V8.625H0V5.1L3.7875 3.4875C3.9625 3.4125 4.14687 3.36875 4.34062 3.35625C4.53437 3.34375 4.71875 3.36875 4.89375 3.43125C5.06875 3.49375 5.23438 3.58125 5.39062 3.69375C5.54688 3.80625 5.675 3.95 5.775 4.125L6.525 5.325C6.85 5.85 7.29063 6.28125 7.84688 6.61875C8.40313 6.95625 9.0375 7.125 9.75 7.125V8.625C8.875 8.625 8.09375 8.44375 7.40625 8.08125C6.71875 7.71875 6.13125 7.25625 5.64375 6.69375L5.175 9L6.75 10.5V16.125H5.25V11.25L3.675 10.05L2.325 16.125H0.75V16.125M5.625 3C5.2125 3 4.85938 2.85313 4.56563 2.55938C4.27188 2.26563 4.125 1.9125 4.125 1.5C4.125 1.0875 4.27188 0.734375 4.56563 0.440625C4.85938 0.146875 5.2125 0 5.625 0C6.0375 0 6.39062 0.146875 6.68437 0.440625C6.97812 0.734375 7.125 1.0875 7.125 1.5C7.125 1.9125 6.97812 2.26563 6.68437 2.55938C6.39062 2.85313 6.0375 3 5.625 3V3" fill="currentColor" />
      </svg>
    );
  }
  function ToiletIcon() {
    return (
      <svg width="13" height="17" viewBox="0 0 13 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.8333 10.3214H0C0 11.2321 0.0910001 11.7231 0.928571 12.75C1.32003 13.2299 2.47619 13.9643 3.09524 14.2679C2.99206 14.6726 3.09524 14.875 2.47619 15.7857C2.23338 16.1429 2.16667 16.0893 1.54762 17H11.7619L10.8333 15.7857C10.627 15.381 9.90476 14.2679 9.90476 13.6607V12.75C10.1111 12.4464 10.2143 12.1429 10.5238 11.5357C10.6804 11.2285 10.8333 10.625 10.8333 10.3214Z" fill="currentColor" />
        <path d="M13 2.125H6.80952V7.89286H0V9.80188H12C12.5523 9.80188 13 9.35417 13 8.80188V2.125Z" fill="currentColor" />
        <path d="M13 1.51786H6.80951V1C6.80951 0.447715 7.25722 0 7.80951 0H12C12.5523 0 13 0.447716 13 1V1.51786Z" fill="currentColor" />
      </svg>
    );
  }
  const CHIP_DEFS = [
    { k: "room", icon: () => <span>🚪</span>, label: "ห้องเรียน" },
    { k: "toilet", icon: ToiletIcon, label: "ห้องน้ำ" },
    { k: "lift", icon: () => <span>🛗</span>, label: "ลิฟต์" },
    { k: "stairs", icon: () => <span>🪜</span>, label: "บันได" },
  ];
  // 🗂️ หมวด chip -> node type จริงที่ปักไว้ใน mapConstants.js — ใช้กรองว่าจะโชว์ node ประเภทไหนบนแผนที่บ้าง
  const CHIP_NODE_TYPES = {
    room: ["Study_Room", "Co_Work"],
    toilet: ["Toilet"],
    lift: ["lift"],
    stairs: ["Stair"],
  };

  const navTarget = active ?? (routeData && !routeData.error && !routeData.loading ? routeData.best : null);

  return (
    <div className={"bdi-mapwrap " + (viewMode === "desktop" ? "force-desktop" : viewMode === "mobile" ? "force-mobile" : "auto")} style={{ position: "relative", height: "100%", width: "100%" }}>
      <style>{`
        .bdi-mapwrap{
          --gm-blue:#1A73E8;--gm-blue-dark:#1967D2;--gm-blue-soft:#E8F0FE;
          --gm-green:#188038;--gm-red:#D93025;--gm-yellow:#F9AB00;
          --gm-text:#202124;--gm-muted:#5F6368;--gm-line:#DADCE0;--gm-bg:#F8F9FA;
          --bdi-surface:#FFFFFF;--bdi-surface-2:#F8F9FA;--bdi-text:#202124;--bdi-text-dim:#5F6368;
          --bdi-line:#DADCE0;--bdi-green:#1A73E8;--bdi-danger:#D93025;
          font-family:Roboto,Arial,"Noto Sans Thai",sans-serif;background:#FFFFFF;color:var(--gm-text);
          -webkit-font-smoothing:antialiased;
        }
        .bdi-mapwrap *{box-sizing:border-box}
        .bdi-mapwrap button,.bdi-mapwrap input{font:inherit}
        .bdi-mapwrap .leaflet-control-zoom{border:0!important;box-shadow:0 1px 6px rgba(60,64,67,.30)!important;border-radius:8px!important;overflow:hidden;margin-right:12px!important;margin-bottom:140px!important}
        .bdi-mapwrap .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;color:#3C4043!important;background:#fff!important;border-color:#E8EAED!important;font-size:22px!important;font-weight:400!important}
        .bdi-mapwrap .leaflet-control-zoom a:hover{background:#F8F9FA!important}
        .bdi-mapwrap .leaflet-control-attribution{background:rgba(255,255,255,.9)!important;color:#5F6368!important;font-size:10px!important}
        .bdi-mapwrap .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 3px 14px rgba(60,64,67,.30);color:#202124;padding:3px}
        .bdi-mapwrap .leaflet-popup-content{margin:12px 14px;line-height:1.45}
        .bdi-mapwrap .leaflet-popup-tip{box-shadow:2px 2px 4px rgba(60,64,67,.12)}
        .wb-card,.bdi-card{background:#fff;border:0;color:var(--gm-text);box-shadow:0 2px 8px rgba(60,64,67,.28);font-family:inherit}
        .wb-card{position:absolute;z-index:1000}
        .wb-search{left:12px;right:12px;top:calc(54px + env(safe-area-inset-top));padding:0;z-index:2000;border-radius:12px;overflow:visible}
        .gm-search-collapsed{height:52px;display:flex!important;align-items:center;gap:13px;padding:0 16px;cursor:pointer;border-radius:12px;background:#fff;min-width:0}
        .gm-menu{width:22px;height:22px;display:grid;place-items:center;color:#5F6368;font-size:20px}
        .gm-search-text{flex:1;min-width:0;font-size:16px;color:#3C4043;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gm-avatar{width:30px;height:30px;border-radius:50%;background:#1A73E8;color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px}
        .gm-search-open{padding:12px;border-radius:12px;background:#fff}
        .gm-search-head{display:flex;align-items:center;gap:9px;margin-bottom:9px}
        .gm-back{width:36px;height:36px;border:0;background:transparent;border-radius:50%;cursor:pointer;color:#5F6368;font-size:21px}
        .gm-back:hover{background:#F1F3F4}
        .gm-route-inputs{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:32px}
        .gm-route-inputs:before{content:"";position:absolute;left:14px;top:18px;bottom:18px;border-left:2px dotted #9AA0A6}
        .gm-origin-dot,.gm-dest-pin{position:absolute;left:8px;z-index:2;background:#fff}
        .gm-origin-dot{top:14px;width:12px;height:12px;border:3px solid #5F6368;border-radius:50%}
        .gm-dest-pin{bottom:13px;width:12px;height:12px;background:#D93025;border-radius:50% 50% 50% 0;transform:rotate(-45deg)}
        .gm-search-action{width:100%;margin-top:10px;height:42px;border-radius:21px}
        .wb-nav{top:0;left:0;right:0;border-radius:0 0 16px 16px;background:#1A73E8;color:#fff;padding:calc(32px + env(safe-area-inset-top)) 16px 14px;z-index:1700;border:none;box-shadow:0 3px 12px rgba(26,115,232,.35)}
        .wb-startbtn{display:block;width:100%;margin-top:8px;padding:12px;border:none;border-radius:22px;background:#1A73E8;color:#fff;font-weight:600;font-size:14px;cursor:pointer;box-shadow:none;transition:background .15s ease}
        .wb-startbtn:hover,.bdi-btn:hover{background:#1967D2}
        .bdi-btn{border:0;border-radius:20px;background:#1A73E8;color:#fff;padding:10px 18px;font-weight:600;cursor:pointer;transition:background .15s ease}
        .bdi-btn.ghost{background:#E8F0FE!important;color:#1967D2!important}
        .bdi-chips{position:absolute;left:12px;right:8px;z-index:1250;display:flex;gap:8px;overflow-x:auto;padding:2px 4px 8px 0;scrollbar-width:none}
        .bdi-chips::-webkit-scrollbar{display:none}
        .bdi-chip{height:36px;white-space:nowrap;border:1px solid #DADCE0;border-radius:18px;background:#fff;color:#3C4043;padding:0 14px;font-size:13px;font-weight:500;box-shadow:0 1px 3px rgba(60,64,67,.20);cursor:pointer;display:flex;align-items:center;gap:6px}
        .bdi-chip:hover{background:#F8F9FA}
        .bdi-chip.on{background:#E8F0FE;border-color:#AECBFA;color:#1967D2}
        .gm-bottom-stack{position:absolute;left:0!important;right:0!important;bottom:0!important;z-index:1300!important;gap:0!important}
        .gm-route-sheet{max-height:44vh!important;border-radius:18px 18px 0 0!important;padding:0 16px calc(12px + env(safe-area-inset-bottom))!important;overflow:auto!important;box-shadow:0 -2px 12px rgba(60,64,67,.22)!important;background:linear-gradient(135deg,#dbeafe 0%,#e0e7ff 52%,#ede9fe 100%)!important}
        .bdi-sheet-handle{display:flex;justify-content:space-between;align-items:center;cursor:pointer;border-radius:18px 18px 0 0;min-height:54px;font-weight:600}
        .bdi-sheet-handle:before{content:"";position:absolute;top:7px;left:50%;transform:translateX(-50%);width:36px;height:4px;border-radius:2px;background:#DADCE0}
        .bdi-route-opt{width:100%;box-sizing:border-box;text-align:left;background:#fff;border:0;cursor:pointer;border-top:1px solid #ECEFF1;border-radius:0;padding:14px 2px;margin:0;color:#202124;cursor:pointer}
        .bdi-route-opt:first-of-type{border-top:0}
        .bdi-route-opt.on{background:#F8FBFF;box-shadow:inset 4px 0 0 #1A73E8;padding-left:12px}
        .bdi-badge{display:inline-flex;align-items:center;border-radius:4px;background:#E8F0FE;color:#1967D2;padding:3px 7px;font-size:11px;font-weight:600}
        .bdi-stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;color:#5F6368;font-size:12px}
        .bdi-cross-ic{width:12px;height:12px;border-radius:50%;background:#1A73E8;border:2px solid #fff;box-shadow:0 1px 4px rgba(60,64,67,.35)}
        .bdi-poi-icon{width:12px;height:12px;display:block;line-height:0;user-select:none;filter:drop-shadow(0 1px 2px rgba(255,255,255,.95)) drop-shadow(0 1px 1px rgba(0,0,0,.22))}.bdi-poi-icon svg{display:block;width:12px;height:12px}
        .bdi-lift,.bdi-wc,.bdi-esc{background:#fff;color:#1A73E8;border:1px solid #AECBFA;box-shadow:0 1px 4px rgba(60,64,67,.25)}
        .bdi-lift{width:17px;height:17px;border-radius:4px;display:grid;place-items:center;font-size:12px;font-weight:800}
        .bdi-wc{padding:1px 3px;border-radius:4px;font-size:9px;font-weight:800}
        .bdi-esc{width:14px;height:16px;border-radius:3px;position:relative}
        .gm-fab{position:absolute;right:12px;z-index:1200;width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#1A73E8;font-size:22px;display:grid;place-items:center;cursor:pointer;box-shadow:0 2px 8px rgba(60,64,67,.3)}
        .gm-fab:hover{background:#F8F9FA}
        input:focus{border-color:#1A73E8!important;box-shadow:0 0 0 1px #1A73E8!important;outline:none!important}
        @media(min-width:760px){
          .bdi-mapwrap.auto .wb-search{right:auto;width:392px}
          .bdi-mapwrap.auto .bdi-chips{right:auto;width:620px}
          .bdi-mapwrap.auto .gm-bottom-stack{left:12px!important;right:auto!important;bottom:12px!important;width:420px}
          .bdi-mapwrap.auto .gm-route-sheet{border-radius:18px!important;max-height:52vh!important}
        }
        /* 🖥️/📱 บังคับ layout ผ่านปุ่มมุมขวาบน — ไม่รอขนาดจอจริงแล้ว (ใช้แทน @media ด้านบนตอนกดเลือกโหมดเอง) */
        .bdi-mapwrap.force-desktop .wb-search{right:auto;width:392px}
        .bdi-mapwrap.force-desktop .bdi-chips{right:auto;width:620px}
        .bdi-mapwrap.force-desktop .gm-bottom-stack{left:12px!important;right:auto!important;bottom:12px!important;width:420px}
        .bdi-mapwrap.force-desktop .gm-route-sheet{border-radius:18px!important;max-height:52vh!important}
      `}</style>


      <div ref={mapEl} style={{ height: "100%", width: "100%" }} />

      {nav?.active ? (
        <div className="wb-card wb-nav">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              {nav.arrived ? (
                <div style={{ fontSize: 20, fontWeight: 800 }}>🎉 ถึงปลายทางแล้ว</div>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{nav.instr}</div>
                  {nav.distTurn != null ? <div style={{ fontSize: 14, opacity: 0.9 }}>อีก {nav.distTurn} ม. · เหลือถึงปลายทาง {nav.distDest} ม.</div> : <div style={{ fontSize: 13, opacity: 0.9 }}>{nav.distDest != null ? `เหลือ ${nav.distDest} ม.` : ""}</div>}
                </>
              )}
              {nav.cross ? <div style={{ marginTop: 6, background: "#e9a23b", borderRadius: 6, padding: "5px 8px", fontWeight: 700, fontSize: 14 }}>🚸 เตรียมข้ามถนน อีก ~{nav.cross.dist} ม.</div> : null}
              {nav.hazard ? <div style={{ marginTop: 6, background: "#c1121f", borderRadius: 6, padding: "5px 8px", fontWeight: 700, fontSize: 14 }}>⚠️ ระวัง {nav.hazard.label} อีก ~{nav.hazard.dist} ม.</div> : null}
              {nav.toilet ? <div style={{ marginTop: 6, background: "#0f8a8a", borderRadius: 6, padding: "5px 8px", fontWeight: 700, fontSize: 14 }}>🚻 ห้องน้ำข้างหน้า ~{nav.toilet.dist} ม.{nav.toilet.off ? ` (เบี่ยงจากทาง ~${nav.toilet.off} ม.)` : ""}{nav.toilet.where ? ` · ${nav.toilet.where}` : ""}</div> : null}
              {nav.transit ? <div style={{ marginTop: 6, background: "#8E24AA", borderRadius: 6, padding: "5px 8px", fontWeight: 700, fontSize: 14 }}>{nav.transit.type === "lift" ? "🛗" : "⬆"} {nav.transit.label} ~{nav.transit.dist} ม.</div> : null}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={toggleVoiceLang} style={{ background: "rgba(255,255,255,.25)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{voiceLang === "en" ? "EN" : "ไทย"}</button>
              <button onClick={toggleVoice} style={{ background: "rgba(255,255,255,.25)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 11px", fontWeight: 700, cursor: "pointer", fontSize: 16 }}>{voice ? "🔊" : "🔇"}</button>
              <button onClick={stopNav} style={{ background: "rgba(255,255,255,.25)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>หยุด</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ค้นหาสถานที่ปกติก่อน — หลังเลือกสถานที่จึงค่อยเปิดฟอร์มต้นทาง/ปลายทางเดิม */}
      {!nav?.active ? (
        <div className="wb-card wb-search">
          {!searchOpen ? (
            <div className="gm-search-collapsed" onClick={() => { setRouteFormOpen(false); setSearchOpen(true); }}>
              <span className="gm-avatar">P</span>
              <span className="gm-search-text">{searchQuery || "ค้นหาสถานที่"}</span>
              <span className="gm-menu">⌕</span>
            </div>
          ) : routeFormOpen ? (
            <div className="gm-search-open">
              <div className="gm-search-head">
                <button className="gm-back" onClick={() => { setRouteFormOpen(false); setSearchOpen(false); }} aria-label="ย้อนกลับ">←</button>
                <div style={{ fontSize: 16, fontWeight: 600 }}>เส้นทางไป {sTo}</div>
              </div>
              <div className="gm-route-inputs">
                <span className="gm-origin-dot" />
                <span className="gm-dest-pin" />
                <PlaceInput value={sFrom} onChange={setSFrom} onEnter={doSearch} onPick={async (sg) => { let coord = sg.coord; if (sg.src === "landmark" && sg.lm) { try { const r = await resolveLandmark(sg.lm); if (r?.coord) coord = r.coord; } catch (e) {} } setSFrom(sg.name); ctx.current.placeCache[sg.name] = { coord, name: sg.name }; }} placeholder="ตำแหน่งของคุณ" />
                <PlaceInput value={sTo} onChange={setSTo} onEnter={doSearch} onPick={async (sg) => { let coord = sg.coord; if (sg.src === "landmark" && sg.lm) { try { const r = await resolveLandmark(sg.lm); if (r?.coord) coord = r.coord; } catch (e) {} } setSTo(sg.name); ctx.current.placeCache[sg.name] = { coord, name: sg.name }; }} placeholder="ปลายทาง" />
              </div>
              <button className="bdi-btn gm-search-action" onClick={doSearch}>ค้นหาเส้นทาง</button>
            </div>
          ) : (
            <div className="gm-search-open">
              <div className="gm-search-head">
                <button className="gm-back" onClick={() => setSearchOpen(false)} aria-label="ย้อนกลับ">←</button>
                <div style={{ fontSize: 16, fontWeight: 600 }}>ค้นหาสถานที่</div>
              </div>
              <SearchPlaceInput
                value={searchQuery}
                onChange={setSearchQuery}
                events={events}
                rooms={rooms}
                placeholder="ค้นหาตึก ห้อง กิจกรรม ลิฟต์ หรือห้องน้ำ"
                onPick={async (sg) => {
                  if (sg.src === "event" && sg.event) {
                    openEventCard(sg.event);
                    return;
                  }

                  let coord = sg.coord;

                  if (sg.src === "landmark" && sg.lm) {
                    try {
                      const r = await resolveLandmark(sg.lm);
                      if (r?.coord) coord = r.coord;
                    } catch (e) {}
                  }

                  openPlaceCard(sg.name, coord, sg);
                }}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* ข้อมูลสถานที่แบบ bottom sheet — แผนที่ยังมองเห็นตรงกลาง และ node ถูกจัดให้อยู่กลางพื้นที่แผนที่ */}
      {placeCard ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2100, padding: "0 10px calc(10px + env(safe-area-inset-bottom))", pointerEvents: "none" }}>
          <div style={{ width: "min(520px, 100%)", margin: "0 auto", background: "#FFFFFF", borderRadius: "20px 20px 14px 14px", overflow: "hidden", boxShadow: "0 -4px 24px rgba(32,33,36,.28)", pointerEvents: "auto" }}>
            <div style={{ width: 38, height: 4, borderRadius: 999, background: "#DADCE0", margin: "9px auto 4px" }} />
            {placeCard.image ? (
              <img src={placeCard.image} alt={placeCard.name} style={{ width: "100%", height: 125, objectFit: "cover", display: "block" }} />
            ) : null}
            <div style={{ padding: "13px 16px 15px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 25, lineHeight: 1 }}>{placeCard.icon || "📍"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#202124" }}>{placeCard.name}</div>
                  {placeCard.nodeId ? <div style={{ marginTop: 3, fontSize: 11.5, color: "#5F6368" }}>ชั้น {placeCard.floor || KMITL_NODE_FLOOR[placeCard.nodeId] || "1"} · node: {placeCard.nodeId}</div> : null}
                </div>
                <button onClick={() => setPlaceCard(null)} aria-label="ปิด" style={{ width: 32, height: 32, borderRadius: "50%", border: 0, background: "#F1F3F4", color: "#5F6368", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
              <div style={{ fontSize: 13.5, color: "#5F6368", lineHeight: 1.55, marginTop: 9, maxHeight: 70, overflowY: "auto" }}>
                {placeCard.loading ? "กำลังค้นหาข้อมูล…" : placeCard.extract || "ไม่พบข้อมูลรายละเอียดของสถานที่นี้"}
              </div>
              <button onClick={navigateFromCard} style={{ width: "100%", marginTop: 13, padding: "12px 0", border: "none", borderRadius: 12, background: "#1A73E8", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                <CompassIcon size={16} color="#fff" /> เส้นทางไปที่นี่
              </button>
              <button onClick={openReportForm} style={{ width: "100%", marginTop: 8, padding: "11px 0", border: "1px solid #DADCE0", borderRadius: 12, background: "#fff", color: "#D93025", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                แจ้งปัญหา
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 🚩 ฟอร์มแจ้งปัญหา / ขอแก้ไขข้อมูลสถานที่ → ส่งเป็นคำร้องให้ฝ่ายดูแลระบบ */}
      {reportOpen && reportForm ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 2400, background: "rgba(32,33,36,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "min(480px, 100%)", maxHeight: "82vh", overflowY: "auto", background: "#fff", borderRadius: "18px 18px 0 0", padding: "16px 18px calc(16px + env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <b style={{ fontSize: 16, color: "#202124" }}>แจ้งปัญหา</b>
              <button onClick={() => { setReportOpen(false); setReportForm(null); }} style={{ width: 30, height: 30, borderRadius: "50%", border: 0, background: "#F1F3F4", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: "#5F6368", marginBottom: 10 }}>{placeCard?.name}</div>

            {reportForm.roomId ? (
              <>
                {/* ข้อมูลปัจจุบันในระบบ (Original) */}
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 12,
                    background: "#F8F9FA",
                    border: "1px solid #E0E0E0",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: "#202124",
                      marginBottom: 10,
                    }}
                  >
                    ข้อมูลปัจจุบันในระบบ
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#5F6368" }}>
                      ชื่อสถานที่
                    </div>
                    <div style={{ fontSize: 14, color: "#202124" }}>
                      {reportForm.before?.name || "-"}
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#5F6368" }}>
                      ประเภท
                    </div>
                    <div style={{ fontSize: 14, color: "#202124" }}>
                      {reportForm.before?.type || "-"}
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#5F6368" }}>
                      ความจุ (คน)
                    </div>
                    <div style={{ fontSize: 14, color: "#202124" }}>
                      {reportForm.before?.capacity ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#5F6368" }}>
                      อาจารย์ประจำห้อง
                    </div>
                    <div style={{ fontSize: 14, color: "#202124" }}>
                      {reportForm.before?.teacher || "-"}
                    </div>
                  </div>
                </div>

                {/* ข้อมูลที่ต้องการแก้ไข (Proposed) */}
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 12,
                    background: "#FFFFFF",
                    border: "1px solid #DADCE0",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: "#202124",
                      marginBottom: 12,
                    }}
                  >
                    ข้อมูลที่ต้องการแก้ไข
                  </div>

                  <Field label="หัวข้อ">
                    <Input
                      placeholder="เช่น ขอแก้ไขข้อมูลห้อง 211"
                      onChange={(e) =>
                        setReportForm((f) => ({
                          ...f,
                          subject: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="ชื่อสถานที่">
                    <Input
                      placeholder="เช่น ห้อง 211"
                      onChange={(e) =>
                        setReportForm((f) => ({
                          ...f,
                          name: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="ประเภท">
                    <Input
                      placeholder="เช่น ห้องปฏิบัติการ"
                      // value={reportForm.type}
                      onChange={(e) =>
                        setReportForm((f) => ({
                          ...f,
                          type: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="ความจุ (คน)">
                    <Input
                      type="number"
                      placeholder="เช่น 40 (กรุณากรอกเป็นตัวเลข)"
                      onChange={(e) =>
                        setReportForm((f) => ({
                          ...f,
                          capacity: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="อาจารย์ประจำห้อง">
                    <Input
                      placeholder="เช่น ผศ.ดร.นพดล ชัยโย"
                      onChange={(e) =>
                        setReportForm((f) => ({
                          ...f,
                          teacher: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </>
            ) : null}

            {/* แก้ถึงนี่ */}
            <Field label="รายละเอียดเพิ่มเติม">
              <Textarea value={reportForm.note} onChange={(e) => setReportForm((f) => ({ ...f, note: e.target.value }))} placeholder="อธิบายสิ่งที่ผิดหรือสิ่งที่ต้องการให้แก้ไข" />
            </Field>

            <Btn onClick={submitReport} disabled={reportSending} style={{ width: "100%", marginTop: 6 }}>
              {reportSending ? "กำลังส่ง…" : "ส่งคำร้อง"}
            </Btn>
          </div>
        </div>
      ) : null}

      {/* 🎪 การ์ดรายละเอียดกิจกรรม — ข้อมูลตามที่ฝ่ายประชาสัมพันธ์กรอกไว้ + ปุ่มกดสนใจ */}
      {eventCard ? (() => {
        const on = !!myInterest(eventCard.id);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2200, padding: "0 10px calc(10px + env(safe-area-inset-bottom))", pointerEvents: "none" }}>
            <div style={{ width: "min(520px, 100%)", margin: "0 auto", background: "#FFFFFF", borderRadius: "20px 20px 14px 14px", overflow: "hidden", boxShadow: "0 -4px 24px rgba(32,33,36,.28)", pointerEvents: "auto" }}>
              <div style={{ width: 38, height: 4, borderRadius: 999, background: "#DADCE0", margin: "9px auto 4px" }} />
              <div style={{ padding: "10px 16px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ width: 40, height: 40, flex: "none", borderRadius: "50%", background: "#1A73E8", display: "grid", placeItems: "center" }}>
                    <span style={{ width: 21, height: 21, background: "#fff", WebkitMask: `url('${EVENT_PIN_ICON}') center/contain no-repeat`, mask: `url('${EVENT_PIN_ICON}') center/contain no-repeat` }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#202124" }}>{eventCard.name}</div>
                    <div style={{ marginTop: 3, fontSize: 11.5, color: "#5F6368" }}>กิจกรรมจากฝ่ายประชาสัมพันธ์</div>
                  </div>
                  <button onClick={() => setEventCard(null)} aria-label="ปิด" style={{ width: 32, height: 32, borderRadius: "50%", border: 0, background: "#F1F3F4", color: "#5F6368", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>

                <div style={{ fontSize: 13.5, color: "#3C4043", lineHeight: 1.6, marginTop: 10, maxHeight: 92, overflowY: "auto" }}>
                  {eventCard.detail || "ไม่มีรายละเอียดเพิ่มเติม"}
                </div>

                <div style={{ fontSize: 12.5, color: "#5F6368", lineHeight: 1.8, marginTop: 10 }}>
                  🕘 {fmtEventTime(eventCard.startAt)} — {fmtEventTime(eventCard.endAt)}<br />
                  📍 {eventCard.placeName || "ไม่ระบุสถานที่"}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => toggleInterest(eventCard)}
                    style={{ flex: 1, padding: "12px 0", border: on ? "1px solid #D93025" : "none", borderRadius: 12, background: on ? "#FCE8E6" : "#D93025", color: on ? "#D93025" : "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>
                    {on ? "✓ สนใจแล้ว — กดเพื่อยกเลิก" : "⭐ สนใจเข้าร่วมกิจกรรม"}
                  </button>
                  <button
                    onClick={() => { setEventCard(null); openPlaceCard(eventCard.placeName || eventCard.name, [Number(eventCard.lon), Number(eventCard.lat)], {}); }}
                    style={{ flex: "none", padding: "12px 16px", border: "1px solid #DADCE0", borderRadius: 12, background: "#fff", color: "#1A73E8", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    <CompassIcon size={15} color="#1A73E8" /> เส้นทาง
                  </button>
                </div>

                {on ? <div style={{ fontSize: 11.5, color: "#D93025", marginTop: 9, fontWeight: 700 }}>กิจกรรมนี้จะแสดงเป็นหมุดสีแดงเด่นบนแผนที่ตลอดเวลา</div> : null}
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* Chips เปิด/ปิดเลเยอร์ (ทางเชื่อม/Skywalk, ห้องน้ำ) */}
      {!nav?.active ? (
        <div className="bdi-chips" style={{ top: `calc(${searchOpen ? (routeFormOpen ? 286 : 190) : 114}px + env(safe-area-inset-top))` }}>
          {CHIP_DEFS.map((c) => (
            <button type="button" key={c.k} className={"bdi-chip" + (chips[c.k] ? " on" : "")} onClick={() => toggleChip(c.k)}><c.icon />{c.label}</button>
          ))}
        </div>
      ) : null}

      {/* แผงล่าง: ชีตรายละเอียดเส้นทาง (พับได้ ดีฟอลต์พับ) — ตัดการ์ดสไลเดอร์เวลาออกแล้ว (นำทางปกติ ไม่มีกลางวัน/กลางคืน) */}
      {routeData && !nav?.active ? (
        <div className="gm-bottom-stack" style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 1300, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="bdi-card gm-route-sheet" style={{ maxHeight: "38vh", overflow: "auto", padding: "0 14px 10px" }}>
          <div className="bdi-sheet-handle" onClick={() => setRouteSheetOpen((v) => !v)} style={{ position: "sticky", top: 0, background: "rgba(255,255,255,.72)", backdropFilter: "blur(10px)", margin: "0 -16px", padding: "18px 16px 10px", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{routeData.loading ? "กำลังหาเส้นทาง…" : "รายละเอียดเส้นทาง"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--bdi-green)", fontSize: 15 }}>{routeSheetOpen ? "⌄" : "⌃"}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation(); // กันไม่ให้ toggle sheet open/close ไปด้วย
                  setSFrom(""); setSTo(""); setSearchQuery(""); setRouteData(null);
                  const c = ctx.current; c.routeKey = null; c.scored = null; c.routeLayer?.clearLayers?.();
                }}
                title="ล้างการค้นหา"
                style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: "50%", color: "#5F6368", fontSize: 16, cursor: "pointer" }}>✕</span>
            </div>
          </div>
          {routeSheetOpen ? (routeData.loading ? <div style={{ fontSize: 13, color: "var(--bdi-text-dim)" }}>กำลังคำนวณเส้นทาง…</div> : routeData.error ? <div style={{ fontSize: 12, color: "var(--bdi-danger)" }}>ใช้ไม่ได้: {routeData.error}</div> : (
            <div>
              <div style={{ fontSize: 12.5, color: "var(--bdi-text-dim)", marginBottom: 6 }}>{routeData.startName || "Sc8"} → {routeData.endName || "ปลายทาง"}</div>
              {routeData.graphOk === false ? <div style={{ fontSize: 11, color: "#f4b860", marginTop: 4 }}>⏳ โครงข่ายทางเท้า OSM กำลังโหลด — เส้นแนะนำจะแม่นขึ้นอัตโนมัติเมื่อพร้อม</div> : null}
              {routeData.routes[routeData.best] ? (() => {
                const r = routeData.routes[routeData.best];
                return (
                  <div role="button" tabIndex={0} onClick={() => ctx.current.select(r.index)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctx.current.select(r.index); } }}
                    className={"bdi-route-opt" + (active === r.index ? " on" : "")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="bdi-badge"><CompassIcon size={13} color="currentColor" /> เส้นทางแนะนำ</span>
                    </div>
                    <div className="bdi-stats">
                      <span>📏 {(r.distance_m / 1000).toFixed(2)} KM</span>
                      <span>🔥 {Math.round(r.distance_m * 0.053)} kcal</span>
                      <span>⏱ {r.duration_min} MINS</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={(e) => { e.stopPropagation(); startNav(r.index); }} className="bdi-btn" style={{ fontSize: 12, padding: "6px 12px" }}>🚶 เริ่มนำทาง</button>
                      <button onClick={(e) => { e.stopPropagation(); startSim(r.index); }} className="bdi-btn ghost" style={{ fontSize: 12, padding: "6px 12px" }}>▶ จำลอง</button>
                    </div>
                  </div>
                );
              })() : null}
            </div>
          )) : null}
          </div>
        </div>
      ) : null}

      {/* 🏢 แผงผังตึก Sc8 — เปิดเมื่อกดบริเวณ SVG ของอาคาร มีแถบเลือกชั้นด้านข้าง */}
      {kmitlOpen && !nav?.active ? (
        <>
          <div style={{ position: "absolute", top: 200, right: 14, zIndex: 1900, background: "#FFFFFF", border: "1px solid #DADCE0", borderRadius: 12, padding: "6px 12px", color: "#202124", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 10, maxWidth: 320 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
              <span>Sc8 · ชั้น {kmitlFloor}</span>
              {KMITL_FLOORS.find((x) => x.id === kmitlFloor)?.detail ? (
                <span style={{ fontWeight: 500, fontSize: 11.5, color: "#5F6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  · {KMITL_FLOORS.find((x) => x.id === kmitlFloor).detail}
                </span>
              ) : null}
            </span>
            <button onClick={() => setKmitlOpen(false)} style={{ background: "none", border: "none", color: "#5F6368", fontSize: 15, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>

          {/* เครื่องมือสำหรับผู้พัฒนา (ปรับตำแหน่งผัง / ปักหมุด / ทดสอบเส้นทาง) ถูกนำออกจากหน้าผู้ใช้ทั่วไป */}

          {!KMITL_FLOORS.find((x) => x.id === kmitlFloor)?.svg ? (
            <div style={{ position: "absolute", top: 196, left: 14, zIndex: 1900, background: "#FFFFFF", border: "1px solid #DADCE0", borderRadius: 12, padding: "8px 12px", color: "var(--bdi-text-dim)", fontSize: 12, maxWidth: 220 }}>
              ยังไม่มีไฟล์ผังของชั้นนี้
            </div>
          ) : null}
          <div style={{ position: "absolute", right: 10, top: "30%", zIndex: 1900, display: "flex", flexDirection: "column", gap: 8 }}>
            {KMITL_FLOORS.map((f) => (
              <button key={f.id} onClick={() => setKmitlFloor(f.id)}
                style={{ width: 38, height: 38, borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, boxShadow: "0 3px 10px rgba(0,0,0,.45)", background: kmitlFloor === f.id ? "#1A73E8" : "#FFFFFF", color: kmitlFloor === f.id ? "#fff" : "#3C4043", border: "1px solid #DADCE0", opacity: f.svg ? 1 : 0.55 }}>
                {f.label}
              </button>
            ))}
          </div>

        </>
      ) : null}

      {/* ปุ่ม relocate — กลับไปที่ตำแหน่งจริงของผู้ใช้ */}
      {!nav?.active ? (
        <button onClick={() => {
            const c = ctx.current, L = c.L, m = mapRef.current; if (!m) return;
            const goTo = (lon, lat) => {
              if (L) {
                if (!c.myLocMarker) {
                  c.myLocMarker = L.marker([lat, lon], { icon: L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 1px 8px rgba(26,115,232,.65)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 900 }).bindPopup("ตำแหน่งของฉัน").addTo(m);
                } else { c.myLocMarker.setLatLng([lat, lon]); }
              }
              m.setView([lat, lon], Math.max(m.getZoom(), 17), { animate: true });
            };
            if (!navigator.geolocation) {
              const r = c.scored?.[navTarget];
              if (r && L) m.fitBounds(L.polyline(r.coordinates.map(([lo, la]) => [la, lo])).getBounds().pad(0.2));
              else m.setView(CENTER, ZOOM);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => { c.myLocation = [pos.coords.longitude, pos.coords.latitude]; goTo(pos.coords.longitude, pos.coords.latitude); },
              () => {
                if (c.myLocation) { goTo(c.myLocation[0], c.myLocation[1]); return; }
                const r = c.scored?.[navTarget];
                if (r && L) m.fitBounds(L.polyline(r.coordinates.map(([lo, la]) => [la, lo])).getBounds().pad(0.2));
                else m.setView(CENTER, ZOOM);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
            );
          }}
          className="gm-fab" style={{ bottom: routeData ? (routeSheetOpen ? "58%" : 224) : 120 }}>◎</button>
      ) : null}

    </div>
  );
}