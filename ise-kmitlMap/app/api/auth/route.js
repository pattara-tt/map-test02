// ── เข้าสู่ระบบ / ลงทะเบียน (ย้ายมาจาก backend/src/server.js) ──
import { list, insert, ROLES } from "../../../lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const users = await list("users");

    if (body.action === "register") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return Response.json({ ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
      if (!body.password || String(body.password).length < 4)
        return Response.json({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร" }, { status: 400 });
      if (users.some((u) => String(u.email).toLowerCase() === email))
        return Response.json({ ok: false, error: "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว" }, { status: 409 });

      const role = ROLES[body.role] ? body.role : "user";
      // TODO(prod): เก็บ bcrypt hash แทนรหัสผ่านตรงๆ
      const user = await insert("users", {
        id: "U" + String(users.length + 1).padStart(3, "0"),
        email,
        password: String(body.password),
        name: body.name || email.split("@")[0],
        username: body.username || email.split("@")[0],
        role,
        institution: body.institution || "KMITL",
        status: "active",
      });
      const { password, ...safe } = user;
      return Response.json({ ok: true, user: safe });
    }

    if (body.action === "login") {
      const user = users.find((u) => String(u.email).toLowerCase() === email);
      if (!user || user.password !== String(body.password || ""))
        return Response.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
      if (user.status !== "active")
        return Response.json({ ok: false, error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายดูแลระบบ" }, { status: 403 });
      const { password, ...safe } = user;
      return Response.json({ ok: true, user: safe });
    }

    return Response.json({ ok: false, error: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch (e) {
    console.error("[api/auth]", e);
    return Response.json({ ok: false, error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
