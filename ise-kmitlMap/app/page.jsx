"use client";

import { useEffect, useState } from "react";
import AuthPage from "../components/AuthPage";
import UserApp from "../components/UserApp";
import ExecPanel from "../components/panels/ExecPanel";
import MarketingPanel from "../components/panels/MarketingPanel";
import GisPanel from "../components/panels/GisPanel";
import AdminPanel from "../components/panels/AdminPanel";
import PrPanel from "../components/panels/PrPanel";
import RegistrarPanel from "../components/panels/RegistrarPanel";
import { ROLE_LABEL, USE_CASES } from "../lib/usecases";
import { Icon, Logo, MenuIcon } from "../components/ui";

const PANELS = { exec: ExecPanel, marketing: MarketingPanel, gis: GisPanel, admin: AdminPanel, pr: PrPanel, registrar: RegistrarPanel };

// แท็บของผู้ใช้งานทั่วไป
const USER_TABS = [
  { id: "map", label: "แผนที่", icon: "svg:map" },
  { id: "events", label: "กิจกรรม", icon: "svg:bullhorn" },
  { id: "notifications", label: "แจ้งเตือน", icon: "svg:notification" },
  { id: "requests", label: "คำร้องของฉัน", icon: "📋", code: "UC11" }
];

// ความกว้างที่ถือว่าเป็นจอคอม (ใช้เฉพาะตอนอยู่โหมด auto)
const DESKTOP_MIN_WIDTH = 900;

export default function Page() {
  const [user, setUser] = useState(null);
  const [uc, setUc] = useState(null);
  const [tab, setTab] = useState("map");
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState("auto");     // auto | mobile | desktop (ผู้ใช้กดเลือกเองได้)
  const [wide, setWide] = useState(false);      // ขนาดจอจริงตอนนี้กว้างพอเป็นจอคอมไหม

  // ── ติดตามขนาดหน้าจอจริง เพื่อให้โหมด auto ปรับตามความกว้าง/สูงเอง ──
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ── คืนค่า session + โหมดการแสดงผลที่เคยเลือกไว้ ──
  useEffect(() => {
    try {
      const v = localStorage.getItem("kmitlmap:view");
      if (v) setView(v);
      const raw = localStorage.getItem("kmitlmap:user");
      if (raw) {
        const cached = JSON.parse(raw);
        // localStorage อาจเก็บชื่อเก่าจากก่อนแก้ seed ไว้ — ใช้ข้อมูล user ปัจจุบันจาก backend เป็นหลัก
        fetch("/api/data/users")
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            const fresh = data?.items?.find((u) => u.id === cached.id || u.email === cached.email);
            applyLogin(fresh || cached, !!fresh);
          })
          .catch(() => applyLogin(cached, false));
      }
    } catch (e) {}
  }, []);

  function pickView(v) {
    setView(v);
    try { localStorage.setItem("kmitlmap:view", v); } catch (e) {}
    // แจ้ง Leaflet ให้คำนวณขนาด container ใหม่หลัง layout เปลี่ยน
    setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
  }

  function applyLogin(u, persist = true) {
    setUser(u);
    const list = USE_CASES[u.role] || [];
    setUc(u.role === "user" ? null : list[0]?.key || null);
    setTab("map");
    if (persist) { try { localStorage.setItem("kmitlmap:user", JSON.stringify(u)); } catch (e) {} }
  }

  function logout() {
    try { localStorage.removeItem("kmitlmap:user"); } catch (e) {}
    setUser(null); setUc(null); setMenuOpen(false);
  }

  // โหมดที่ใช้จริง = ที่ผู้ใช้เลือก หรือถ้า auto ก็ตัดสินจากความกว้างจอ
  const desktop = view === "desktop" || (view === "auto" && wide);
  const dataView = desktop ? "desktop" : "mobile";

  const ViewSwitch = () => (
    <div className="bdi-viewswitch" title="สลับมุมมอง มือถือ / คอม">
      {[["mobile", "svg:mobile", "มือถือ"], ["auto", "⇄", "อัตโนมัติตามขนาดจอ"], ["desktop", "svg:desktop", "คอมพิวเตอร์"]].map(([k, ic, label]) => (
        <button key={k} className={view === k ? "on" : ""} title={label} onClick={() => pickView(k)}>
          <MenuIcon icon={ic} size={17} />
        </button>
      ))}
    </div>
  );

  if (!user) {
    return (
      <div className="bdi-shell" data-view={dataView}>
        <div className="bdi-main">
          <div style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top))", right: 12, zIndex: 2200 }}><ViewSwitch /></div>
          <AuthPage onLogin={applyLogin} />
        </div>
      </div>
    );
  }

  const isUser = user.role === "user";
  const ucList = USE_CASES[user.role] || [];
  const current = ucList.find((x) => x.key === uc) || ucList[0];
  const Panel = PANELS[user.role];
  const menuItems = isUser ? USER_TABS.map((t) => ({ code: t.code, key: t.id, title: t.label, icon: t.icon })) : ucList;
  const activeKey = isUser ? tab : uc;

  function pickMenu(item) {
    if (isUser) setTab(item.key);
    else setUc(item.key);
    setMenuOpen(false);
  }

  // ── เนื้อหาเมนู ใช้ร่วมกันทั้ง drawer (มือถือ) และแถบซ้าย (คอม) ──
  const MenuBody = () => (
    <>
      <div style={{ padding: "6px 16px 12px", borderBottom: "1px solid #E8EAED" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#202124" }}>{user.name}</div>
        <div style={{ fontSize: 12, color: "#5F6368", wordBreak: "break-all" }}>{user.email}</div>
        <div style={{ marginTop: 6, display: "inline-block", fontSize: 11, fontWeight: 800, color: "#1A73E8", background: "#E8F0FE", padding: "3px 9px", borderRadius: 999 }}>{ROLE_LABEL[user.role]}</div>
      </div>
      <div style={{ padding: "10px 16px 4px", fontSize: 11, fontWeight: 800, color: "#5F6368", letterSpacing: 1 }}>เมนูตามสิทธิ์การใช้งาน</div>
      {menuItems.map((item) => {
        const on = item.key === activeKey;
        return (
          <button key={item.code + item.key} onClick={() => pickMenu(item)}
            style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
              background: on ? "#E8F0FE" : "transparent", padding: "11px 16px", color: on ? "#1A73E8" : "#202124" }}>
            <MenuIcon icon={item.icon} size={19} color={on ? "#1A73E8" : "#5F6368"} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {item.code ? <span style={{ fontSize: 10.5, fontWeight: 800, color: on ? "#1A73E8" : "#5F6368", display: "block" }}>{item.code}</span> : null}
              <span style={{ fontSize: 13, fontWeight: on ? 800 : 500, lineHeight: 1.35, display: "block" }}>{item.title}</span>
            </span>
          </button>
        );
      })}
      <div style={{ padding: "14px 16px 16px", borderTop: "1px solid #E8EAED", marginTop: 10 }}>
        <button onClick={logout} style={{ width: "100%", padding: "11px 0", border: "1px solid #F5C2C0", borderRadius: 12, background: "#fff", color: "#D93025", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>ออกจากระบบ</button>
      </div>
    </>
  );

  return (
    <div className="bdi-shell" data-view={dataView}>
      {/* แถบเมนูซ้าย — เฉพาะโหมดคอม */}
      {desktop ? (
        <aside className="bdi-side">
          <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={26} />
            <b style={{ fontSize: 16, letterSpacing: .6, color: "#202124" }}>SciMap</b>
          </div>
          <div className="bdi-side-body"><MenuBody /></div>
        </aside>
      ) : null}

      <div className="bdi-main">
        <div className="bdi-topbar">
          {!desktop ? (
            <button onClick={() => setMenuOpen((v) => !v)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1, color: "#202124" }}>☰</button>
          ) : null}
          <h1 style={{ flex: 1 }}>
            {isUser
              ? (desktop ? (USER_TABS.find((t) => t.id === tab)?.label || "SciMap") : "SciMap")
              : (current?.code ? `${current.code} · ${ROLE_LABEL[user.role]}` : `${current?.title || ""} · ${ROLE_LABEL[user.role]}`)}
          </h1>
          <ViewSwitch />
          <div className="bdi-avatar" title={user.name}><Icon name="user" size={18} color="#1A73E8" /></div>
        </div>

        {/* Drawer — เฉพาะโหมดมือถือ */}
        {!desktop && menuOpen ? (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(32,33,36,.45)", zIndex: 2500 }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "min(288px, 84vw)", background: "#fff", zIndex: 2600, boxShadow: "2px 0 16px rgba(0,0,0,.25)", overflowY: "auto", padding: "calc(16px + env(safe-area-inset-top)) 0 16px" }}>
              <MenuBody />
            </div>
          </>
        ) : null}

        {isUser ? (
          <UserApp user={user} tab={tab} viewMode={view === "auto" ? "auto" : desktop ? "desktop" : "mobile"} />
        ) : (
          <div className="bdi-page">
            <div className="bdi-page-inner"><Panel uc={current?.key} user={user} /></div>
          </div>
        )}
      </div>

      {/* แท็บล่าง — ผู้ใช้งานทั่วไป ในโหมดมือถือ */}
      {isUser && !desktop ? (
        <nav className="bdi-nav">
          {USER_TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              <span className="ic"><MenuIcon icon={t.icon} size={18} /></span>
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
