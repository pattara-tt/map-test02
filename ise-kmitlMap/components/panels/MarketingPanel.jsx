"use client";

import { useState } from "react";
import { Btn, Card, Field, Input, Pill, SearchBar, Select, Status, Table, Textarea, Tiles, UCHead, useCollection } from "../ui";

// Actor: ฝ่ายการตลาด — UC4 สัญญาบริการ · UC5 แจ้งเตือนทุกมหาวิทยาลัย · UC6 สิทธิ์ระดับสถาบัน
export default function MarketingPanel({ uc, user }) {
  if (uc === "contracts") return <Contracts user={user} />;
  if (uc === "broadcast") return <Broadcast user={user} />;
  return <Access user={user} />;
}

const daysLeft = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

function Contracts({ user }) {
  const { items, patch } = useCollection("contracts");
  const [q, setQ] = useState("");
  const rows = items
    .map((c) => ({ ...c, left: daysLeft(c.endDate) }))
    .filter((c) => (c.institution + c.plan).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.left - b.left);

  const soon = rows.filter((c) => c.left >= 0 && c.left <= 30).length;
  const expired = rows.filter((c) => c.left < 0).length;

  return (
    <>
      <UCHead title="ติดตามระยะสัญญาบริการ" desc="เรียงตามวันที่ใกล้หมดอายุที่สุด — สัญญาใหม่ก่อนหมดอายุสัญญา" />
      <Tiles items={[
        { label: "สัญญาทั้งหมด", value: rows.length },
        { label: "สัญญาใกล้หมดอายุ (≤30 วัน)", value: soon },
        { label: "สิ้นสุดสัญญา", value: expired },
        { label: "อยู่ในระยะสัญญา", value: rows.length - expired },
      ]} />
      <SearchBar value={q} onChange={setQ} placeholder="ค้นหาชื่อสถาบัน / แพ็กเกจ" />
      <Table
        columns={[
          { key: "institution", label: "สถาบัน" },
          { key: "plan", label: "ประเภทการใช้งาน" },
          { key: "endDate", label: "วันสิ้นอายุสัญญา" },
          {
            key: "left", label: "ระยะคงเลือสัญญา",
            render: (c) => c.left < 0
              ? <Pill color="#D93025" bg="#FCE8E6">หมดอายุ {Math.abs(c.left)} วัน</Pill>
              : c.left <= 30
                ? <Pill color="#B06000" bg="#FEF7E0">เหลือ {c.left} วัน</Pill>
                : <Pill color="#188038" bg="#E6F4EA">เหลือ {c.left} วัน</Pill>,
          },
          { key: "status", label: "สถานะ", render: (c) => <Status value={c.status} /> },
          {
            key: "act", label: "",
            render: (c) => <Btn kind="ghost" onClick={() => {
              const d = prompt("ต่ออายุถึงวันที่ (YYYY-MM-DD)", c.endDate);
              if (d) patch(c.id, { endDate: d, status: "active" }, user);
            }}>ต่ออายุ</Btn>,
          },
        ]}
        rows={rows}
      />
    </>
  );
}

function Broadcast({ user }) {
  const { items, create } = useCollection("broadcasts");
  const { items: institutions } = useCollection("institutionAccess");
  const [form, setForm] = useState({ title: "", body: "", audience: "ทุกมหาวิทยาลัย" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function send() {
    if (!form.title.trim() || !form.body.trim()) return alert("กรุณากรอกหัวข้อและเนื้อหา");
    await create({ ...form, sentAt: new Date().toISOString().slice(0, 16).replace("T", " "), sentBy: user.name }, user);
    setForm({ title: "", body: "", audience: "ทุกมหาวิทยาลัย" });
    alert("ส่งข้อความแจ้งเตือนเรียบร้อย");
  }

  return (
    <>
      <UCHead title="ส่งข้อความแจ้งเตือนระบบถึงทุกมหาวิทยาลัยในระบบ" desc="ข้อความจะแสดงบนหน้าแรกของผู้ใช้ทุกคนในสถาบันที่เลือก" />
      <Card>
        <Field label="หัวข้อ"><Input value={form.title} onChange={set("title")} placeholder="เช่น แจ้งปิดปรับปรุงระบบ" /></Field>
        <Field label="เนื้อหา"><Textarea value={form.body} onChange={set("body")} placeholder="รายละเอียดที่ต้องการแจ้ง" /></Field>
        <Field label="ผู้รับ">
          <Select value={form.audience} onChange={set("audience")}>
            <option>ทุกมหาวิทยาลัย</option>
            {institutions.map((i) => <option key={i.id}>{i.institution}</option>)}
          </Select>
        </Field>
        <Btn onClick={send}>ส่งข้อความแจ้งเตือน</Btn>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "14px 0 6px" }}>ประวัติการส่ง</div>
      {items.map((b) => (
        <Card key={b.id}>
          <b style={{ fontSize: 14, color: "#202124" }}>{b.title}</b>
          <div style={{ fontSize: 13, color: "#3C4043", marginTop: 4 }}>{b.body}</div>
          <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 8 }}>ถึง {b.audience} · {b.sentAt} · โดย {b.sentBy}</div>
        </Card>
      ))}
    </>
  );
}

const LEVELS = { full: "เต็มรูปแบบ", standard: "มาตรฐาน", readonly: "อ่านอย่างเดียว" };
const MODULES = [["map", "แผนที่"], ["events", "กิจกรรม"], ["rooms", "ข้อมูลห้อง"], ["reports", "รายงาน"]];

function Access({ user }) {
  const { items, patch } = useCollection("institutionAccess");

  function toggleModule(row, m) {
    const has = row.modules.includes(m);
    const modules = has ? row.modules.filter((x) => x !== m) : [...row.modules, m];
    patch(row.id, { modules, updatedAt: new Date().toISOString().slice(0, 10) }, user);
  }

  return (
    <>
      <UCHead title="จัดการสิทธิ์การเข้าถึงระดับสถาบัน" desc="กำหนดระดับสิทธิ์ โมดูลที่เปิดใช้ และจำนวนบัญชีสูงสุดของแต่ละสถาบัน" />
      {items.map((row) => (
        <Card key={row.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <b style={{ fontSize: 14.5, color: "#202124" }}>{row.institution}</b>
            <Pill color="#1A73E8" bg="#E8F0FE">{LEVELS[row.level]}</Pill>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <Field label="ระดับสิทธิ์">
              <Select value={row.level} onChange={(e) => patch(row.id, { level: e.target.value, updatedAt: new Date().toISOString().slice(0, 10) }, user)} style={{ width: 170 }}>
                {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="จำนวนบัญชีสูงสุด">
              <Input type="number" defaultValue={row.seats} onBlur={(e) => patch(row.id, { seats: Number(e.target.value) }, user)} style={{ width: 130 }} />
            </Field>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5F6368", marginBottom: 5 }}>โมดูลที่เปิดใช้</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {MODULES.map(([k, label]) => {
              const on = row.modules.includes(k);
              return (
                <button key={k} onClick={() => toggleModule(row, k)}
                  style={{ border: "1px solid", borderColor: on ? "#1A73E8" : "#DADCE0", background: on ? "#E8F0FE" : "#fff", color: on ? "#1A73E8" : "#5F6368", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {on ? "✓ " : ""}{label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 9 }}>อัปเดตล่าสุด {row.updatedAt}</div>
        </Card>
      ))}
    </>
  );
}