// 🗺️ วาดฐานแผนที่สไตล์ Google Maps เอง (ถนน/น้ำ/อาคาร/ป้าย POI) จาก OSM ลง Leaflet canvas panes
import { OVERPASS_MIRRORS } from "./mapConstants";
export async function drawGoogleLikeBaseMap(L, map, bbox) {
  const [south, west, north, east] = bbox;
  if (!map.getPane("bdiBasePane")) {
    map.createPane("bdiBasePane");
    map.getPane("bdiBasePane").style.zIndex = "180";
    map.getPane("bdiBasePane").style.pointerEvents = "none";
  }
  if (!map.getPane("bdiLabelPane")) {
    map.createPane("bdiLabelPane");
    map.getPane("bdiLabelPane").style.zIndex = "250";
    map.getPane("bdiLabelPane").style.pointerEvents = "none";
  }
  // POI icons: ร้านค้า ร้านอาหาร BTS โรงพยาบาล ฯลฯ
  if (!map.getPane("bdiPoiPane")) {
    map.createPane("bdiPoiPane");
    map.getPane("bdiPoiPane").style.zIndex = "690"; // อยู่เหนือ route, indoor overlay และ marker ปกติ
    map.getPane("bdiPoiPane").style.pointerEvents = "auto";
  }

  map.getContainer().style.background = "#FFFFFF";
  const baseLayer = L.layerGroup().addTo(map);
  const poiLayer = L.layerGroup().addTo(map);
  // 🚀 ใช้ canvas renderer แทน SVG เริ่มต้น — ถนน/ตึกมีเป็นพันเส้น วาดด้วย canvas เร็วกว่ามาก ลดอาการหน่วงตอนโหลด/ซูม
  const baseRenderer = L.canvas({ pane: "bdiBasePane", padding: 0.3 });
  const labels = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
    { maxZoom: 20, subdomains: "abcd", pane: "bdiLabelPane", opacity: 0.82, attribution: "© OpenStreetMap contributors © CARTO" }
  ).addTo(map);

  // 🚀 แคชผลลัพธ์ถนน/ตึก/น้ำไว้ใน localStorage ตาม bbox — โหลดครั้งแรกอาจช้า (ต้องรอ Overpass) แต่ครั้งถัดไปจะไวขึ้นมากจนกว่า cache จะหมดอายุ (7 วัน)
  const baseCacheKey = `bdi-base:${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
  const baseCacheTtl = 7 * 24 * 3600 * 1000;
  // 🏢 เพิ่ม relation["building"] ด้วย — ตึกใหญ่/รูปทรงซับซ้อนบางหลัง (เช่น "จุฬาภรณ์ 1") ถูกแม็ปเป็น multipolygon relation ใน OSM
  // ไม่ใช่ way ธรรมดา query แบบเดิมที่มีแต่ way["building"] เลยพลาดตึกพวกนี้ไป
  // 🟩 เพิ่มพื้นที่สีเขียว (park/สนามหญ้า/ป่า) ทั้ง way และ relation — ของเดิมไม่มี query ส่วนนี้เลย มีแต่ query สนามกีฬาแยกต่างหากในไฟล์อื่น
  const q = `[out:json][timeout:30];(way["highway"](${south},${west},${north},${east});way["building"](${south},${west},${north},${east});relation["building"](${south},${west},${north},${east});way["natural"="water"](${south},${west},${north},${east});way["waterway"="riverbank"](${south},${west},${north},${east});relation["natural"="water"](${south},${west},${north},${east});way["leisure"~"park|garden|common|pitch|stadium|sports_centre"](${south},${west},${north},${east});relation["leisure"~"park|garden|common|pitch|stadium|sports_centre"](${south},${west},${north},${east});way["landuse"~"grass|forest|meadow"](${south},${west},${north},${east});relation["landuse"~"grass|forest|meadow"](${south},${west},${north},${east});way["natural"="wood"](${south},${west},${north},${east});relation["natural"="wood"](${south},${west},${north},${east}););out geom;`;
  let json = null;
  try {
    const cached = JSON.parse(localStorage.getItem(baseCacheKey) || "null");
    if (cached && Date.now() - cached.t < baseCacheTtl) json = cached.data;
  } catch (e) {}
  if (!json) {
    for (const url of OVERPASS_MIRRORS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(url, {
          method: "POST",
          body: "data=" + encodeURIComponent(q),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        json = await res.json();
        try { localStorage.setItem(baseCacheKey, JSON.stringify({ t: Date.now(), data: json })); } catch (e) {}
        break;
      } catch (e) {
        clearTimeout(timer);
      }
    }
  }
  // แม้ Overpass ชุดแผนที่ฐานล้มเหลว ให้ดึง POI ต่อได้ ไม่ return ออกจากฟังก์ชัน
  const roadStyle = (highway) => {
    const major = ["motorway", "trunk", "primary"];
    const medium = ["secondary", "tertiary"];
    if (major.includes(highway)) return { color: "#C4CFDA", weight: 9, opacity: 1 };
    if (medium.includes(highway)) return { color: "#D2DAE3", weight: 7, opacity: 1 };
    if (["residential", "unclassified", "service"].includes(highway)) return { color: "#E2E7EC", weight: 5, opacity: 1 };
    return { color: "#EDF0F3", weight: 3.5, opacity: 1 };
  };

  // relation (multipolygon) จาก "out geom;" จะไม่มี el.geometry ตรงๆ แต่มี el.members ซึ่งแต่ละ member (way) จะมี geometry ของตัวเอง
  // ดึงเฉพาะ member role "outer" มาต่อกันเป็นเส้นขอบเดียว (ประมาณ — ไม่รองรับรู inner/หลายวงซ้อนกัน แต่ครอบคลุมเคสส่วนใหญ่พอ)
  const relationLatLngs = (el) => {
    const outers = (el.members || []).filter((m) => m.type === "way" && m.role === "outer" && Array.isArray(m.geometry));
    const pts = [];
    for (const w of outers) for (const g of w.geometry) if (g.lat != null && g.lon != null) pts.push([g.lat, g.lon]);
    return pts;
  };

  for (const el of json?.elements || []) {
    const tags = el.tags || {};
    let latlngs;
    if (el.type === "relation") {
      latlngs = relationLatLngs(el);
    } else {
      const geom = Array.isArray(el.geometry) ? el.geometry : [];
      latlngs = geom.map((g) => [g.lat, g.lon]);
    }
    if (latlngs.length < 2) continue;

    if (tags.highway) {
      const st = roadStyle(tags.highway);
      L.polyline(latlngs, {
        pane: "bdiBasePane",
        renderer: baseRenderer,
        color: st.color,
        weight: st.weight,
        opacity: st.opacity,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(baseLayer);
    } else if (tags.building) {
      // 🏢 สีครีม/เหลืองแบบเดิม — ครอบคลุมทั้งตึกที่แม็ปเป็น way ธรรมดา และตึกที่แม็ปเป็น relation (multipolygon)
      L.polygon(latlngs, {
        pane: "bdiBasePane",
        renderer: baseRenderer,
        color: "#E9DCCB",
        weight: 1,
        fillColor: "#FEF8EF",
        fillOpacity: 1,
        interactive: false,
      }).addTo(baseLayer);
    } else if (tags.natural === "water" || tags.waterway === "riverbank") {
      L.polygon(latlngs, {
        pane: "bdiBasePane",
        renderer: baseRenderer,
        color: "#B8D8F0",
        weight: 1,
        fillColor: "#D6ECFF",
        fillOpacity: 1,
        interactive: false,
      }).addTo(baseLayer);
    } else if (
      tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "common" ||
      tags.leisure === "pitch" || tags.leisure === "stadium" || tags.leisure === "sports_centre" ||
      tags.landuse === "grass" || tags.landuse === "forest" || tags.landuse === "meadow" ||
      tags.natural === "wood"
    ) {
      // 🟩 พื้นที่สีเขียว (สวน/สนามหญ้า/ป่า/สนามกีฬา) — ของเดิมไม่มีพื้นที่นี้เลยในไฟล์นี้ ทำให้พื้นที่เขียวใน OSM จริงไม่ขึ้นหรือไม่ตรงขอบเขต
      L.polygon(latlngs, {
        pane: "bdiBasePane",
        renderer: baseRenderer,
        color: "#A8C7A0",
        weight: 1,
        fillColor: "#DDEFD8",
        fillOpacity: 0.82,
        interactive: false,
      }).addTo(baseLayer);
    }
  }

  // ดึงสถานที่สำคัญจาก OpenStreetMap แล้วแสดงเป็นไอคอนบนแผนที่
  // จำกัดเฉพาะจุดที่มีชื่อ เพื่อลดความรกและจำนวน marker
  const poiCacheKey = `bdi-poi:${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
  const poiQuery = `[out:json][timeout:30];(
    nwr["name"]["amenity"](${south},${west},${north},${east});
    nwr["name"]["shop"](${south},${west},${north},${east});
    nwr["name"]["tourism"](${south},${west},${north},${east});
    nwr["name"]["leisure"](${south},${west},${north},${east});
    nwr["name"]["public_transport"](${south},${west},${north},${east});
    nwr["name"]["railway"~"station|halt|subway_entrance"](${south},${west},${north},${east});
  );out center tags;`;

  let poiJson = null;
  for (const url of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(poiQuery),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      poiJson = await res.json();
      try {
        if (poiJson?.elements?.length) {
          localStorage.setItem(poiCacheKey, JSON.stringify(poiJson));
        }
      } catch (e) {}
      break;
    } catch (e) {
      clearTimeout(timer);
    }
  }

  // ถ้า Overpass ล่ม/timeout ให้ใช้ POI ที่เคยโหลดสำเร็จไว้ เพื่อไม่ให้ไอคอนหายหลัง refresh
  if (!poiJson) {
    try {
      const cachedPoi = localStorage.getItem(poiCacheKey);
      if (cachedPoi) poiJson = JSON.parse(cachedPoi);
    } catch (e) {}
  }

  // ไอคอน POI แบบ filled: รูปทึบ สีเดียว ไม่มีวงกลมหรือพื้นหลังครอบ
  const poiSvg = (type, color) => {
    const common = `viewBox="0 0 24 24" width="24" height="24" fill="${color}" aria-hidden="true"`;
    const paths = {
      transit: '<path d="M7 2h10c2.2 0 4 1.8 4 4v9c0 1.7-1.3 3-3 3l2 3h-3l-2-3H9l-2 3H4l2-3c-1.7 0-3-1.3-3-3V6c0-2.2 1.8-4 4-4Zm0 3a1 1 0 0 0-1 1v4h12V6a1 1 0 0 0-1-1H7Zm1 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>',
      food: '<path d="M7 2h2v8c0 1.4-.8 2.6-2 3.2V22H5v-8.8A3.5 3.5 0 0 1 3 10V2h2v6h2V2Zm9 0c3 1.7 5 5 5 8.5 0 2.1-.8 3.8-2 4.8V22h-2v-6.2c-1.8-.5-3-2.2-3-4.8V2h2Z"/>',
      cafe: '<path d="M4 5h13v2h2a4 4 0 0 1 0 8h-2.4A6.5 6.5 0 0 1 4 12.5V5Zm13 4v4h2a2 2 0 0 0 0-4h-2ZM3 19h16v2H3v-2Z"/>',
      medical: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7V2Z"/>',
      pharmacy: '<path d="M8 2h8v4h3v16H5V6h3V2Zm2 2v2h4V4h-4Zm1 5v3H8v4h3v3h4v-3h3v-4h-3V9h-4Z"/>',
      education: '<path d="M12 2 1 8l11 6 9-4.9V17h2V8L12 2Zm-7 9.8V17c0 2 3.1 4 7 4s7-2 7-4v-5.2l-7 3.8-7-3.8Z"/>',
      bank: '<path d="M12 2 2 7v3h20V7L12 2ZM4 12h3v7H4v-7Zm6 0h4v7h-4v-7Zm7 0h3v7h-3v-7ZM2 21v-2h20v2H2Z"/>',
      parking: '<path d="M5 2h8a7 7 0 0 1 0 14H9v6H5V2Zm4 4v6h4a3 3 0 1 0 0-6H9Z"/>',
      fuel: '<path d="M5 2h10v20H3V4a2 2 0 0 1 2-2Zm1 3v6h6V5H6Zm11 1 3 3v8.5a1.5 1.5 0 0 0 3 0V10h-2v7.5a.5.5 0 0 1-1 0V8l-3-3v1Z"/>',
      toilet: '<path d="M7 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm10 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM4 9h6l1 6H9v7H5v-7H3l1-6Zm10 0h6l1 6h-2v7h-4v-7h-2l1-6Z"/>',
      police: '<path d="M12 2 3 6v6c0 5.5 3.8 9.2 9 11 5.2-1.8 9-5.5 9-11V6l-9-4Zm0 5 1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4L12 7Z"/>',
      hotel: '<path d="M3 5h4a4 4 0 0 1 4 4v2h10a2 2 0 0 1 2 2v8h-3v-3H4v3H1V7a2 2 0 0 1 2-2Zm1 3v3h4V9a1 1 0 0 0-1-1H4Zm0 6v2h16v-2H4Z"/>',
      attraction: '<path d="M7 4h3l1.5-2h3L16 4h4a2 2 0 0 1 2 2v14H2V6a2 2 0 0 1 2-2h3Zm5 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>',
      shop: '<path d="M4 3h16l2 6a4 4 0 0 1-2 3.5V22H4v-9.5A4 4 0 0 1 2 9l2-6Zm3 11v5h4v-5H7Zm6 0v5h4v-5h-4Z"/>',
      place: '<path d="M12 2a8 8 0 0 1 8 8c0 5.8-8 12-8 12S4 15.8 4 10a8 8 0 0 1 8-8Zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>',
    };
    return `<svg ${common}>${paths[type] || paths.place}</svg>`;
  };


  // โทนสี POI แบบ "พาสเทลสด" — อิ่มสีมากกว่าชุดหม่นเดิม ~30-40% ให้แผนที่ดูมีชีวิต แต่ยังอ่อนกว่าเส้นนำทาง 1 สเต็ป
  // transit/bank/parking เลี่ยงตระกูลน้ำเงินทั้งหมด (น้ำเงินถูกจองโดยเส้นทาง #1A73E8/#8AB4F8 และถนน #C4CFDA แล้ว)
  // → ตอนนี้ไม่มีหมวดไหนใช้ตระกูลน้ำเงินสดแล้ว: shop เขียวมะกอก, police กรมท่าเข้มจัด (น้ำเงินสดสงวนให้เส้นทางอย่างเดียว)
  // เส้นทางใช้สีสด (#1A73E8 / #34A853 / #FBBC04 / #8E24AA ใน SEGMENT_COLORS) จึงเลี่ยงเฉดสดพวกนั้นทั้งหมด
  const poiStyle = (tags = {}) => {
    const a = tags.amenity || "";
    const shop = tags.shop || "";
    const tourism = tags.tourism || "";
    const railway = tags.railway || "";
    const pt = tags.public_transport || "";
    if (railway === "station" || railway === "halt" || railway === "subway_entrance" || pt === "station") return { type: "transit", color: "#12938B" };
    if (["restaurant", "fast_food", "food_court"].includes(a)) return { type: "food", color: "#E08245" };
    if (a === "cafe") return { type: "cafe", color: "#CF8F52" };
    if (["hospital", "clinic", "doctors"].includes(a)) return { type: "medical", color: "#E06A60" };
    if (a === "pharmacy") return { type: "pharmacy", color: "#57A468" };
    if (["school", "college", "university", "kindergarten"].includes(a)) return { type: "education", color: "#A76BC8" };
    if (["bank", "atm"].includes(a)) return { type: "bank", color: "#A87E4C" };
    if (a === "parking") return { type: "parking", color: "#6E7887" };
    if (a === "fuel") return { type: "fuel", color: "#D9A93F" };
    if (a === "toilets") return { type: "toilet", color: "#3AA8A0" };
    if (a === "police") return { type: "police", color: "#44506E" };
    if (tourism === "hotel" || tourism === "hostel") return { type: "hotel", color: "#BC79AE" };
    if (tourism === "attraction" || tourism === "museum") return { type: "attraction", color: "#63A392" };
    if (shop || a === "marketplace") return { type: "shop", color: "#98A24A" };
    return { type: "place", color: "#8F959B" };
  };
  
  const NAME_OVERRIDE = {
    "ตึกปฏิบัติการณ์หลังใหม่": "ตึกพระจอมเกล้าฯ (Sc8)",
    "ตึกปฏิบัติการหลังใหม่": "ตึกพระจอมเกล้าฯ (Sc8)",
    "ถนนหลวงพรตพิทยพยัต": "ตึกพระจอมเกล้าฯ (Sc8)",
    "ถนนหลวงพรตพิทยพยัตต์": "ตึกพระจอมเกล้าฯ (Sc8)",
  };

  if (poiJson) {
    const seen = new Set();
    for (const el of poiJson.elements || []) {
      // node ใช้ lat/lon โดยตรง ส่วน way/relation ใช้ center จาก Overpass
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;
      const tags = el.tags || {};

    const rawName =
      tags["name:th"] ||
      tags.name ||
      tags["name:en"];

    if (!rawName) continue;

    const name =
      NAME_OVERRIDE[rawName.trim()] ||
      rawName;

    const key =
      `${lat.toFixed(6)},${lon.toFixed(6)},${name}`;   
      if (seen.has(key)) continue;
      seen.add(key);
      const st = poiStyle(tags);
      const icon = L.divIcon({
        className: "",
        html: `<span class="bdi-poi-icon" style="color:${st.color}">${poiSvg(st.type, st.color)}</span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([lat, lon], {
        pane: "bdiPoiPane",
        icon,
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: 3000,
      }).bindTooltip(name, { direction: "top", offset: [0, -10], opacity: 0.95 });
      marker.bindPopup(`<b>${name}</b>`);
      marker.addTo(poiLayer);
    }
  }

  // ลดความรก: แสดง POI เมื่อซูมระดับถนนขึ้นไป
  const updatePoiVisibility = () => {
    if (map.getZoom() >= 15) {
      if (!map.hasLayer(poiLayer)) poiLayer.addTo(map);
    } else if (map.hasLayer(poiLayer)) {
      map.removeLayer(poiLayer);
    }
  };
  map.on("zoomend", updatePoiVisibility);
  updatePoiVisibility();

  return { baseLayer, labels, poiLayer };
}