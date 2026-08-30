"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Btn, Card, Field, Icon, Input, Pill, Status, Textarea, UCHead, useCollection } from "./ui";
import { EVENT_STATE_LABEL, eventState, fmt } from "../lib/schedule";
import { newsState } from "../lib/schedule";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontSize: 16, color: "#5F6368" }}>กำลังโหลดแผนที่…</div>,
});

// Actor: ผู้ใช้งานทั่วไป — แผนที่/นำทาง · กิจกรรม · แจ้งเตือน · แจ้งปัญหา
export default function UserApp({ user, tab, viewMode = "auto" }) {
  const mapApi = useRef(null);

  return (
    <>
      {/* แผนที่ mount ค้างไว้เสมอ กันโหลด Leaflet ใหม่ทุกครั้งที่สลับแท็บ */}
      <div style={{ position: "absolute", inset: 0, visibility: tab === "map" ? "visible" : "hidden" }}>
        <MapView apiRef={mapApi} viewMode={viewMode} user={user} />
      </div>
      {tab === "events" ? <EventsPage user={user} /> : null}
      {tab === "notifications" ? <NotificationsPage user={user} /> : null}
      {tab === "feedback" ? <FeedbackPage user={user} /> : null}
      {tab === "requests" ? <MyRequests user={user} /> : null}
    </>
  );
}

// ── กิจกรรมที่สนใจเข้าร่วม ─────────────────────
function EventsPage({ user }) {
  const { items: events } = useCollection("events");
  const { items: cats } = useCollection("categories");
  const { items: news } = useCollection("news");
  const { items: interest, create, destroy } = useCollection("eventInterest");

  const open = events.filter((e) => e.published && eventState(e) !== "ended");
  const mine = interest.filter((i) => i.userId === user.id);
  const isInterested = (id) => mine.find((i) => i.eventId === id);
  const liveNews = news.filter((n) => newsState(n) === "live");

  return (
    <div className="bdi-page">
      <div className="bdi-page-inner">
      <UCHead title="ข่าวสารและกิจกรรม" desc="ข่าวประชาสัมพันธ์ล่าสุด และกิจกรรมที่เปิดให้กดสนใจเข้าร่วม" />

      {liveNews.length ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "6px 0 8px" }}>ข่าวสารล่าสุด</div>
          {liveNews.map((n) => (
            <Card key={n.id}>
              <b style={{ fontSize: 14.5, color: "#202124" }}>{n.title}</b>
              <div style={{ fontSize: 13, color: "#3C4043", marginTop: 4 }}>{n.body}</div>
              <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 6 }}>เผยแพร่ {fmt(n.publishAt)}</div>
            </Card>
          ))}
        </>
      ) : null}

      <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "16px 0 8px" }}>กิจกรรมที่สนใจของฉัน ({mine.length})</div>
      {mine.length === 0 ? <div style={{ fontSize: 13, color: "#5F6368", marginBottom: 6 }}>ยังไม่มีกิจกรรมที่บันทึกไว้</div> : null}
      {mine.map((i) => {
        const ev = events.find((x) => x.id === i.eventId);
        if (!ev) return null;
        return (
          <Card key={i.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <b style={{ fontSize: 14, color: "#188038" }}>{ev.name}</b>
                <div style={{ fontSize: 11.5, color: "#5F6368" }}>{fmt(ev.startAt)} · {ev.placeName}</div>
              </div>
              <Btn kind="danger" onClick={() => destroy(i.id, user)}>ยกเลิก</Btn>
            </div>
          </Card>
        );
      })}

      <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "16px 0 8px" }}>กิจกรรมทั้งหมด</div>
      {open.length === 0 ? <div style={{ fontSize: 13, color: "#5F6368" }}>ยังไม่มีกิจกรรมที่เปิดรับ</div> : null}
      {open.map((ev) => {
        const cat = cats.find((c) => c.id === ev.categoryId);
        const on = isInterested(ev.id);
        return (
          <Card key={ev.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b style={{ fontSize: 14.5, color: "#202124" }}>{ev.name}</b>
              <Status value={eventState(ev)} />
            </div>
            <div style={{ fontSize: 13, color: "#3C4043", marginTop: 5 }}>{ev.detail}</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
              {cat ? <Pill color="#fff" bg={cat.color}>{cat.name}</Pill> : null}
              <Pill>{EVENT_STATE_LABEL[eventState(ev)]}</Pill>
            </div>
            <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 7, lineHeight: 1.7 }}>
              {fmt(ev.startAt)} — {fmt(ev.endAt)}<br />📍 {ev.placeName}
            </div>
            <div style={{ marginTop: 10 }}>
              {on
                ? <Btn kind="ghost" onClick={() => destroy(on.id, user)}>✓ บันทึกแล้ว — กดเพื่อยกเลิก</Btn>
                : <Btn kind="ok" onClick={() => create({ eventId: ev.id, userId: user.id }, user)}>สนใจเข้าร่วม</Btn>}
            </div>
          </Card>
        );
      })}
      </div>
    </div>
  );
}

// ── ศูนย์รวมการแจ้งเตือน: ประกาศระบบ / กิจกรรม / ข่าวสารจากประชาสัมพันธ์ ──
const NOTI_KINDS = {
  system: { label: "ประกาศแจ้งเตือนจากระบบ", icon: "notification", color: "#D93025", bg: "#FCE8E6" },
  event: { label: "ประกาศกิจกรรม", icon: "bullhorn", color: "#1A73E8", bg: "#E8F0FE" },
  news: { label: "ข่าวสารจากประชาสัมพันธ์", icon: "news", color: "#188038", bg: "#E6F4EA" },
};

function NotificationsPage({ user }) {
  const { items: broadcasts } = useCollection("broadcasts");
  const { items: events } = useCollection("events");
  const { items: news } = useCollection("news");
  const [filter, setFilter] = useState("all");

  // รวมประกาศทั้งสามแหล่งเป็นสายเดียว เรียงตามเวลาใหม่สุดก่อน
  const feed = useMemo(() => {
    const out = [];

    for (const b of broadcasts) {
      // แจ้งเตือนที่ฝ่ายการตลาดตั้งเวลาไว้ล่วงหน้า จะยังไม่แสดงจนกว่าจะถึงกำหนด
      const at = b.sendAt || b.sentAt || b.createdAt;
      const t = new Date(at || "").getTime();
      if (Number.isFinite(t) && t > Date.now()) continue;
      out.push({ id: b.id, kind: "system", title: b.title, body: b.body, at, meta: `ถึง ${b.audience || "ทุกมหาวิทยาลัย"}` });
    }
    for (const ev of events) {
      if (!ev.published) continue;
      const state = eventState(ev);
      if (state === "ended") continue;
      out.push({
        id: ev.id, kind: "event", title: ev.name, body: ev.detail,
        at: ev.createdAt,
        meta: `${fmt(ev.startAt)} · ${ev.placeName || "ไม่ระบุสถานที่"}`,
        badge: EVENT_STATE_LABEL[state],
      });
    }
    for (const n of news) {
      if (newsState(n) !== "live") continue;
      out.push({ id: n.id, kind: "news", title: n.title, body: n.body, at: n.publishAt || n.createdAt, meta: `เผยแพร่ ${fmt(n.publishAt)}` });
    }

    return out.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  }, [broadcasts, events, news]);

  const rows = feed.filter((f) => filter === "all" || f.kind === filter);
  const countOf = (k) => feed.filter((f) => f.kind === k).length;

  return (
    <div className="bdi-page">
      <div className="bdi-page-inner">
      <UCHead title="การแจ้งเตือน" desc="ประกาศจากระบบ กิจกรรม และข่าวสารจากฝ่ายประชาสัมพันธ์ รวมไว้ที่เดียว" />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {[["all", "ทั้งหมด", feed.length], ...Object.entries(NOTI_KINDS).map(([k, v]) => [k, v.label, countOf(k)])].map(([k, label, n]) => {
          const on = filter === k;
          const cfg = NOTI_KINDS[k];
          return (
            <button key={k} onClick={() => setFilter(k)}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid", borderColor: on ? (cfg?.color || "#1A73E8") : "#DADCE0",
                background: on ? (cfg?.bg || "#E8F0FE") : "#fff", color: on ? (cfg?.color || "#1A73E8") : "#5F6368",
                borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {cfg ? <Icon name={cfg.icon} size={14} color={on ? cfg.color : "#5F6368"} /> : null}
              {label} ({n})
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? <div style={{ fontSize: 13, color: "#5F6368" }}>ยังไม่มีการแจ้งเตือน</div> : null}

      {rows.map((f) => {
        const cfg = NOTI_KINDS[f.kind];
        return (
          <Card key={f.kind + f.id}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 38, height: 38, flex: "none", borderRadius: "50%", background: cfg.bg, display: "grid", placeItems: "center" }}>
                <Icon name={cfg.icon} size={19} color={cfg.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill color={cfg.color} bg={cfg.bg}>{cfg.label}</Pill>
                  {f.badge ? <Pill>{f.badge}</Pill> : null}
                </div>
                <b style={{ display: "block", fontSize: 14.5, color: "#202124", marginTop: 6 }}>{f.title}</b>
                <div style={{ fontSize: 13, color: "#3C4043", marginTop: 4 }}>{f.body}</div>
                <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 7 }}>{f.meta}{f.at ? ` · ${f.at}` : ""}</div>
              </div>
            </div>
          </Card>
        );
      })}
      </div>
    </div>
  );
}

// ── รายการคำร้องที่ส่งไป ───────────
function MyRequests({ user }) {
  const { items: requests } = useCollection("requests");

  const mine = requests.filter((r) => r.userId === user.id);

  return (
    <div className="bdi-page">
      <div className="bdi-page-inner">
        <UCHead
          code="UC11"
          title="คำร้องของฉัน"
          desc="ตรวจสอบสถานะและรายละเอียดคำร้องที่คุณส่ง"
        />

        {mine.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5F6368" }}>
            ยังไม่มีคำร้อง
          </div>
        ) : (
          mine.map((r) => (
            <Card key={r.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <b style={{ fontSize: 14 }}>{r.subject || r.type}</b>
                <Status value={r.status} />
              </div>

              <div style={{ fontSize: 13, marginTop: 6 }}>
                {r.detail}
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color: "#5F6368",
                  marginTop: 7,
                }}
              >
                {r.createdAt} · {r.id}
              </div>

              {r.note ? (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "#3C4043",
                    marginTop: 8,
                  }}
                >
                  เหตุผลจากผู้พิจารณา: {r.note}
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── ส่งข้อเสนอแนะหรือแจ้งปัญหาการใช้ระบบ ───────────
function FeedbackPage({ user }) {
  const { items, create } = useCollection("feedback");
  const { items: quota } = useCollection("requestQuota");
  const [form, setForm] = useState({ topic: "การใช้งานแผนที่", detail: "" });
  const mine = items.filter((f) => f.userId === user.id);
  const limit = quota[0]?.perUserPerDay ?? 3;
  const todayCount = mine.filter((f) => f.createdAt === new Date().toISOString().slice(0, 10)).length;

  async function send() {
    if (!form.detail.trim()) return alert("กรุณากรอกรายละเอียด");
    if (todayCount >= limit) return alert(`ส่งได้สูงสุด ${limit} เรื่องต่อวัน (ตามที่ฝ่ายดูแลระบบกำหนด)`);
    await create({ ...form, userId: user.id, userName: user.name, status: "new", reply: "" }, user);
    setForm({ topic: form.topic, detail: "" });
    alert("ส่งข้อเสนอแนะเรียบร้อย");
  }

  return (
    <div className="bdi-page">
      <div className="bdi-page-inner">
      <UCHead title="ส่งข้อเสนอแนะหรือแจ้งปัญหาการใช้ระบบ" desc={`ส่งได้สูงสุด ${limit} เรื่องต่อวัน · วันนี้ส่งแล้ว ${todayCount} เรื่อง`} />
      <Card>
        <Field label="หัวข้อ">
          <Input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="เช่น ปัญหาการใช้ระบบ" />
        </Field>
        <Field label="รายละเอียด">
          <Textarea value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="อธิบายปัญหาหรือข้อเสนอแนะของคุณ" />
        </Field>
        <Btn onClick={send}>ส่งข้อเสนอแนะ</Btn>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 800, color: "#202124", margin: "14px 0 8px" }}>ประวัติที่ฉันส่ง</div>
      {mine.length === 0 ? <div style={{ fontSize: 13, color: "#5F6368" }}>ยังไม่มีประวัติ</div> : null}
      {mine.map((f) => (
        <Card key={f.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 14, color: "#202124" }}>{f.topic}</b>
            <Status value={f.status} />
          </div>
          <div style={{ fontSize: 13, color: "#3C4043", marginTop: 4 }}>{f.detail}</div>
          {f.reply ? <div style={{ fontSize: 12.5, color: "#188038", marginTop: 6 }}>ตอบกลับ: {f.reply}</div> : null}
          <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 6 }}>{f.createdAt} · {f.id}</div>
        </Card>
      ))}
    </div>
    </div>
  );
}
