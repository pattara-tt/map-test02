// ── พร็อกซีโครงข่ายทางเดินจาก OpenStreetMap (ใช้คำนวณเส้นทาง) ──
import { walknetData, toResponse } from "../../../lib/overpass";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req) {
  const bbox = new URL(req.url).searchParams.get("bbox");
  return toResponse(await walknetData(bbox));
}
