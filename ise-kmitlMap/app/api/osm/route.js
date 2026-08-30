// ── พร็อกซี OpenStreetMap: อาคาร / ห้องน้ำ / พื้นที่สีเขียว ──
import { osmData, toResponse } from "../../../lib/overpass";

export const runtime = "nodejs";
export const maxDuration = 30; // Overpass ช้าได้ถึง ~22 วินาที

export async function GET(req) {
  const bbox = new URL(req.url).searchParams.get("bbox");
  return toResponse(await osmData(bbox));
}
