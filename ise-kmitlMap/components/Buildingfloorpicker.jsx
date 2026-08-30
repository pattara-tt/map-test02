"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadLeaflet } from "./mapGeo";
import {
  BUILDINGS,
  CENTER,
  getNodeType,
  KMITL_ALL_NODES,
  KMITL_NODE_FLOOR,
  KMITL_FLOOR1_NODES,
  KMITL_FLOOR1_EDGES,
  KMITL_EXTERIOR_LINKS,
} from "./mapConstants";
import { useCollection } from "./ui";

const normalize = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

function getNodeIcon(node) {
  if (!node) {return {html: "•",type: "other",};}

  switch (node.type) {
    case "Study_Room":
      return {
        html: `<img
            src="/data/icon/room.svg"
            alt=""
            style=" width:22px; height:22px; display:block;
              filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));"/>`,
        type: "room",
      };

    case "Co_Work":
      return {html: getNodeType("Co_Work").icon, type: "room", };

    case "Toilet":
      return {html: "🚻", type: "toilet",};

    case "lift":
      return {html: "🛗", type: "lift",};

    case "Stair":
      return {html: "🪜", type: "stairs",};

    case "exit":
    case "Entrance":
    case "Fire_Exit":
    case "entrance":
    case "Exterior":
    case "exterior":
    case "door":
      return {html: "🚪",type: "exit",};

    default: {const t = getNodeType(node.type);
      return {html: t?.icon || "•",type: "other",};
    }
  }
}

/* label สำหรับ Popup*/
function getNodeTypeLabel(node) {
  if (!node) return "จุดบนผัง";

  const labels = {
    Study_Room: "ห้องเรียน",
    Co_Work: "พื้นที่ทำงาน",
    Toilet: "ห้องน้ำ",
    lift: "ลิฟต์",
    Stair: "บันได",
    Entrance: "ทางเข้า",
    Fire_Exit: "ทางหนีไฟ",
    entrance: "ทางเข้า",
    exit: "ทางออก",
    Exterior: "ทางเข้า/ออกอาคาร",
    exterior: "ทางเข้า/ออกอาคาร",
    door: "ประตู",
    path: "ทางเดิน",
  };

  if (labels[node.type]) return labels[node.type];
  const t = getNodeType(node.type);
  return t?.label || node.type || "จุดบนผัง";
}

/* node ที่ถือว่าเป็นจุดทางเข้า/ทางออก */
function isExteriorNode(id) {
  return new Set((KMITL_EXTERIOR_LINKS || []).map((x) => x.node)).has(id);
}

/* Main component */
export default function BuildingFloorPicker({
  building,
  floor,
  onChange,
  onSelectRoom,
  height = "100%",
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const ctx = useRef({
    L: null,
    map: null,
    buildingLayers: {},
    floorOverlay: null,
    graphLayer: [],
    poiLayer: [],
    roomLayer: [],
    searchLayer: null,
  });

  /* State*/

  const [openKey, setOpenKey] = useState(
    () => Object.keys(BUILDINGS).find( (k) => BUILDINGS[k].name === building ) || null
  );

  const [curFloor, setCurFloor] = useState(floor || "1");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // true เมื่อ building polygon layers (ctx.current.buildingLayers) สร้างเสร็จแล้ว
  // ใช้บอก effect fit/lock ให้รู้ว่าตอนนี้อ่าน buildingLayers[openKey] ได้แล้วจริง ๆ
  const [layersReady, setLayersReady] = useState(false);

  /* Firestore */

  const { items: floorRecords } = useCollection("floors");
  const { items: allRooms } = useCollection("rooms");
  const b = openKey ? BUILDINGS[openKey] : null;


  /* Merge floor data */

  const mergedFloors = useMemo(() => {
    if (!b) return [];
    const overrides = {};
    for (const rec of floorRecords || []) {
      // schema ของตาราง floors กำหนด status เป็น 'active' | 'draft' เท่านั้น
      // (เดิมเทียบกับ "inactive" ซึ่งไม่มีทางเป็นจริง ทำให้ชั้นที่ถูกซ่อนยังโผล่อยู่)
      if (rec.building === b.name && rec.status !== "draft" && rec.svg) {
        overrides[rec.floor] = rec.svg;
      }
    }

    const base = b.floors || [];
    const merged = base.map((f) =>
      overrides[f.id] ? { ...f, svg: overrides[f.id],}: f
    );

    for (const floorId in overrides) {
      if (!merged.some((f) => f.id === floorId)) {
        merged.push({
          id: floorId,
          label: floorId,
          svg: overrides[floorId],
        });
      }
    }

    merged.sort((a, z) => {
      const na = Number(a.id);
      const nz = Number(z.id);

      if (
        Number.isFinite(na) &&
        Number.isFinite(nz)
      ) {
        return nz - na;
      }

      return String(z.id).localeCompare(
        String(a.id)
      );
    });

    return merged;
  }, [b, floorRecords]);


  /* Current rooms */

  const currentRooms = useMemo(() => {
    if (!b) return [];

    return (allRooms || []).filter(
      (r) =>
        r.building === b.name &&
        String(r.floor) === String(curFloor)
    );
  }, [allRooms, b, curFloor]);

  const floorNodes = useMemo(() => {
    if (!b) return {};

    if (String(curFloor) === "1") {
      return KMITL_FLOOR1_NODES || {};
    }

    const result = {};

    for (const [id, node] of Object.entries(
      KMITL_ALL_NODES || {}
    )) {
      const nodeFloor = KMITL_NODE_FLOOR?.[id];
      if (String(nodeFloor) === String(curFloor)) {
        result[id] = node;
      }
    }
    return result;
  }, [b, curFloor]);


  const floorEdges = useMemo(() => {
    if (String(curFloor) === "1") { return KMITL_FLOOR1_EDGES || [];}
    return [];
  }, [curFloor]);


  /* Match room กับ node */

  const roomByNode = useMemo(() => {
    const result = {};

    for (const room of currentRooms) {
      if (room.nodeId) {
        result[room.nodeId] = room;
      }
    }
    return result;
  }, [currentRooms]);


  /* Callback refs  */
  const onChangeRef = useRef(onChange);
  useEffect(() => {onChangeRef.current = onChange; }, [onChange]);
  
  const onSelectRoomRef = useRef(onSelectRoom);
  useEffect(() => { onSelectRoomRef.current = onSelectRoom;}, [onSelectRoom]);

  /* Sync props */

  useEffect(() => {
    const key = Object.keys(BUILDINGS).find((k) => BUILDINGS[k].name === building);
    setOpenKey(key || null);
    if (floor) setCurFloor(floor);
  }, [building, floor]);


  /* Map bounds */

  const KMITL_BOUNDS = [[13.720, 100.765],[13.740, 100.788],];

  /* Fit building */

  const fitBuilding = (map,poly) => {
    if (!map || !poly) return;
    const center = poly.getBounds().getCenter();
    const targetZoom = 20.2;

    // อย่าตั้ง minZoom === maxZoom แบบเป๊ะๆ เด็ดขาด เพราะถ้า zoom ถูกล็อคตายตัว
    // แล้ว container กับ maxBounds ไม่พอดีกันพอดี Leaflet จะพยายาม pan เข้า
    // bounds ซ้ำไปเรื่อยๆ โดยขยับ zoom ไม่ได้เลย จนเกิด stack overflow
    // (_onPanTransitionEnd / _adjustPan วนไม่รู้จบ) ให้เผื่อช่วงเล็กน้อยแทน
    const ZOOM_LOCK_MARGIN = 0.4;

    // ให้แน่ใจว่าขนาด container ถูกต้องก่อน ค่อยคำนวณ view/bounds
    map.invalidateSize();
    map.setView(center, targetZoom, { animate: true });

    setTimeout(() => {
        if (!map) return;
        map.setMinZoom(targetZoom - ZOOM_LOCK_MARGIN); // ซูมออกได้มากสุดแค่เห็นตึกครบพอดี (มีระยะเผื่อ)
        map.setMaxZoom(targetZoom + ZOOM_LOCK_MARGIN); // ซูมเข้าใกล้สุดๆ เพื่อดูห้อง/node รายละเอียด (มีระยะเผื่อ)
    }, 250);
  };

  /* Initialize map */

  useEffect(() => {
    let dead = false;
    (async () => {const L = await loadLeaflet();
      if (dead || mapRef.current || !elRef.current) {
        return;
      }

      if (elRef.current._leaflet_id) {
        return;
      }

      const map = L.map(
        elRef.current,
        {
          zoomControl: true,
          attributionControl: true,
          maxBounds:KMITL_BOUNDS,
          maxBoundsViscosity:0.8,
          minZoom: 18,
          maxZoom: 21,
        }
      ).setView(CENTER,17);

      mapRef.current = map;
      ctx.current.L = L;
      ctx.current.map = map;

      /* Base map */

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 21, attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        }
      ).addTo(map);

      /* Pane สำหรับ floor plan */

      if (!map.getPane("regFloorPane")) {
        map.createPane("regFloorPane");
        map.getPane("regFloorPane").style.zIndex = "350";
        map.getPane("regFloorPane").style.pointerEvents = "none";
      }

      /* Pane สำหรับ graph / icons */

      if (!map.getPane("regGraphPane")) {
        map.createPane("regGraphPane");
        map.getPane("regGraphPane").style.zIndex = "600";
      }

      /* Building labels */

      for (const [key, buildingData,] of Object.entries(BUILDINGS)) {
        const outline = buildingData.outline && buildingData.outline.length >= 3? buildingData.outline : buildingData.bounds ? [
                [
                  buildingData.bounds[0][0],
                  buildingData.bounds[0][1],
                ],
                [
                  buildingData.bounds[1][0],
                  buildingData.bounds[0][1],
                ],
                [
                  buildingData.bounds[1][0],
                  buildingData.bounds[1][1],
                ],
                [
                  buildingData.bounds[0][0],
                  buildingData.bounds[1][1],
                ],
              ] : null;

        if (!outline) {
          continue;
        }

        const poly = L.polygon(
            outline,
            {
              stroke: false,
              fill: false,
              opacity: 0,
              interactive: false,
            }
          ).addTo(map);

        const center = poly.getBounds().getCenter();
        const label = L.marker(center, {
              icon: L.divIcon({
                  className: "",
                  html: `
                    <div
                      style="display:flex; flex-direction:column; align-items:center; gap:2px;cursor:pointer;"
                    >
                      <img
                        src="/data/icon/building.svg"
                        alt=""
                        style=" width:18px; height:18px; filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));"
                      />

                      <span
                        style="background: rgba(255,255,255,.94); color:#202124;
                          font-weight:800; font-size:11px;padding:3px 9px;
                          border-radius:999px;
                          box-shadow: 0 1px 4pxrgba(0,0,0,.25);
                          white-space:nowrap;"
                      >
                        ${buildingData.name}
                      </span>
                    </div>`,

                  iconSize: [140, 42,],
                  iconAnchor: [70, 21,],
                }),
              zIndexOffset: 500,
            }
          ).addTo(map);

        label.on("click", () => {
            setOpenKey(key);
            setCurFloor("1");
            onChangeRef.current?.({
              building: buildingData.name,
              floor: "1",
            });

            fitBuilding(map,poly
            );
          }
        );

        ctx.current.buildingLayers[key] = {poly,label,
        };
      }

      setLayersReady(true);
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      dead = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);


  /* Zoom เมื่อเลือกตึก  */

  useEffect(() => {
    const map = ctx.current.map;
    const layer = openKey ? ctx.current.buildingLayers[openKey] : null;

    if ( map && layer) {
      fitBuilding(map,layer.poly);
    }
  }, [openKey, layersReady]);

  /* =======================================================
     ล็อคแผนที่ให้อยู่แค่บริเวณตึกที่กำลังแก้ไข (เฉพาะฝ่ายทะเบียน)
     - เลือกตึกแล้ว (openKey มีค่า): ล็อคขอบเขตแค่ตัวตึกนั้น ลากแผนที่ออกนอกตึกไม่ได้
       ต้องกด ✕ ปิดตึกก่อน ถึงจะขยับแผนที่ไปที่อื่นได้
     - ยังไม่เลือกตึก / กด ✕ ปิดแล้ว (openKey === null): คืนขอบเขตกลับเป็นทั้งแคมปัสตามเดิม
     ======================================================= */

  useEffect(() => {
    const map = ctx.current.map;
    if (!map || !layersReady) return;

    try {
        if (openKey && layer?.poly) {
        map.setMaxBounds(layer.poly.getBounds().pad(0.18));
        } else if (map._loaded) {
        map.setMaxBounds(KMITL_BOUNDS);
        }
    } catch (e) {
        
    }
  }, [openKey, layersReady]);


  /* Floor SVG */

  useEffect(() => {const {L,map,} = ctx.current;
    if (!L || !map) {return;}

    if (ctx.current.floorOverlay) {
      map.removeLayer(ctx.current.floorOverlay);
      ctx.current.floorOverlay = null;
    }

    if (!openKey || !b) {return;}
    const floorData = mergedFloors.find((f) =>
          String(f.id) === String(curFloor)
      );

    if (floorData?.svg) {
      ctx.current.floorOverlay =L.imageOverlay(
          floorData.svg,
          b.bounds,
          {
            opacity: 0.96,
            interactive: false,
            pane:"regFloorPane",
          }
        ).addTo(map);
    }
  }, [
    openKey,
    curFloor,
    mergedFloors,
    b,
  ]);

  /* Draw graph edges */

  useEffect(() => {const {L, map,} = ctx.current;
    if (!L || !map) {return;}

    for (const layer of ctx.current.graphLayer) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }

    ctx.current.graphLayer = [];

    if (!openKey) return;

    /* วาด edge ทางเดิน เหมือน MapView */
    for (const [from,to,] of floorEdges) {
      const a = floorNodes[from];
      const z = floorNodes[to];

      if (!a || !z || !Number.isFinite(a.lat) || !Number.isFinite(a.lon) ||
        !Number.isFinite(z.lat) || !Number.isFinite(z.lon)) {
        continue;
      }

      const line = L.polyline([
            [a.lat,a.lon,],
            [z.lat,z.lon,],],
          {
            color:"#9AA0A6",
            weight: 2,
            opacity: 0.60,
            dashArray: "4 4",
            pane: "regGraphPane",
          }
        ).addTo(map);

      line.bindTooltip(
        "ทางเดินภายในอาคาร",{sticky: true,}
      );
      ctx.current.graphLayer.push(line);
    }

    return () => {
      for (const layer of ctx.current.graphLayer) {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }
      ctx.current.graphLayer = [];
    };
  }, [
    openKey,
    curFloor,
    floorNodes,
    floorEdges,
  ]);


  /* Draw ALL indoor nodes */

  useEffect(() => {
    const {L,map,} = ctx.current;
    if (!L || !map) {return;}

    /* clear */
    for (const marker of ctx.current.poiLayer) {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    }

    ctx.current.poiLayer = [];
    if (!openKey || !Object.keys(floorNodes).length) {return;}
    for (const [id,node,] of Object.entries(floorNodes)) {
      if (!Number.isFinite(node?.lat) || !Number.isFinite(node?.lon)) {
        continue;
      }

      const room = roomByNode[id];

      const exterior = isExteriorNode(id);
      const effectiveNode = exterior ? {
              ...node,
              type: node.type === "path" || !node.type ? "exit": node.type,
            }
          : node;

      const icon = getNodeIcon(effectiveNode);
      const typeLabel = exterior ? "ทางเข้า / ทางออก" : getNodeTypeLabel(node);

      /* ขนาด icon */
      const size = icon.type === "room" ||
        icon.type === "toilet" ? 24 : 26;

      const marker = L.marker([node.lat, node.lon,], {
            icon: L.divIcon({
                className: "",
                html: 
                `<div
                    style="
                      width:${size}px;
                      height:${size}px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      cursor:pointer;
                      background:
                        ${
                          icon.type === "room" ? "rgba(255,255,255,.94)" : icon.type === "toilet"
                            ? "rgba(255,255,255,.94)"
                            : "transparent"
                        };

                      border-radius:
                        ${
                          icon.type === "room" ||
                          icon.type === "toilet" ? "5px" : "50%"
                        };

                      box-shadow:
                        ${
                          icon.type === "room" ||
                          icon.type === "toilet" ? "0 1px 4px rgba(0,0,0,.25)": "none"
                        };
                    ">
                    ${icon.html}
                  </div>`,

                iconSize: [size,size],
                iconAnchor: [size / 2,size / 2,],
              }),

            zIndexOffset:
              icon.type === "room" || icon.type === "toilet" ? 900 : 750,

            pane: "regGraphPane",
          }
        ).addTo(map);


      /* Tooltip */

      const tooltipText = room
          ? `${room.name || `ห้อง ${room.code || ""}`}`
          : node.label
          ? `${typeLabel} · ${node.label}`
          : `${typeLabel} · ${id}`;

      marker.bindTooltip(
        tooltipText,
        {
          direction: "top",
          offset: [0, -8,],
        }
      );

      /* Popup */

      const popupRoom = room ? 
            `<div
                style="min-width:190px;
                font-family:Arial,sans-serif;
                "
              >
                <div
                  style="
                    font-weight:800;
                    font-size:15px;
                    margin-bottom:6px;
                    color:#202124;
                  "
                >
                  🚪 ${
                    room.name || `ห้อง ${room.code || ""}`
                  }
                </div>

                ${room.code ? `<div>รหัสห้อง: <b>${room.code}</b></div>` : ""}
                ${room.type ? `<div>ประเภท: ${room.type}</div>`: ""}
                ${room.capacity ? `<div>ความจุ: ${room.capacity}</div>`: ""}
                ${room.teacher ? `<div>อาจารย์: ${room.teacher}</div>` : ""}

                <div style="margin-top:8px; color:#5F6368; font-size:11px;">
                  ${b?.name || ""}· ชั้น ${curFloor}
                </div>
              </div>`
          : `<div
                style=" min-width:170px; font-family:Arial,sans-serif;"
              >
                <div
                  style=" font-weight:800; font-size:14px; margin-bottom:5px; color:#202124;"
                >
                  ${icon.html}
                  ${typeLabel}
                </div>

                <div
                  style="color:#5F6368; font-size:12px;"
                >
                  ${node.label ||id}
                </div>

                <div
                  style="color:#80868B; font-size:10px;margin-top:5px;"
                >
                  ${b?.name || ""}· ชั้น ${curFloor}
                </div>
              </div>`;

      marker.bindPopup(popupRoom, {
          closeButton: true,
          offset: [0, -8,],
          maxWidth: 260,
          autoPan: true,
          keepInView: true,
          autoPanPaddingTopLeft: [120,30,],
          autoPanPaddingBottomRight: [50,40],
        }
      );

      /* ===================================================
         Click
         ถ้าเป็นห้อง:
         - zoom
         - popup
         - ส่งไป RoomsManager
         =================================================== */

        marker.on("popupclose", () => {
        const currentMap = ctx.current.map;
        const currentLayer = openKey ? ctx.current.buildingLayers[openKey] : null;

        if (currentMap && currentLayer?.poly) {
            const buildingCenter = currentLayer.poly.getBounds().getCenter();
            
            // ขยับแผนที่กลับไปกึ่งกลางตึกแบบ Smooth animation
            currentMap.panTo(buildingCenter, {
            animate: true,
            duration: 0.5,
            });
        }
        });

        marker.on("click", () => {
            map.setView([node.lat, node.lon,], 20, { animate: true,});
            const room = roomByNode[id];

            if (icon.type === "room") {
                onSelectRoomRef.current?.(
                room || {
                    id: null,
                    nodeId: id,
                    code: null,
                    name: node.label || id,
                    building: b?.name || building,
                    floor: curFloor,
                    __isNewNode: true,
                }
                );
            }
        }
      );
      ctx.current.poiLayer.push(marker);
    }


    return () => {
      for (const marker of ctx.current.poiLayer) {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
      ctx.current.poiLayer = [];
    };
  }, [
    openKey,
    curFloor,
    floorNodes,
    roomByNode,
    b,
  ]);

  /* Search */

  const searchResults =
    useMemo(() => {
      const q = normalize(search);
      if (!q) return [];
      const result = [];
      /* อาคาร */
      for (
        const [key,data,] of Object.entries(BUILDINGS)) {
        const text = normalize(`${data.name} ${key}`);

        if (text.includes(q)) {
          result.push({
            kind: "building",key,
            name: data.name,
            icon: "🏢",
          });
        }
      }

      /* ห้องจากทะเบียน */
      for (const room of allRooms || []) {
        const text =
          normalize(
            [
              room.code,
              room.name,
              room.type,
              room.teacher,
              room.building,
              room.floor,
            ]
              .filter(Boolean)
              .join(" ")
          );

        if (
          text.includes(q)
        ) {
          const node = room.nodeId ? KMITL_ALL_NODES[room.nodeId] : null;

          result.push({
            kind:"room", room, node,
            name: room.name || `ห้อง ${room.code || ""}`,
            icon: "🚪",
          });
        }
      }

      /* node ใน indoor map */
      for (
        const [id,node,] of Object.entries(
          floorNodes
        )) {
        const text =
          normalize(
            [
              id,
              node.type,
              node.label,
            ]
              .filter(Boolean)
              .join(" ")
          );

        if (
          !text.includes(q)
        ) {
          continue;
        }

        /* ถ้ามี room อยู่แล้ว ไม่ต้องแสดงซ้ำ */
        if (roomByNode[id]) continue;
        
        const icon = getNodeIcon(node);
        result.push({
          kind: "node",
          id,
          node,
          name: node.label ||  getNodeTypeLabel(node),
          icon: icon.type === "toilet" ? "🚻"
              : icon.type === "lift" ? "🛗"
              : icon.type === "stairs" ? "🪜"
              : icon.type === "exit" ? "🚪"
              : "📍",
        });
      }

      return result.slice(0, 10);
    }, [
      search,
      allRooms,
      floorNodes,
      roomByNode,
    ]);

  /* Search select */

  const selectSearch =
    (item) => {setSearchOpen(false);
      const map =ctx.current.map;

      if (!map) {return;}

      /* อาคาร */
      if (item.kind === "building") {
        const data = BUILDINGS[item.key];
        setOpenKey(item.key);
        setCurFloor("1");
        onChangeRef.current?.({
          building: data.name,
          floor: "1",
        });

        const layer = ctx.current.buildingLayers[item.key];
        if (layer) {
          fitBuilding(map, layer.poly);
        }
        return;
      }

      /* ห้อง */
      if (item.kind === "room"
      ) {
        const room = item.room;

        const key = Object.keys(BUILDINGS).find(
            (k) => BUILDINGS[k].name ===room.building
          );

        setOpenKey(key || null);
        setCurFloor(room.floor ||"1");

        onChangeRef.current?.({building: room.building, floor: room.floor || "1",
        });

        const node =
          item.node;

        if (node) {
          setTimeout(() => {
            map.setView([node.lat,node.lon,],20,{animate:true,}
            );
            onSelectRoomRef.current?.(room);
          }, 100);
        } else {
          onSelectRoomRef.current?.(room);
        }
        return;
      }

      /* node */
      if (
        item.kind === "node"
      ) {const node = item.node;
        map.setView(
          [node.lat, node.lon,], 20,
          {animate: true,}
        );

        /* เปิด popup ของ marker */
        const marker = ctx.current.poiLayer.find(
              (m) => {
                const p = m.getLatLng();
                return (
                  Math.abs(p.lat - node.lat) < 0.000001 &&
                  Math.abs(p.lng - node.lon) < 0.000001
                );
              }
            );

        if (marker) {
          setTimeout(
            () =>
              marker.openPopup(),
            250
          );
        }
      }
    };

  /* Resize observer */
  useEffect(() => {
    if (!elRef.current || typeof ResizeObserver === "undefined") {return;}

    const ro = new ResizeObserver(() => {ctx.current.map?.invalidateSize();});
    ro.observe(
      elRef.current
    );
    return () => ro.disconnect();
  }, []);

  /* RETURN */

  return (
    <div
      style={{
        position:"relative",
        width: "100%",
        height,
        background:"#F8F9FA",
      }}
    >

      {/* ===================================================
          Map
          =================================================== */}

      <div
        ref={elRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />


      {/* ===================================================
          Search
          =================================================== */}

      <div
        style={{
          position:
            "absolute",

          top: 12,
          left: 12,

          zIndex: 1200,

          width:
            "min(430px, calc(100% - 24px))",
        }}
      >

        <div
          style={{
            background:
              "#fff",

            border:
              "1px solid #DADCE0",

            borderRadius: 12,

            boxShadow:
              "0 2px 8px rgba(60,64,67,.28)",

            height: 46,

            display:
              "flex",

            alignItems:
              "center",

            gap: 9,

            padding:
              "0 12px",
          }}
        >

          <div
            style={{
              width: 30,
              height: 30,

              borderRadius:
                "50%",

              background:
                "#1A73E8",

              color: "#fff",

              display:
                "grid",

              placeItems:
                "center",

              fontWeight: 800,

              flexShrink: 0,
            }}
          >
            P
          </div>


          <input
            value={search}

            onChange={(e) => {
              setSearch(
                e.target.value
              );

              setSearchOpen(
                true
              );
            }}

            onFocus={() => {
              if (
                search.trim()
              ) {
                setSearchOpen(
                  true
                );
              }
            }}

            placeholder="ค้นหาสถานที่"

            style={{
              flex: 1,

              minWidth: 0,

              border: "none",

              outline: "none",

              fontSize: 14,

              color:
                "#202124",

              background:
                "transparent",
            }}
          />

          <span
            style={{
              color:
                "#5F6368",

              fontSize: 19,
            }}
          >
            🔍
          </span>

        </div>


        {/* Search result */}

        {searchOpen &&
          searchResults.length >
            0 && (
            <div
              style={{
                marginTop: 5,

                background:
                  "#fff",

                border:
                  "1px solid #DADCE0",

                borderRadius: 12,

                boxShadow:
                  "0 4px 14px rgba(0,0,0,.2)",

                overflow:
                  "hidden",
              }}
            >

              {searchResults.map(
                (
                  item,
                  index
                ) => (
                  <button
                    key={`${item.kind}-${item.name}-${index}`}

                    type="button"

                    onMouseDown={(e) =>
                      e.preventDefault()
                    }

                    onClick={() =>
                      selectSearch(
                        item
                      )
                    }

                    style={{
                      width:
                        "100%",

                      display:
                        "flex",

                      alignItems:
                        "center",

                      gap: 10,

                      padding:
                        "10px 12px",

                      border:
                        "none",

                      borderBottom:
                        index <
                        searchResults.length -
                          1
                          ? "1px solid #ECEFF1"
                          : "none",

                      background:
                        "#fff",

                      cursor:
                        "pointer",

                      textAlign:
                        "left",
                    }}
                  >

                    <span
                      style={{
                        width: 28,
                        textAlign:
                          "center",

                        fontSize: 18,
                      }}
                    >
                      {
                        item.icon
                      }
                    </span>


                    <span
                      style={{
                        minWidth: 0,
                      }}
                    >

                      <span
                        style={{
                          display:
                            "block",

                          fontWeight:
                            700,

                          fontSize: 13,

                          color:
                            "#202124",
                        }}
                      >
                        {
                          item.name
                        }
                      </span>


                      {item.kind ===
                        "room" && (
                        <span
                          style={{
                            display:
                              "block",

                            marginTop: 2,

                            fontSize: 11,

                            color:
                              "#5F6368",
                          }}
                        >
                          {
                            item.room
                              .building
                          }
                          {" · "}
                          ชั้น{" "}
                          {
                            item.room
                              .floor
                          }
                        </span>
                      )}

                    </span>

                  </button>
                )
              )}

            </div>
          )}

      </div>


      {/* ===================================================
          Legend
          =================================================== */}

      {b && (
        <div
          style={{
            position:
              "absolute",

            left: 12,

            bottom: 12,

            zIndex: 1100,

            display:
              "flex",

            flexWrap:
              "wrap",

            gap: 6,

            maxWidth:
              "calc(100% - 24px)",
          }}
        >

          {[
            [
              "🚪",
              "ห้องเรียน",
            ],
            [
              "🚻",
              "ห้องน้ำ",
            ],
            [
              "🛗",
              "ลิฟต์",
            ],
            [
              "🪜",
              "บันได",
            ],
            [
              "🚪",
              "ทางเข้า/ออก",
            ],
          ].map(
            ([
              icon,
              label,
            ]) => (
              <div
                key={label}
                style={{
                  background:
                    "rgba(255,255,255,.94)",

                  border:
                    "1px solid #DADCE0",

                  borderRadius:
                    18,

                  padding:
                    "5px 9px",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap: 5,

                  fontSize: 11.5,

                  fontWeight: 700,

                  color:
                    "#3C4043",

                  boxShadow:
                    "0 1px 4px rgba(0,0,0,.15)",
                }}
              >

                <span>
                  {icon}
                </span>

                <span>
                  {label}
                </span>

              </div>
            )
          )}

        </div>
      )}


      {/* ===================================================
          Building / Floor selector
          =================================================== */}

      {b ? (
        <div
          style={{
            position:
              "absolute",

            top: 12,

            right: 12,

            zIndex: 1100,

            display:
              "flex",

            flexDirection:
              "column",

            alignItems:
              "flex-end",

            gap: 7,
          }}
        >

          {/* Building name */}

          <div
            style={{
              background:
                "#fff",

              border:
                "1px solid #DADCE0",

              borderRadius:
                20,

              padding:
                "6px 10px 6px 14px",

              display:
                "flex",

              alignItems:
                "center",

              gap: 8,

              fontSize: 13,

              fontWeight: 800,

              color:
                "#202124",

              boxShadow:
                "0 2px 8px rgba(0,0,0,.16)",
            }}
          >

            <span>
              {b.name}
            </span>


            <button
              type="button"

              onClick={() => {
                setOpenKey(
                  null
                );

                setSearch(
                  ""
                );

                setSearchOpen(
                  false
                );

                onChangeRef.current?.({
                  building:
                    null,

                  floor: "1",
                });
              }}

              style={{
                width: 22,
                height: 22,

                border: "none",

                borderRadius:
                  "50%",

                background:
                  "#F1F3F4",

                color:
                  "#5F6368",

                cursor:
                  "pointer",

                display:
                  "grid",

                placeItems:
                  "center",
              }}
            >
              ✕
            </button>

          </div>


          {/* Floors */}

          <div
            style={{
              background:
                "#fff",

              border:
                "1px solid #DADCE0",

              borderRadius:
                24,

              padding: 4,

              display:
                "flex",

              flexDirection:
                "column",

              gap: 3,

              boxShadow:
                "0 2px 8px rgba(0,0,0,.16)",
            }}
          >

            {mergedFloors
              .slice()
              .reverse()
              .map(
                (f) => {
                  const active =
                    String(
                      f.id
                    ) ===
                    String(
                      curFloor
                    );

                  return (
                    <button
                      key={f.id}

                      type="button"

                      onClick={() => {
                        setCurFloor(
                          f.id
                        );

                        onChangeRef.current?.({
                          building:
                            b.name,

                          floor:
                            f.id,
                        });
                      }}

                      style={{
                        width: 36,
                        height: 36,

                        border:
                          "none",

                        borderRadius:
                          "50%",

                        cursor:
                          "pointer",

                        background:
                          active
                            ? "#1A73E8"
                            : "transparent",

                        color:
                          active
                            ? "#fff"
                            : "#3C4043",

                        fontWeight:
                          800,

                        fontSize: 13,
                      }}
                    >
                      {
                        f.label
                      }
                    </button>
                  );
                }
              )}

          </div>

        </div>
      ) : (
        <div
          style={{
            position:
              "absolute",

            top: 12,

            right: 12,

            zIndex: 1100,

            background:
              "#fff",

            border:
              "1px solid #DADCE0",

            borderRadius:
              20,

            padding:
              "7px 13px",

            fontSize: 12,

            fontWeight: 700,

            color:
              "#3C4043",

            boxShadow:
              "0 2px 8px rgba(0,0,0,.12)",
          }}
        >
          🏢 กดเลือกอาคาร
        </div>
      )}

    </div>
  );
}