"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet, suggestPlaces, resolvePlace, geocodeNominatim, queuedReverse } from "./mapGeo";
import {
  CENTER, KMITL_ALL_NODES, KMITL_BOUNDS, KMITL_FLOORS, KMITL_NODE_FLOOR,
  KMITL_OUTLINE, WALKWAY_NODE_TYPES, getNodeType,
} from "./mapConstants";
import { Btn, Input, Pill } from "./ui";

// กล่องแผนที่สำหรับเลือกสถานที่จัดกิจกรรม
// ใช้ชั้นข้อมูลชุดเดียวกับแผนที่ของผู้ใช้งานทั่วไป — ขอบเขตอาคาร ผังชั้น (SVG)
// และหมุดห้อง/สิ่งอำนวยความสะดวกภายในอาคาร กดที่ห้องเพื่อเลือกเป็นสถานที่จัดงานได้เลย
// ไอคอน/ป้ายกำกับของจุดภายในอาคาร — ใช้ NODE_TYPES ใน mapConstants เป็นแหล่งเดียว
// (เดิมมีตาราง NODE_ICON ซ้ำไว้ที่นี่ ทำให้ต้องแก้สองที่ทุกครั้งที่เพิ่มประเภทใหม่)
const nodeIcon = (type) => getNodeType(type).icon || "📍";
// จุดประเภททางเดิน/เส้นทาง ไม่ต้องแสดงบนแผนที่เลือกสถานที่
const isWalkway = (type) => WALKWAY_NODE_TYPES.includes(String(type || "").toLowerCase());

export default function MapPicker({ value, onChange, height = 300 }) {
  const { placeName = "", lat = "", lon = "" } = value || {};
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const ctx = useRef({});
  const [q, setQ] = useState(placeName || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [indoor, setIndoor] = useState(true);          // เปิด/ปิดผังภายในอาคาร
  const [floor, setFloor] = useState("1");             // ชั้นที่กำลังแสดง
  const timer = useRef(null);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; onChangeRef.current = onChange; });

  const emit = (patch) => onChangeRef.current?.({ ...(valueRef.current || {}), ...patch });

  // ── สร้างแผนที่ครั้งเดียว ──
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = await loadLeaflet();
      if (dead || mapRef.current || !elRef.current) return;
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(CENTER, 17);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 21 }).addTo(map);

      // pane สำหรับวางผังชั้นให้อยู่เหนือ tile แต่ใต้หมุด
      if (!map.getPane("pickFloorPane")) {
        map.createPane("pickFloorPane");
        map.getPane("pickFloorPane").style.zIndex = "350";
        map.getPane("pickFloorPane").style.pointerEvents = "none";
      }

      // ขอบเขตอาคาร (ชุดเดียวกับแผนที่ผู้ใช้)
      L.polygon(KMITL_OUTLINE.map((p) => [p[1], p[0]]), {
        color: "#1A73E8", weight: 2, fillColor: "#1A73E8", fillOpacity: 0.06,
      }).addTo(map);

      ctx.current = { L, map, floorOverlay: null, nodeLayer: null, marker: null };
      mapRef.current = map;

      map.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng, true));
      setTimeout(() => map.invalidateSize(), 150);

      const v = valueRef.current || {};
      if (Number(v.lat)) setPin(Number(v.lat), Number(v.lon), false);
    })();
    return () => { dead = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ผังชั้น + หมุดห้องภายในอาคาร ──
  useEffect(() => {
    const { L, map } = ctx.current;
    if (!L || !map) return;

    if (ctx.current.floorOverlay) { map.removeLayer(ctx.current.floorOverlay); ctx.current.floorOverlay = null; }
    if (ctx.current.nodeLayer) { map.removeLayer(ctx.current.nodeLayer); ctx.current.nodeLayer = null; }
    if (!indoor) return;

    const f = KMITL_FLOORS.find((x) => x.id === floor);
    if (f?.svg) {
      ctx.current.floorOverlay = L.imageOverlay(f.svg, KMITL_BOUNDS, { opacity: 0.95, interactive: false, pane: "pickFloorPane" }).addTo(map);
    }

    // หมุดห้อง/สิ่งอำนวยความสะดวกของชั้นนี้ — กดเพื่อเลือกเป็นสถานที่จัดกิจกรรม
    // แสดงเฉพาะไอคอนล้วน ไม่มีกรอบ/พื้นหลัง และข้ามจุดประเภททางเดินซึ่งไม่ใช่สถานที่จัดงาน
    const group = L.layerGroup().addTo(map);
    for (const [id, n] of Object.entries(KMITL_ALL_NODES)) {
      if ((KMITL_NODE_FLOOR[id] || "1") !== floor) continue;
      if (!n.label) continue;
      if (isWalkway(n.type)) continue;
      const glyph = nodeIcon(n.type);
      const icon = L.divIcon({
        className: "",
        html: `<span style="font-size:17px;line-height:1;display:block;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(255,255,255,.95)) drop-shadow(0 1px 2px rgba(0,0,0,.28))">${glyph}</span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([n.lat, n.lon], { icon, title: n.label })
        .addTo(group)
        .on("click", (ev) => {
          ev.originalEvent?.stopPropagation?.();
          setQ(n.label);
          emit({ placeName: n.label });
          setPin(n.lat, n.lon, false);
        });
    }
    ctx.current.nodeLayer = group;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indoor, floor]);

  function setPin(la, lo, reverse) {
    const { L, map } = ctx.current;
    if (!L || !map) return;
    if (!ctx.current.marker) {
      ctx.current.marker = L.marker([la, lo], { draggable: true, zIndexOffset: 1000 }).addTo(map);
      ctx.current.marker.on("dragend", (ev) => {
        const p = ev.target.getLatLng();
        emit({ lat: +p.lat.toFixed(6), lon: +p.lng.toFixed(6) });
      });
    } else {
      ctx.current.marker.setLatLng([la, lo]);
    }
    map.setView([la, lo], Math.max(map.getZoom(), 18), { animate: true });
    emit({ lat: +Number(la).toFixed(6), lon: +Number(lo).toFixed(6) });
    // คลิกบนแผนที่เปล่า → ลองหาชื่อสถานที่มาเติมให้ (เติมเฉพาะตอนที่ยังไม่มีชื่อ จะได้ไม่ทับสิ่งที่ผู้ใช้พิมพ์เอง)
    if (reverse) {
      queuedReverse([lo, la])
        .then((g) => {
          // reverseGeocode คืนเป็น { road, place } ไม่ใช่ string — ต้องประกอบเป็นข้อความก่อนใช้
          const name = [g?.place, g?.road].filter(Boolean).join(" · ");
          if (name && !valueRef.current?.placeName?.trim()) { setQ(name); emit({ placeName: name }); }
        })
        .catch(() => {});
    }
  }

  // ── แนะนำสถานที่ระหว่างพิมพ์: รวมห้อง/จุดในอาคาร + สถานที่จาก OSM ──
  function localMatches(text) {
    const k = text.trim().toLowerCase();
    const out = [];
    for (const [id, n] of Object.entries(KMITL_ALL_NODES)) {
      if (!n.label || !n.label.toLowerCase().includes(k)) continue;
      out.push({ name: n.label, coord: [n.lon, n.lat], src: "indoor", floor: KMITL_NODE_FLOOR[id] || "1" });
    }
    return out.slice(0, 5);
  }

  function onType(text) {
    setQ(text);
    emit({ placeName: text });   // ข้อความที่พิมพ์คือชื่อสถานที่ที่จะแสดง
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setItems([]); setOpen(false); return; }
    const local = localMatches(text);
    setItems(local); setOpen(local.length > 0);
    timer.current = setTimeout(async () => {
      const remote = await suggestPlaces(text).catch(() => []);
      const merged = [...local, ...(remote || []).filter((r) => !local.some((l) => l.name === r.name))];
      setItems(merged); setOpen(merged.length > 0);
    }, 340);
  }

  function pick(item) {
    setQ(item.name); setOpen(false);
    emit({ placeName: item.name });
    if (item.src === "indoor" && item.floor) { setIndoor(true); setFloor(item.floor); }
    setPin(item.coord[1], item.coord[0], false);
  }

  async function doSearch() {
    if (!q.trim()) return;
    const local = localMatches(q);
    if (local.length) { pick(local[0]); return; }
    setBusy(true); setOpen(false);
    const g = (await resolvePlace(q).catch(() => null)) || (await geocodeNominatim(q).catch(() => null));
    setBusy(false);
    if (!g) return alert(`ไม่พบสถานที่ "${q}" — ลองพิมพ์ชื่อให้ชัดขึ้น หรือคลิกปักหมุดบนแผนที่เอง`);
    pick({ name: g.name, coord: g.coord });
  }

  const set = (k) => (e) => {
    const v = e.target.value;
    emit({ [k]: v });
    const la = k === "lat" ? Number(v) : Number(lat);
    const lo = k === "lon" ? Number(v) : Number(lon);
    if (Number.isFinite(la) && Number.isFinite(lo) && la && lo) setPin(la, lo, false);
  };

  return (
    <div>
      {/* ── ช่องค้นหาสถานที่ (อยู่นอกกรอบแผนที่) ── */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#5F6368", marginBottom: 3 }}>
          สถานที่จัดกิจกรรม — ค้นหาหรือพิมพ์ชื่อเองได้
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            value={q}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }}
            placeholder="เช่น ห้อง 108, coworking, ลานหน้าตึกพระจอมเกล้าฯ"
          />
          <Btn onClick={doSearch} disabled={busy} style={{ flex: "none" }}>{busy ? "…" : "ค้นหา"}</Btn>
        </div>

        {open && items.length > 0 ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #DADCE0", borderRadius: 10, boxShadow: "0 4px 14px rgba(60,64,67,.25)", zIndex: 30, maxHeight: 230, overflowY: "auto" }}>
            {items.map((it, i) => (
              <button key={i} onClick={() => pick(it)}
                style={{ display: "flex", gap: 9, alignItems: "center", width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "10px 12px", borderBottom: i < items.length - 1 ? "1px solid #F1F3F4" : "none" }}>
                <span style={{ fontSize: 14 }}>{it.src === "indoor" ? "🚪" : it.src === "landmark" ? "⭐" : "📍"}</span>
                <span style={{ fontSize: 13, color: "#202124", flex: 1, minWidth: 0 }}>{it.name}</span>
                {it.src === "indoor" ? <Pill color="#1A73E8" bg="#E8F0FE">ในอาคาร · ชั้น {it.floor}</Pill> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── ชื่อสถานที่ + Lat/Lon อยู่ใต้ช่องค้นหา และเหนือแผนที่ ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "0 1 130px" }}>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#5F6368", marginBottom: 3 }}>Latitude</span>
          <Input value={lat} onChange={set("lat")} placeholder="13.729721" />
        </div>
        <div style={{ flex: "0 1 130px" }}>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#5F6368", marginBottom: 3 }}>Longitude</span>
          <Input value={lon} onChange={set("lon")} placeholder="100.780099" />
        </div>
      </div>

      {/* ── กรอบแผนที่ + แถบเลือกชั้น ── */}
      <div style={{ position: "relative", border: "1px solid #DADCE0", borderRadius: 12, overflow: "hidden" }}>
        <div ref={elRef} style={{ height, width: "100%" }} />

        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 500, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button onClick={() => setIndoor((v) => !v)}
            style={{ border: "1px solid #DADCE0", background: indoor ? "#E8F0FE" : "#fff", color: indoor ? "#1A73E8" : "#5F6368", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 1px 4px rgba(60,64,67,.28)" }}>
            🏢 ผังภายในอาคาร
          </button>
          {indoor ? (
            <div style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #DADCE0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(60,64,67,.28)" }}>
              {KMITL_FLOORS.map((f) => {
                const on = f.id === floor;
                return (
                  <button key={f.id} onClick={() => setFloor(f.id)} title={[`ชั้น ${f.label}`, f.detail, f.svg ? null : "(ยังไม่มีไฟล์ผัง)"].filter(Boolean).join(" · ")}
                    style={{ border: "none", borderBottom: "1px solid #F1F3F4", cursor: "pointer", width: 34, padding: "6px 0", fontSize: 12, fontWeight: 800,
                      background: on ? "#1A73E8" : "#fff", color: on ? "#fff" : f.svg ? "#3C4043" : "#BDC1C6" }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 5, lineHeight: 1.6 }}>
        เปิดผังภายในอาคารเพื่อเลือกชั้นและกดที่ห้องได้โดยตรง หรือคลิก/ลากหมุดบนแผนที่เพื่อปรับตำแหน่ง — ชื่อสถานที่และค่า Lat/Lon จะเติมให้อัตโนมัติ และพิมพ์แก้เองได้

      </div>
    </div>
  );
}
