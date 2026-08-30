"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Btn, Card, Confirm, Field, Input, Modal, Note, Pill, SearchBar, Select,
  Status, Tabs, Table, Textarea, Tiles, UCHead, useCollection, useStats,
} from "../ui";
import { EVENT_STATE_LABEL, NEWS_STATE_LABEL, eventState, fmt, localNow, newsState, validateRange } from "../../lib/schedule";

const MapPicker = dynamic(() => import("../MapPicker"), {
  ssr: false,
  loading: () => <div style={{ height: 300, display: "grid", placeItems: "center", color: "#5F6368", fontSize: 13, border: "1px solid #DADCE0", borderRadius: 12 }}>กำลังโหลดแผนที่…</div>,
});

// ฝ่ายประชาสัมพันธ์ — ข้อมูลข่าวสาร / ข้อมูลกิจกรรม / สถิติความสนใจ / หมวดหมู่
export default function PrPanel({ uc, user }) {
  if (uc === "news") return <NewsModule user={user} />;
  if (uc === "events") return <EventModule user={user} />;
  if (uc === "interest") return <InterestModule />;
  return <CategoryModule user={user} />;
}

/* ═══════════════════════════ ข้อมูลข่าวสาร ═══════════════════════════ */

const emptyNews = () => ({ title: "", body: "", publishAt: localNow(false), expireAt: "" });

function NewsModule({ user }) {
  const { items, create, patch, destroy } = useCollection("news");
  const [sub, setSub] = useState("overview");
  const [editing, setEditing] = useState(null);   // รายการที่กำลังแก้ไข (เปิดกล่องข้อมูล)

  const grouped = useMemo(() => {
    const g = { live: [], scheduled: [], expired: [], draft: [] };
    for (const n of items) g[newsState(n)]?.push(n);
    return g;
  }, [items]);

  return (
    <>
      <UCHead title="ข้อมูลข่าวสาร" desc="จัดการข่าวประชาสัมพันธ์ของภาควิชา ทั้งข่าวที่กำลังเผยแพร่ รอเผยแพร่ตามกำหนดการ และข่าวที่หมดอายุแล้ว" />
      <Tabs
        value={sub}
        onChange={setSub}
        tabs={[
          { key: "overview", label: "ภาพรวมข่าวสาร", count: items.length },
          { key: "compose", label: "เขียนข่าวสาร" },
        ]}
      />

      {sub === "overview" ? (
        <NewsOverview grouped={grouped} onEdit={setEditing} onPatch={patch} onDelete={destroy} user={user} />
      ) : (
        <NewsForm
          mode="create"
          onSubmit={async (data, publishNow) => {
            await create({ ...data, published: publishNow || data.publishNow === true, author: user.name }, user);
            alert(publishNow ? "เผยแพร่ข่าวสารเรียบร้อย" : "บันทึกข่าวสารเรียบร้อย");
            setSub("overview");
          }}
        />
      )}

      {editing ? (
        <NewsEditModal
          item={editing}
          user={user}
          onClose={() => setEditing(null)}
          onSave={async (data, { republish }) => {
            if (republish) {
              // ข่าวที่เผยแพร่ไปแล้ว: ลบฉบับเดิม แล้วเผยแพร่ฉบับใหม่ตามกำหนดการที่ระบุ
              await destroy(editing.id, user);
              await create({ ...data, published: true, author: user.name, replacedFrom: editing.id }, user);
            } else {
              await patch(editing.id, data, user);
            }
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

function NewsOverview({ grouped, onEdit, onPatch, onDelete, user }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const order = ["live", "scheduled", "expired", "draft"];
  const match = (n) => (n.title + n.body).toLowerCase().includes(q.toLowerCase());

  return (
    <>
      <Tiles items={order.map((k) => ({ label: NEWS_STATE_LABEL[k], value: grouped[k].length }))} />
      <SearchBar value={q} onChange={setQ} placeholder="ค้นหาหัวข้อ / เนื้อหาข่าว" />
      <Field label="กรองตามสถานะ">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">ทั้งหมด</option>
          {order.map((k) => <option key={k} value={k}>{NEWS_STATE_LABEL[k]}</option>)}
        </Select>
      </Field>

      {order.filter((k) => filter === "all" || filter === k).map((k) => {
        const rows = grouped[k].filter(match);
        if (!rows.length) return null;
        return (
          <div key={k}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "16px 0 8px" }}>{NEWS_STATE_LABEL[k]} ({rows.length})</div>
            {rows.map((n) => (
              <Card key={n.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b style={{ fontSize: 14.5, color: "#202124" }}>{n.title}</b>
                  <Status value={newsState(n)} />
                </div>
                <div style={{ fontSize: 13, color: "#3C4043", marginTop: 5 }}>{n.body}</div>
                <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 8 }}>
                  เผยแพร่ {fmt(n.publishAt)} · สิ้นสุด {fmt(n.expireAt)} · โดย {n.author}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Btn kind="ghost" onClick={() => onEdit(n)}>แก้ไข</Btn>
                  {newsState(n) === "draft" || newsState(n) === "scheduled" ? (
                    <Btn kind="ok" onClick={() => onPatch(n.id, { published: true, publishAt: localNow(false) }, user)}>เผยแพร่ทันที</Btn>
                  ) : null}
                  {newsState(n) === "live" ? (
                    <Btn kind="ghost" onClick={() => onPatch(n.id, { expireAt: localNow(false) }, user)}>สิ้นสุดการเผยแพร่</Btn>
                  ) : null}
                  <Btn kind="danger" onClick={() => confirm(`ลบข่าว “${n.title}” ?`) && onDelete(n.id, user)}>ลบ</Btn>
                </div>
              </Card>
            ))}
          </div>
        );
      })}
      {order.every((k) => grouped[k].filter(match).length === 0) ? (
        <div style={{ fontSize: 13, color: "#5F6368" }}>ไม่พบข่าวสารตามเงื่อนไข</div>
      ) : null}
    </>
  );
}

function NewsForm({ mode, initial, onSubmit }) {
  const [form, setForm] = useState(initial || emptyNews());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(publishNow) {
    if (!form.title.trim()) return alert("กรุณาระบุหัวข้อข่าว");
    if (!form.body.trim()) return alert("กรุณาระบุรายละเอียดข่าว");
    const err = validateRange(publishNow ? localNow(false) : form.publishAt, form.expireAt, { labelStart: "วันที่เผยแพร่", labelEnd: "วันสิ้นสุดการเผยแพร่" });
    if (err) return alert(err);
    onSubmit({ ...form, publishAt: publishNow ? localNow(false) : form.publishAt }, publishNow);
  }

  return (
    <Card>
      <Field label="หัวข้อข่าว"><Input value={form.title} onChange={set("title")} placeholder="เช่น ประกาศตารางสอบกลางภาค" /></Field>
      <Field label="รายละเอียด"><Textarea value={form.body} onChange={set("body")} style={{ minHeight: 120 }} /></Field>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}><Field label="วันที่เผยแพร่"><Input type="date" value={form.publishAt || ""} onChange={set("publishAt")} /></Field></div>
        <div style={{ flex: "1 1 180px" }}><Field label="วันสิ้นสุดการเผยแพร่"><Input type="date" value={form.expireAt || ""} onChange={set("expireAt")} /></Field></div>
      </div>
      <Note>ถ้ากำหนดวันที่เผยแพร่ไว้ในอนาคต ข่าวจะอยู่ในสถานะ “รอเผยแพร่” และขึ้นให้ผู้ใช้เห็นเองเมื่อถึงกำหนด</Note>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={() => submit(false)}>{mode === "create" ? "บันทึกและตั้งเวลาเผยแพร่" : "บันทึก"}</Btn>
        <Btn kind="ok" onClick={() => submit(true)}>เผยแพร่ทันที</Btn>
      </div>
    </Card>
  );
}

function NewsEditModal({ item, onClose, onSave }) {
  const wasPublished = newsState(item) === "live";
  const [form, setForm] = useState({ title: item.title, body: item.body, publishAt: item.publishAt || "", expireAt: item.expireAt || "" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function attemptSave(publishNow) {
    if (!form.title.trim() || !form.body.trim()) return alert("กรุณากรอกหัวข้อและรายละเอียดให้ครบ");
    const publishAt = publishNow ? localNow(false) : form.publishAt;
    const err = validateRange(publishAt, form.expireAt, { labelStart: "วันที่เผยแพร่", labelEnd: "วันสิ้นสุดการเผยแพร่" });
    if (err) return alert(err);
    const data = { ...form, publishAt, published: publishNow ? true : item.published };
    if (wasPublished) { setConfirmOpen(data); return; }
    onSave(data, { republish: false });
  }

  return (
    <>
      <Modal open title="แก้ไขข่าวสาร" onClose={onClose}
        footer={<>
          <Btn kind="ghost" onClick={onClose}>ยกเลิก</Btn>
          <Btn kind="ok" onClick={() => attemptSave(true)}>บันทึกและเผยแพร่ทันที</Btn>
          <Btn onClick={() => attemptSave(false)}>บันทึกการแก้ไข</Btn>
        </>}>
        <div style={{ marginBottom: 10 }}><Status value={newsState(item)} /></div>
        {wasPublished ? <Note tone="warn">ข่าวนี้กำลังเผยแพร่อยู่ การแก้ไขจะเป็นการถอนฉบับเดิมออกและเผยแพร่ฉบับใหม่ตามกำหนดการที่ระบุ</Note> : null}
        <Field label="หัวข้อข่าว"><Input value={form.title} onChange={set("title")} /></Field>
        <Field label="รายละเอียด"><Textarea value={form.body} onChange={set("body")} style={{ minHeight: 120 }} /></Field>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px" }}><Field label="วันที่เผยแพร่"><Input type="date" value={form.publishAt} onChange={set("publishAt")} /></Field></div>
          <div style={{ flex: "1 1 180px" }}><Field label="วันสิ้นสุดการเผยแพร่"><Input type="date" value={form.expireAt} onChange={set("expireAt")} /></Field></div>
        </div>
      </Modal>

      <Confirm
        open={!!confirmOpen}
        title="ยืนยันการแก้ไขข้อมูลที่เผยแพร่แล้ว"
        message={`ข่าว “${item.title}” ถูกเผยแพร่ไปแล้ว\n\nหากยืนยัน ระบบจะลบข้อมูลฉบับเดิมออกจากระบบ และเผยแพร่ฉบับใหม่ตามวันที่ที่กำหนดไว้\n\nต้องการแก้ไขข้อมูลที่เผยแพร่ไปแล้วใช่หรือไม่?`}
        confirmLabel="ใช่ แก้ไขและเผยแพร่ใหม่"
        tone="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { const d = confirmOpen; setConfirmOpen(false); onSave(d, { republish: true }); }}
      />
    </>
  );
}

/* ═══════════════════════════ ข้อมูลกิจกรรม ═══════════════════════════ */

const emptyEvent = () => ({
  name: "", detail: "", categoryId: "",
  startAt: localNow(true), endAt: "",
  placeName: "", lat: "", lon: "", tempPlaceCategoryId: "",
});

function EventModule({ user }) {
  const { items, create, patch, destroy } = useCollection("events");
  const { items: cats } = useCollection("categories");
  const [sub, setSub] = useState("overview");
  const [editing, setEditing] = useState(null);

  const grouped = useMemo(() => {
    const g = { ongoing: [], upcoming: [], ended: [], draft: [] };
    for (const e of items) g[eventState(e)]?.push(e);
    return g;
  }, [items]);

  return (
    <>
      <UCHead title="ข้อมูลกิจกรรม" desc="จัดการกิจกรรมของภาควิชา พร้อมกำหนดสถานที่จัดงานบนแผนที่และหมวดหมู่สถานที่ชั่วคราวระหว่างจัดกิจกรรม" />
      <Tabs
        value={sub}
        onChange={setSub}
        tabs={[
          { key: "overview", label: "ภาพรวมกิจกรรม", count: items.length },
          { key: "compose", label: "เขียนกิจกรรม" },
        ]}
      />

      {sub === "overview" ? (
        <EventOverview grouped={grouped} cats={cats} onEdit={setEditing} onPatch={patch} onDelete={destroy} user={user} />
      ) : (
        <EventForm
          cats={cats}
          onSubmit={async (data, publishNow) => {
            await create({ ...data, published: !!publishNow, author: user.name }, user);
            alert(publishNow ? "เผยแพร่กิจกรรมเรียบร้อย" : "บันทึกกิจกรรมเรียบร้อย");
            setSub("overview");
          }}
        />
      )}

      {editing ? (
        <EventEditModal
          item={editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSave={async (data, { republish }) => {
            if (republish) {
              await destroy(editing.id, user);
              await create({ ...data, published: true, author: user.name, replacedFrom: editing.id }, user);
            } else {
              await patch(editing.id, data, user);
            }
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

function EventOverview({ grouped, cats, onEdit, onPatch, onDelete, user }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const order = ["ongoing", "upcoming", "ended", "draft"];
  const match = (e) => (e.name + e.detail + (e.placeName || "")).toLowerCase().includes(q.toLowerCase());

  return (
    <>
      <Tiles items={order.map((k) => ({ label: EVENT_STATE_LABEL[k], value: grouped[k].length }))} />
      <SearchBar value={q} onChange={setQ} placeholder="ค้นหาชื่อกิจกรรม / สถานที่" />
      <Field label="กรองตามสถานะ">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">ทั้งหมด</option>
          {order.map((k) => <option key={k} value={k}>{EVENT_STATE_LABEL[k]}</option>)}
        </Select>
      </Field>

      {order.filter((k) => filter === "all" || filter === k).map((k) => {
        const rows = grouped[k].filter(match);
        if (!rows.length) return null;
        return (
          <div key={k}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "16px 0 8px" }}>{EVENT_STATE_LABEL[k]} ({rows.length})</div>
            {rows.map((e) => {
              const cat = cats.find((c) => c.id === e.categoryId);
              const temp = cats.find((c) => c.id === e.tempPlaceCategoryId);
              const state = eventState(e);
              return (
                <Card key={e.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b style={{ fontSize: 14.5, color: "#202124" }}>{e.name}</b>
                    <Status value={state} />
                  </div>
                  <div style={{ fontSize: 13, color: "#3C4043", marginTop: 5 }}>{e.detail}</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
                    {cat ? <Pill color="#fff" bg={cat.color}>{cat.name}</Pill> : <Pill>ยังไม่ระบุหมวดหมู่</Pill>}
                    {temp ? <Pill color="#8430CE" bg="#F3E8FD">สถานที่ชั่วคราว: {temp.name}</Pill> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 8, lineHeight: 1.7 }}>
                    เริ่ม {fmt(e.startAt)} · สิ้นสุด {fmt(e.endAt)}<br />
                    📍 {e.placeName || "ยังไม่ระบุสถานที่"} {e.lat ? `(${e.lat}, ${e.lon})` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <Btn kind="ghost" onClick={() => onEdit(e)}>แก้ไข</Btn>
                    {state === "draft" ? <Btn kind="ok" onClick={() => onPatch(e.id, { published: true }, user)}>เผยแพร่ทันที</Btn> : null}
                    <Btn kind="danger" onClick={() => confirm(`ลบกิจกรรม “${e.name}” ?`) && onDelete(e.id, user)}>ลบ</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        );
      })}
      {order.every((k) => grouped[k].filter(match).length === 0) ? (
        <div style={{ fontSize: 13, color: "#5F6368" }}>ไม่พบกิจกรรมตามเงื่อนไข</div>
      ) : null}
    </>
  );
}

// ฟอร์มกิจกรรม (ใช้ร่วมกันทั้งหน้าเขียนใหม่และกล่องแก้ไข)
function EventFields({ form, setForm, cats }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const eventCats = cats.filter((c) => c.kind === "event");
  const placeCats = cats.filter((c) => c.kind === "place");
  const hasPlace = form.lat !== "" && form.lat != null && form.lon !== "" && form.lon != null;

  return (
    <>
      <Field label="ชื่อกิจกรรม"><Input value={form.name} onChange={set("name")} placeholder="เช่น ISE Open House 2026" /></Field>
      <Field label="รายละเอียด"><Textarea value={form.detail} onChange={set("detail")} style={{ minHeight: 100 }} /></Field>
      <Field label="หมวดหมู่กิจกรรม">
        <Select value={form.categoryId} onChange={set("categoryId")}>
          <option value="">— เลือกหมวดหมู่ —</option>
          {eventCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}><Field label="วันที่เริ่มจัดกิจกรรม"><Input type="datetime-local" value={form.startAt || ""} onChange={set("startAt")} /></Field></div>
        <div style={{ flex: "1 1 200px" }}><Field label="วันที่สิ้นสุดกิจกรรม"><Input type="datetime-local" value={form.endAt || ""} onChange={set("endAt")} /></Field></div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: "#5F6368", margin: "14px 0 6px" }}>สถานที่จัดกิจกรรม</div>
      <MapPicker
        value={{ placeName: form.placeName, lat: form.lat, lon: form.lon }}
        onChange={(v) => setForm((f) => ({ ...f, ...v }))}
      />

      {hasPlace ? (
        <div style={{ marginTop: 14 }}>
          <Field label="หมวดหมู่สถานที่ชั่วคราว (ระหว่างจัดกิจกรรม)">
            <Select value={form.tempPlaceCategoryId || ""} onChange={set("tempPlaceCategoryId")}>
              <option value="">— ไม่เปลี่ยนหมวดหมู่ —</option>
              {placeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Note tone="warn">เมื่อสิ้นสุดการจัดกิจกรรม สถานที่นั้นจะกลับไปเป็นหมวดหมู่เดิมโดยอัตโนมัติ</Note>
        </div>
      ) : null}
    </>
  );
}

function validateEvent(form) {
  if (!form.name.trim()) return "กรุณาระบุชื่อกิจกรรม";
  if (!form.detail.trim()) return "กรุณาระบุรายละเอียดกิจกรรม";
  if (!form.categoryId) return "กรุณาเลือกหมวดหมู่กิจกรรม";
  const err = validateRange(form.startAt, form.endAt, { labelStart: "วันที่เริ่มจัดกิจกรรม", labelEnd: "วันที่สิ้นสุดกิจกรรม" });
  if (err) return err;
  if (!form.placeName?.trim() || form.lat === "" || form.lon === "") return "กรุณาเลือกสถานที่จัดกิจกรรมบนแผนที่";
  return null;
}

function EventForm({ cats, onSubmit }) {
  const [form, setForm] = useState(emptyEvent());

  function submit(publishNow) {
    const err = validateEvent(form);
    if (err) return alert(err);
    onSubmit({ ...form, lat: Number(form.lat), lon: Number(form.lon) }, publishNow);
  }

  return (
    <Card>
      <EventFields form={form} setForm={setForm} cats={cats} />
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Btn onClick={() => submit(false)}>บันทึกเป็นฉบับร่าง</Btn>
        <Btn kind="ok" onClick={() => submit(true)}>เผยแพร่ทันที</Btn>
      </div>
    </Card>
  );
}

function EventEditModal({ item, cats, onClose, onSave }) {
  const wasPublished = item.published && eventState(item) !== "ended";
  const [form, setForm] = useState({ ...item });
  const [confirmOpen, setConfirmOpen] = useState(false);

  function attemptSave(publishNow) {
    const err = validateEvent(form);
    if (err) return alert(err);
    const data = { ...form, lat: Number(form.lat), lon: Number(form.lon), published: publishNow ? true : item.published };
    if (wasPublished) { setConfirmOpen(data); return; }
    onSave(data, { republish: false });
  }

  return (
    <>
      <Modal open title="แก้ไขกิจกรรม" onClose={onClose} width={700}
        footer={<>
          <Btn kind="ghost" onClick={onClose}>ยกเลิก</Btn>
          <Btn kind="ok" onClick={() => attemptSave(true)}>บันทึกและเผยแพร่ทันที</Btn>
          <Btn onClick={() => attemptSave(false)}>บันทึกการแก้ไข</Btn>
        </>}>
        <div style={{ marginBottom: 10 }}><Status value={eventState(item)} /></div>
        {wasPublished ? <Note tone="warn">กิจกรรมนี้เผยแพร่อยู่ การแก้ไขจะเป็นการถอนฉบับเดิมออกและเผยแพร่ฉบับใหม่ตามกำหนดการที่ระบุ</Note> : null}
        <EventFields form={form} setForm={setForm} cats={cats} />
      </Modal>

      <Confirm
        open={!!confirmOpen}
        title="ยืนยันการแก้ไขข้อมูลที่เผยแพร่แล้ว"
        message={`กิจกรรม “${item.name}” ถูกเผยแพร่ไปแล้ว\n\nหากยืนยัน ระบบจะลบข้อมูลฉบับเดิมออกจากระบบ และเผยแพร่ฉบับใหม่ตามวัน-เวลาที่กำหนดไว้\n\nต้องการแก้ไขข้อมูลที่เผยแพร่ไปแล้วใช่หรือไม่?`}
        confirmLabel="ใช่ แก้ไขและเผยแพร่ใหม่"
        tone="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { const d = confirmOpen; setConfirmOpen(false); onSave(d, { republish: true }); }}
      />
    </>
  );
}

/* ══════════════════ ตรวจสอบสถิติความสนใจของกิจกรรม ══════════════════ */

function InterestModule() {
  const stats = useStats();
  const { items: interest } = useCollection("eventInterest");
  if (!stats) return <div style={{ color: "#5F6368", fontSize: 13 }}>กำลังโหลด…</div>;
  const rows = [...(stats.eventStats || [])].sort((a, b) => b.interested - a.interested);

  return (
    <>
      <UCHead title="ตรวจสอบสถิติความสนใจของกิจกรรม" desc="ยอดเข้าชม ยอดกดสนใจเข้าร่วม และจำนวนครั้งที่ถูกค้นหาบนแผนที่ของแต่ละกิจกรรม" />
      <Tiles items={[
        { label: "กิจกรรมที่มีสถิติ", value: rows.length },
        { label: "ยอดกดสนใจรวม", value: rows.reduce((a, r) => a + r.interested, 0) },
        { label: "ถูกค้นหาบนแผนที่รวม", value: rows.reduce((a, r) => a + r.searched, 0) },
        { label: "ผู้กดสนใจล่าสุด", value: interest.length },
      ]} />
      {rows.map((r) => {
        const max = Math.max(1, ...rows.flatMap((x) => [x.interested, x.searched]));
        return (
          <Card key={r.eventId}>
            <b style={{ fontSize: 14, color: "#202124" }}>{r.title}</b>
            <div style={{ marginTop: 9 }}>
              {[["กดสนใจเข้าร่วม", r.interested, "#188038"], ["ค้นหาบนแผนที่", r.searched, "#E37400"]].map(([label, v, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ width: 120, fontSize: 12.5, color: "#3C4043" }}>{label}</span>
                  <div style={{ flex: 1, height: 10, background: "#F1F3F4", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: color }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color, width: 46, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 6 }}>
              อัตราการกดสนใจต่อการค้นหา {r.searched ? ((r.interested / r.searched) * 100).toFixed(1) : "0.0"}%
            </div>
          </Card>
        );
      })}
    </>
  );
}

/* ════════════════ หมวดหมู่กิจกรรมและสถานที่ ════════════════ */

function CategoryModule({ user }) {
  const { items, create, patch, destroy } = useCollection("categories");
  const { items: events } = useCollection("events");
  const { items: rooms } = useCollection("rooms");
  const [sub, setSub] = useState("overview");
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [usage, setUsage] = useState("all");   // all | used | unused
  const [kind, setKind] = useState("all");     // all | event | place

  // นับจำนวนการใช้งานของแต่ละหมวดหมู่
  const counted = useMemo(() => items.map((c) => {
    const byEvent = events.filter((e) => e.categoryId === c.id).length;
    const byTempPlace = events.filter((e) => e.tempPlaceCategoryId === c.id).length;
    const byRoom = rooms.filter((r) => r.categoryId === c.id).length;
    const count = c.kind === "event" ? byEvent : byRoom + byTempPlace;
    return { ...c, count, byEvent, byRoom, byTempPlace };
  }), [items, events, rooms]);

  const rows = counted.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) &&
    (kind === "all" || c.kind === kind) &&
    (usage === "all" || (usage === "used" ? c.count > 0 : c.count === 0))
  );

  return (
    <>
      <UCHead title="เพิ่ม / แก้ไข / ลบหมวดหมู่กิจกรรมและสถานที่" desc="หมวดหมู่ที่สร้างไว้จะไปปรากฏให้เลือกในหน้าเขียนกิจกรรมและการกำหนดหมวดหมู่สถานที่" />
      <Tabs
        value={sub}
        onChange={setSub}
        tabs={[
          { key: "overview", label: "รายการหมวดหมู่", count: items.length },
          { key: "add", label: "เพิ่มหมวดหมู่" },
        ]}
      />

      {sub === "add" ? (
        <CategoryForm onSubmit={async (data) => { await create(data, user); alert("เพิ่มหมวดหมู่เรียบร้อย"); setSub("overview"); }} />
      ) : (
        <>
          <Tiles items={[
            { label: "หมวดหมู่ทั้งหมด", value: counted.length },
            { label: "หมวดหมู่กิจกรรม", value: counted.filter((c) => c.kind === "event").length },
            { label: "หมวดหมู่สถานที่", value: counted.filter((c) => c.kind === "place").length },
            { label: "ยังไม่ถูกใช้งาน", value: counted.filter((c) => c.count === 0).length },
          ]} />
          <SearchBar value={q} onChange={setQ} placeholder="ค้นหาชื่อหมวดหมู่" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 170px" }}>
              <Field label="ประเภท">
                <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="event">หมวดหมู่กิจกรรม</option>
                  <option value="place">หมวดหมู่สถานที่</option>
                </Select>
              </Field>
            </div>
            <div style={{ flex: "1 1 170px" }}>
              <Field label="สถานะการใช้งาน">
                <Select value={usage} onChange={(e) => setUsage(e.target.value)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="used">กำลังถูกใช้งาน</option>
                  <option value="unused">ยังไม่ถูกใช้งาน</option>
                </Select>
              </Field>
            </div>
          </div>

          <Table
            columns={[
              { key: "name", label: "หมวดหมู่", render: (c) => <Pill color="#fff" bg={c.color}>{c.name}</Pill> },
              { key: "kind", label: "ประเภท", render: (c) => (c.kind === "event" ? "กิจกรรม" : "สถานที่") },
              {
                key: "count", label: "การใช้งาน",
                render: (c) => c.count > 0
                  ? <Pill color="#188038" bg="#E6F4EA">ใช้อยู่ {c.count} รายการ</Pill>
                  : <Pill color="#5F6368" bg="#F1F3F4">ยังไม่ถูกใช้งาน</Pill>,
              },
              { key: "desc", label: "คำอธิบาย", render: (c) => <span style={{ color: "#5F6368" }}>{c.desc || "—"}</span> },
              {
                key: "act", label: "",
                render: (c) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn kind="ghost" onClick={() => setEditing(c)}>แก้ไข</Btn>
                    <Btn kind="danger" onClick={() => {
                      if (c.count > 0) return alert(`ลบไม่ได้ — หมวดหมู่นี้ถูกใช้งานอยู่ ${c.count} รายการ\nกรุณาย้ายรายการเหล่านั้นไปหมวดหมู่อื่นก่อน`);
                      if (confirm(`ลบหมวดหมู่ “${c.name}” ?`)) destroy(c.id, user);
                    }}>ลบ</Btn>
                  </div>
                ),
              },
            ]}
            rows={rows}
            empty="ไม่พบหมวดหมู่ตามเงื่อนไข"
          />
        </>
      )}

      {editing ? (
        <CategoryEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => { await patch(editing.id, data, user); setEditing(null); }}
        />
      ) : null}
    </>
  );
}

function CategoryForm({ initial, onSubmit, embedded }) {
  const [form, setForm] = useState(initial || { name: "", kind: "event", color: "#1A73E8", desc: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const body = (
    <>
      <Field label="ชื่อหมวดหมู่"><Input value={form.name} onChange={set("name")} placeholder="เช่น สัมมนา / หอพัก" /></Field>
      <Field label="ใช้กับ">
        <Select value={form.kind} onChange={set("kind")}>
          <option value="event">หมวดหมู่กิจกรรม</option>
          <option value="place">หมวดหมู่สถานที่</option>
        </Select>
      </Field>
      <Field label="คำอธิบาย"><Input value={form.desc || ""} onChange={set("desc")} placeholder="อธิบายสั้นๆ ว่าหมวดหมู่นี้ใช้กับอะไร" /></Field>
      <Field label="สีประจำหมวดหมู่"><Input type="color" value={form.color} onChange={set("color")} style={{ height: 42, padding: 4 }} /></Field>
    </>
  );

  if (embedded) return { body, form };

  return (
    <Card>
      {body}
      <Btn onClick={() => { if (!form.name.trim()) return alert("กรุณาระบุชื่อหมวดหมู่"); onSubmit(form); }}>เพิ่มหมวดหมู่</Btn>
    </Card>
  );
}

function CategoryEditModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ name: item.name, kind: item.kind, color: item.color, desc: item.desc || "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inUse = (item.count || 0) > 0;

  return (
    <Modal open title="แก้ไขหมวดหมู่" onClose={onClose} width={520}
      footer={<><Btn kind="ghost" onClick={onClose}>ยกเลิก</Btn><Btn onClick={() => { if (!form.name.trim()) return alert("กรุณาระบุชื่อหมวดหมู่"); onSave(form); }}>บันทึกการแก้ไข</Btn></>}>
      {inUse ? <Note tone="warn">หมวดหมู่นี้กำลังถูกใช้งานอยู่ {item.count} รายการ การแก้ไขจะมีผลกับทุกรายการที่ใช้หมวดหมู่นี้ทันที</Note> : null}
      <Field label="ชื่อหมวดหมู่"><Input value={form.name} onChange={set("name")} /></Field>
      <Field label="ใช้กับ">
        <Select value={form.kind} onChange={set("kind")} disabled={inUse}>
          <option value="event">หมวดหมู่กิจกรรม</option>
          <option value="place">หมวดหมู่สถานที่</option>
        </Select>
      </Field>
      {inUse ? <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: -4, marginBottom: 9 }}>เปลี่ยนประเภทไม่ได้ขณะที่ยังมีรายการใช้งานอยู่</div> : null}
      <Field label="คำอธิบาย"><Input value={form.desc} onChange={set("desc")} /></Field>
      <Field label="สีประจำหมวดหมู่"><Input type="color" value={form.color} onChange={set("color")} style={{ height: 42, padding: 4 }} /></Field>
    </Modal>
  );
}
