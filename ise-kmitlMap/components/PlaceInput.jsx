"use client";

// 🔎 ช่องค้นหาสถานที่พร้อม autocomplete (แลนด์มาร์กยอดนิยมในเครื่อง + ผลจาก OSM)
import { useState, useRef } from "react";
import { LANDMARKS, suggestPlaces } from "./mapGeo";

export default function PlaceInput({ value, onChange, onPick, onEnter, placeholder }) {
  const [sugs, setSugs] = useState([]);
  const [open, setOpen] = useState(false);
  const tRef = useRef(null);
  function handle(v) {
    onChange(v);
    const ss = (v || "").trim().toLowerCase();
    if (tRef.current) clearTimeout(tRef.current);
    if (!v || ss.length < 2) { setSugs([]); setOpen(false); return; }
    // โชว์สถานที่ยอดนิยมในเครื่องทันที (ไม่รอเน็ต) แล้วค่อยเติมผลจาก OSM
    const local = LANDMARKS.filter((lm) => lm.aliases.some((a) => { const al = a.toLowerCase(); return al.includes(ss) || ss.includes(al); })).map((lm) => ({ name: lm.name, coord: lm.coord, src: "landmark", lm }));
    if (local.length) { setSugs(local); setOpen(true); }
    tRef.current = setTimeout(async () => { const r = await suggestPlaces(v); if (r.length) { setSugs(r); setOpen(true); } }, 250);
  }
  const istyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--bdi-line)", background: "#FFFFFF", color: "#202124", fontSize: 16, outline: "none" };
  return (
    <div style={{ position: "relative" }}>
      <input value={value} onChange={(e) => handle(e.target.value)} onFocus={() => { if (sugs.length) setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => { if (e.key === "Enter") { setOpen(false); onEnter && onEnter(); } }} placeholder={placeholder} style={istyle} />
      {open ? (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bdi-surface-2)", border: "1px solid var(--bdi-line)", borderRadius: 12, boxShadow: "0 2px 10px rgba(60,64,67,.28)", zIndex: 1400, maxHeight: 240, overflowY: "auto", marginTop: 2 }}>
          {sugs.map((sg, i) => (
            <div key={i} onMouseDown={() => { onPick(sg); setOpen(false); }}
              style={{ padding: "9px 11px", fontSize: 14, cursor: "pointer", borderBottom: "1px solid var(--bdi-line)", display: "flex", justifyContent: "space-between", gap: 8, color: "#202124" }}>
              <span>{sg.name}</span><span style={{ fontSize: 11, color: "var(--bdi-text-dim)" }}>{sg.src === "landmark" ? "⭐ ที่นิยม" : "OSM"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
