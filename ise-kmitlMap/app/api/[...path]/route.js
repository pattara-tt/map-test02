// พร็อกซีทุก /api/* จาก frontend ไปยัง backend service
// ใช้ route handler แทน next.config rewrites เพราะ rewrites ถูกคำนวณตอน build
// ทำให้เปลี่ยน BACKEND_URL ตอนรันไม่ได้ — ตัวนี้อ่าน env ตอน request จริง
export const dynamic = "force-dynamic";

const BACKEND_URL = () => process.env.BACKEND_URL || "http://localhost:4000";

async function forward(req, path) {
  const url = new URL(req.url);
  const target = `${BACKEND_URL()}/api/${path.join("/")}${url.search}`;

  const init = {
    method: req.method,
    headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
    // GET/HEAD ส่ง body ไม่ได้
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.body,
    duplex: "half",
  };

  try {
    const res = await fetch(target, init);
    const text = await res.text();
    
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return Response.json({ ok: false, error: "เชื่อมต่อ backend ไม่ได้" }, { status: 502 });
  }
}

export async function GET(req, { params }) {
  const { path } = await params;
  return forward(req, path);
}
export async function POST(req, { params }) {
  const { path } = await params;
  return forward(req, path);
}
export async function PATCH(req, { params }) {
  const { path } = await params;
  return forward(req, path);
}
export async function DELETE(req, { params }) {
  const { path } = await params;
  return forward(req, path);
}