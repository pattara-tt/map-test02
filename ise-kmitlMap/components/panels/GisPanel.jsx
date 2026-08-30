"use client";

import { useState } from "react";
import { Btn, Card, Field, Input, Pill, Select, Status, Table, Textarea, UCHead, useCollection } from "../ui";

// Actor: ผู้ดูแลข้อมูลสถานที่และอาคาร — UC7 ขอบเขตแผนผัง · UC8 ข้อมูลประกอบแผนผัง · UC9 บันทึกข้อมูลแผนที่
export default function GisPanel({ uc, user }) {
  if (uc === "boundary") return <Boundary user={user} />;
  if (uc === "assets") return <Assets user={user} />;
  return <SaveMap user={user} />;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function Boundary({ user }) {
  const { items, create, patch, destroy } = useCollection("mapBoundaries");
  const [form, setForm] = useState({ name: "", type: "building", points: 4 });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <UCHead title="จัดการขอบเขตแผนผัง" desc="กำหนดขอบเขตวิทยาเขต/อาคารที่ใช้ตัดพื้นที่แสดงผลบนแผนที่ — ทุกการแก้ไขถูกบันทึกลงประวัติ" />

      <Card>
        <b style={{ fontSize: 13.5, color: "#202124" }}>เพิ่มขอบเขตใหม่</b>
        <div style={{ marginTop: 8 }}>
          <Field label="ชื่อขอบเขต"><Input value={form.name} onChange={set("name")} placeholder="เช่น ขอบเขตอาคารเรียนรวม" /></Field>
          <Field label="ประเภท">
            <Select value={form.type} onChange={set("type")}>
              <option value="campus">วิทยาเขต</option>
              <option value="building">อาคาร</option>
              <option value="zone">โซน/พื้นที่ย่อย</option>
            </Select>
          </Field>
          <Field label="จำนวนจุดพิกัด (points)"><Input type="number" value={form.points} onChange={set("points")} /></Field>
          <Btn onClick={async () => {
            if (!form.name.trim()) return alert("กรุณาระบุชื่อขอบเขต");
            await create({ ...form, points: Number(form.points), updatedAt: todayStr(), status: "draft" }, user);
            setForm({ name: "", type: "building", points: 4 });
          }}>เพิ่มขอบเขต</Btn>
        </div>
      </Card>

      <Table
        columns={[
          { key: "name", label: "ชื่อขอบเขต" },
          { key: "type", label: "ประเภท", render: (r) => <Pill>{r.type}</Pill> },
          { key: "points", label: "จุดพิกัด" },
          { key: "updatedAt", label: "แก้ไขล่าสุด" },
          { key: "status", label: "สถานะ", render: (r) => <Status value={r.status} /> },
          {
            key: "act", label: "",
            render: (r) => (
              <div style={{ display: "flex", gap: 6 }}>
                {r.status === "draft"
                  ? <Btn kind="ok" onClick={() => patch(r.id, { status: "published", updatedAt: todayStr() }, user)}>เผยแพร่</Btn>
                  : <Btn kind="ghost" onClick={() => patch(r.id, { status: "draft", updatedAt: todayStr() }, user)}>ถอนกลับร่าง</Btn>}
                <Btn kind="danger" onClick={() => confirm("ลบขอบเขตนี้?") && destroy(r.id, user)}>ลบ</Btn>
              </div>
            ),
          },
        ]}
        rows={items}
      />
    </>
  );
}

const MAX_SVG_BYTES = 3 * 1024 * 1024; // 3MB กันไฟล์ใหญ่เกินไป (เก็บเป็น data URL ในระบบ)

function Assets({ user }) {
  const { items, create, patch, destroy } = useCollection("mapAssets");
  const [form, setForm] = useState({ name: "", kind: "floorplan", building: "Sc8", floor: "1", file: "" });
  const [selectedFile, setSelectedFile] = useState(null); // { name, size }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // เผื่อผู้ใช้อยากเลือกไฟล์เดิมซ้ำ
    if (!file) return;
    setUploadError("");

    // ตรวจว่าเป็น .svg จริง (บางเบราว์เซอร์ไม่ส่ง MIME type มาให้ เลยเช็คนามสกุลไฟล์ประกอบด้วย)
    const isSvgType = file.type === "image/svg+xml" || file.type === "";
    const isSvgExt = /\.svg$/i.test(file.name);
    if (!isSvgType || !isSvgExt) {
      setUploadError("กรุณาเลือกไฟล์นามสกุล .svg เท่านั้น");
      return;
    }
    if (file.size > MAX_SVG_BYTES) {
      setUploadError("ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 3MB)");
      return;
    }

    setUploading(true);
    try {
      // อ่านไฟล์ SVG ให้เป็น data URL แล้วเก็บลง form.file โดยตรง — MapView ดึงค่านี้ไปแสดงบนแผนที่ได้ทันที
      // (imageOverlay ของ Leaflet และ <img src> รองรับ data URL อยู่แล้ว ไม่ต้องมี endpoint อัปโหลดไฟล์แยกต่างหาก)
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });
      setSelectedFile({ name: file.name, size: file.size });
      setForm((f) => ({ ...f, file: dataUrl }));
    } catch (err) {
      setUploadError("อัปโหลดไฟล์ไม่สำเร็จ: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setForm((f) => ({ ...f, file: "" }));
    setUploadError("");
  };

  return (
    <>
      <UCHead code="UC8" title="จัดการข้อมูลประกอบแผนผัง" desc="อัปโหลดไฟล์ผังชั้น (.svg) ภาพประกอบ และไอคอน ที่ใช้แสดงบนแผนที่ได้โดยตรงจากหน้านี้ — ระบบจะวางภาพให้พอดีกับขอบเขตของชั้นนั้นบนแผนที่โดยอัตโนมัติ จากนั้นไปที่ UC9 เพื่อกด 'เผยแพร่' ให้ขึ้นบนแผนที่ผู้ใช้งานจริง" />

      <Card>
        <b style={{ fontSize: 13.5, color: "#202124" }}>เพิ่มไฟล์ประกอบ</b>
        <div style={{ marginTop: 8 }}>
          <Field label="ชื่อรายการ"><Input value={form.name} onChange={set("name")} placeholder="เช่น ผังชั้น 3 อาคาร Sc8" /></Field>
          <Field label="ประเภท">
            <Select value={form.kind} onChange={set("kind")}>
              <option value="floorplan">ผังชั้น (SVG)</option>
              <option value="image">ภาพประกอบ</option>
              <option value="icon">ไอคอน</option>
            </Select>
          </Field>
          {form.kind === "floorplan" ? (
            <>
              <Field label="อาคาร"><Input value={form.building} onChange={set("building")} placeholder="Sc8" /></Field>
              <Field label="ชั้น">
                <Select value={form.floor} onChange={set("floor")}>
                  {["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => <option key={n} value={n}>ชั้น {n}</option>)}
                </Select>
              </Field>
            </>
          ) : null}
          <Field label="อัปโหลดไฟล์แผนผัง (.svg)">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px",
                borderRadius: 10, border: "1px solid #DADCE0", background: "#F8F9FA",
                color: "#1A73E8", fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}>
                📤 เลือกไฟล์ .svg
                <input type="file" accept=".svg,image/svg+xml" onChange={handleFileChange} style={{ display: "none" }} />
              </label>
              
              {uploading ? <span style={{ fontSize: 12, color: "#5F6368" }}>กำลังอ่านไฟล์...</span> : null}
              {selectedFile ? (
                <span style={{ fontSize: 12, color: "#3C4043" }}>
                  {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
                  <button type="button" onClick={clearSelectedFile} style={{ marginLeft: 8, background: "none", border: "none", color: "#D93025", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>ลบ</button>
                </span>
              ) : null}
            </div>
            {uploadError ? <div style={{ marginTop: 6, fontSize: 11.5, color: "#D93025" }}>{uploadError}</div> : null}

            {form.file ? (
              <div style={{ marginTop: 10, width: 140, height: 140, borderRadius: 10, border: "1px solid #DADCE0", background: "#F8F9FA", display: "grid", placeItems: "center", overflow: "hidden" }}>
                <img src={form.file} alt="ตัวอย่างผังชั้น" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#5F6368" }}>ยังไม่ได้เลือกไฟล์ — อัปโหลดภาพ .svg ของผังชั้นเพื่อดูตัวอย่างที่นี่</div>
            )}
          </Field>

          <Btn disabled={uploading} onClick={async () => {
            if (!form.name.trim()) return alert("กรุณาระบุชื่อรายการ");
            if (!form.file.trim()) return alert("กรุณาอัปโหลดไฟล์ .svg ก่อน");
            await create({ ...form, updatedAt: todayStr(), status: "draft" }, user);
            setForm({ name: "", kind: "floorplan", building: "Sc8", floor: "1", file: "" });
            setSelectedFile(null);
            setUploadError("");
          }}>เพิ่มไฟล์</Btn>

        </div>
      </Card>

      {items.map((a) => (
        <Card key={a.id}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 62, height: 62, flex: "none", borderRadius: 10, border: "1px solid #DADCE0", background: "#F8F9FA", overflow: "hidden", display: "grid", placeItems: "center" }}>
              <img src={a.file} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14, color: "#202124" }}>{a.name}</b>
              <div style={{ fontSize: 11.5, color: "#5F6368", wordBreak: "break-all" }}>
                {String(a.file || "").startsWith("data:") ? "📤 ไฟล์อัปโหลด (SVG)" : a.file}
              </div>
              <div style={{ marginTop: 5, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Pill>{a.kind}</Pill>
                {a.kind === "floorplan" ? <Pill>{(a.building || "Sc8")} · ชั้น {a.floor || "?"}</Pill> : null}
                <Status value={a.status || "draft"} />
                <span style={{ fontSize: 11, color: "#5F6368" }}>อัปเดต {a.updatedAt}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Btn kind="danger" onClick={() => confirm("ลบไฟล์ประกอบนี้?") && destroy(a.id, user)}>ลบ</Btn>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function SaveMap({ user }) {
  const { items, create, patch } = useCollection("mapDrafts");

  // ดึงข้อมูลจาก UC7 (mapBoundaries) และ UC8 (mapAssets) มาเช็คสถานะ
  const { items: assets = [], patch: patchAsset } = useCollection("mapAssets");
  const { items: boundaries = [], patch: patchBoundary } = useCollection("mapBoundaries");

  const [form, setForm] = useState({ name: "", note: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // กรองเฉพาะรายการที่เป็น draft เพื่อเอามาแสดงให้ผู้ใช้เห็นก่อนกดเผยแพร่
  // ดึงข้อมูลมาจาก mapAssets ซึ่งถูกแทนด้วย assets
  const draftAssets = assets.filter((a) => a.status === "draft");
  const draftBoundaries = boundaries.filter((b) => b.status === "draft");

  const handlePublish = async (draftId) => {
    if (!confirm("ยืนยันการเผยแพร่ข้อมูลแผนที่ ขอบเขต และไฟล์ประกอบทั้งหมดขึ้นระบบจริง?")) return;

    try {
      // 1. เปลี่ยนสถานะดราฟต์หลัก (mapDrafts) — patch ผูกกับ collection "mapDrafts" อยู่แล้ว
      //    (patch มี signature (id, patchObj, actor) เท่านั้น ห้ามใส่ชื่อ collection นำหน้า)
      await patch(draftId, { status: "published", updatedAt: todayStr() }, user);

      // 2. เปลี่ยนสถานะ UC8 (mapAssets) ทั้งหมดที่เป็น draft ให้เป็น published
      //    ต้องใช้ patchAsset ที่ผูกกับ collection "mapAssets" โดยเฉพาะ — ห้ามยิงผ่าน patch ตัวบน
      for (const asset of draftAssets) {
        try {
          await patchAsset(asset.id, { status: "published", updatedAt: todayStr() }, user);
        } catch (e) {
          console.warn(`Publish asset ${asset.id} failed:`, e);
        }      
      }

      // 3. เปลี่ยนสถานะ UC7 (mapBoundaries) ทั้งหมดที่เป็น draft ให้เป็น published
      //    ต้องใช้ patchBoundary ที่ผูกกับ collection "mapBoundaries" โดยเฉพาะ
      for (const boundary of draftBoundaries) {
          try {
          await patchBoundary(boundary.id, { status: "published", updatedAt: todayStr() }, user);
        } catch (e) {
          console.warn(`Publish boundary ${boundary.id} failed:`, e);
        }
      }

      alert("เผยแพร่ข้อมูลขึ้นระบบจริงเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("Publish failed:", error);
      alert("เกิดข้อผิดพลาดในการเผยแพร่ กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <>
      <UCHead code="UC9" title="บันทึกข้อมูลแผนที่" desc="บันทึกการเปลี่ยนแปลงเป็นฉบับร่างก่อน แล้วจึงยืนยันเผยแพร่ขึ้นระบบจริง" />

      <Card>
        <b style={{ fontSize: 13.5, color: "#202124" }}>รายการฉบับร่าง (Draft) ที่รอเผยแพร่ขึ้นระบบจริง</b>
        <div style={{ marginTop: 8, marginBottom: 14, fontSize: 13, color: "#5F6368" }}>
          {draftBoundaries.length === 0 && draftAssets.length === 0 ? (
            <div style={{ padding: "10px", background: "#F8F9FA", borderRadius: 6, border: "1px dashed #DADCE0", textAlign: "center" }}>
              ไม่มีรายการฉบับร่างค้างอยู่ (ข้อมูลเป็นระบบจริงทั้งหมดแล้ว หรือยังไม่ได้สร้างข้อมูลใน UC7/UC8)
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {draftBoundaries.map((b) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8F9FA", borderRadius: 6, border: "1px solid #DADCE0" }}>
                  <span>📍 <b>[ขอบเขตแผนผังอาคาร: ]</b> {b.name} ({b.type})</span>
                  <Status value="draft" />
                </div>
              ))}
              {draftAssets.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8F9FA", borderRadius: 6, border: "1px solid #DADCE0" }}>
                  <span>📁 <b>[แผนผังภายในอาคาร: ]</b> {a.name} ({a.kind})</span>
                  <Status value="draft" />
                </div>
              ))}
            </div>
          )}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #E8EAED", margin: "14px 0" }} />

        <Field label="ชื่อรายการที่บันทึก">
          <Input value={form.name} onChange={set("name")} placeholder="เช่น ปรับพิกัดทางเข้าอาคาร" />
        </Field>

        <Field label="บันทึกช่วยจำ / รายละเอียดการแก้ไข">
          <Textarea value={form.note} onChange={set("note")} />
        </Field>

        <Btn onClick={async () => {
          if (!form.name.trim()) return alert("กรุณาระบุชื่อรายการ");
          await create({ 
            ...form, 
            savedAt: new Date().toISOString().slice(0, 16).replace("T", " "), 
            savedBy: user.name, 
            status: "draft" }, user);
          setForm({ name: "", note: "" });
        }}>บันทึกเป็นฉบับร่าง</Btn>
      </Card>

      {items.map((d) => (
        <Card key={d.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 14, color: "#202124" }}>{d.name}</b>
            <Status value={d.status} />
          </div>
          <div style={{ fontSize: 13, color: "#3C4043", marginTop: 4 }}>{d.note}</div>
          <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 7 }}>บันทึกเมื่อ {d.savedAt} โดย {d.savedBy}</div>
          <div style={{ marginTop: 9 }}>
            {d.status === "draft" ? (
              <Btn kind="ok" onClick={() => handlePublish(d.id)}>ยืนยันเผยแพร่ขึ้นระบบจริง</Btn>
            ) : (
              <Btn kind="ghost" disabled>เผยแพร่แล้ว</Btn>
            )}
          </div>
        </Card>
      ))}
    </>
  );
}
