// ── สถิติรวมสำหรับแดชบอร์ด (ย้ายมาจาก backend/src/server.js) ──
import { list } from "../../../lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const [users, requests, feedback, news, events, eventStats, rooms, contracts, usage] = await Promise.all([
      list("users"), list("requests"), list("feedback"), list("news"),
      list("events"), list("eventStats"), list("rooms"), list("contracts"), list("usage"),
    ]);

    const last = usage[usage.length - 1] || {};
    const requestsByStatus = requests.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
    const requestsByType = requests.reduce((a, r) => {
      const k = r.subject || r.type || "อื่นๆ";
      return { ...a, [k]: (a[k] || 0) + 1 };
    }, {});
    const daysLeft = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

    return Response.json({
      ok: true,
      overview: {
        totalUsers: users.length,
        activeUsers: last.activeUsers || 0,
        suspendedUsers: users.filter((u) => u.status !== "active").length,
        searches: last.searches || 0,
        routes: last.routes || 0,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        newFeedback: feedback.filter((f) => f.status === "new").length,
        publishedNews: news.filter((n) => n.published).length,
        buildings: new Set(rooms.map((r) => r.building)).size,
        rooms: rooms.length,
      },
      usage,
      requestsByStatus,
      requestsByType,
      contracts: contracts.map((c) => ({ ...c, daysLeft: daysLeft(c.endDate) })),
      eventStats: eventStats.map((s) => ({ ...s, title: (events.find((e) => e.id === s.eventId) || {}).name || s.eventId })),
    });
  } catch (e) {
    console.error("[api/stats]", e);
    return Response.json({ ok: false, error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
