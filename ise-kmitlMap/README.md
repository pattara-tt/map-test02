# SciMap

ระบบแผนที่และนำทางภายในสถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง

## สถาปัตยกรรม

แยกเป็น 3 ส่วน รันเป็นคนละคอนเทนเนอร์

| ส่วน | เทคโนโลยี | พอร์ต | หน้าที่ |
|---|---|---|---|
| frontend | Next.js 16 | 3000 (เปิดออก 80) | UI ทั้งหมด + พร็อกซี `/api/*` ไป backend |
| backend | Express | 4000 (ภายใน) | API ทุกเส้น + พร็อกซี OpenStreetMap |
| db | PostgreSQL 16 | 5432 (ภายใน) | ฐานข้อมูล |

> **frontend ไม่ต่อฐานข้อมูลเอง** ทุก request ที่ขึ้นต้นด้วย `/api/` จะถูกส่งต่อไป backend
> โดย `app/api/[...path]/route.js` ซึ่งอ่านค่า `BACKEND_URL` ตอน request จริง
> ถ้า backend ไม่ทำงาน ทุก API จะตอบ `{"ok":false,"error":"เชื่อมต่อ backend ไม่ได้"}` (HTTP 502)

---

## วิธีรันด้วย Docker (แนะนำ)

### ครั้งแรก

```bash
cp .env.example .env      # แล้วเปิดแก้ POSTGRES_PASSWORD เป็นรหัสของตัวเอง
docker compose up -d --build
```

เปิดที่ http://localhost — `db/schema.sql` กับ `db/seed.sql` จะรันให้อัตโนมัติ

### ⚠️ ข้อควรระวัง 2 เรื่อง

**1. ไฟล์ `.env` ต้องเป็น LF ไม่ใช่ CRLF**

ถ้าไฟล์ลงท้ายบรรทัดด้วย CRLF (มักเกิดตอนแก้ไฟล์บน Windows) รหัสผ่านจะมีอักขระ `\r`
ติดท้ายไปด้วย ทำให้ backend ต่อ db ไม่ได้ ตรวจด้วย:

```bash
file .env        # ต้องไม่ขึ้นคำว่า "CRLF line terminators"
```

ถ้าเป็น CRLF ให้แก้ด้วย `dos2unix .env` หรือใน VS Code กดที่คำว่า CRLF มุมขวาล่างแล้วเปลี่ยนเป็น LF

**2. แก้ `db/seed.sql` แล้วข้อมูลไม่เปลี่ยน → ต้องล้าง volume**

ไฟล์ใน `docker-entrypoint-initdb.d` จะรัน **ครั้งเดียวตอนสร้าง volume ใหม่เท่านั้น**
ถ้าเคยรันไปแล้ว ข้อมูลเก่าจะค้างอยู่ตลอดไม่ว่าจะแก้ `seed.sql` กี่รอบ

```bash
docker compose down -v          # -v สำคัญมาก คือการลบ volume ทิ้ง
docker compose up -d --build
```

### คำสั่งที่ใช้บ่อย

```bash
docker compose logs -f backend      # ดู log ของ backend
docker compose logs -f db           # ดู log ตอน db รัน schema/seed
docker compose ps                   # ดูสถานะทั้ง 3 คอนเทนเนอร์
docker compose restart backend      # รีสตาร์ทเฉพาะ backend
docker compose down                 # หยุด (ข้อมูลใน db ยังอยู่)
docker compose down -v              # หยุด + ล้างข้อมูล db ทั้งหมด
```

### เข้าไปดูข้อมูลใน db โดยตรง

```bash
docker compose exec db psql -U kmitlmap -d kmitlmap -c "SELECT id, email, name FROM users;"
```

ดูขั้นตอนขึ้น Google Cloud VM ที่ [deploy/DEPLOY.md](deploy/DEPLOY.md)

---

## วิธีรันแบบไม่ใช้ Docker

ไม่ตั้ง `DATABASE_URL` = backend จะใช้ mock in-memory (ข้อมูลรีเซ็ตทุกครั้งที่รีสตาร์ท)

### ติดตั้ง dependency — ต้องทำ **ทั้งสองที่**

```bash
npm install                 # ที่ root (frontend)
cd backend && npm install   # ฝั่ง backend
cd ..
```

> นี่คือจุดที่พลาดกันบ่อยที่สุด ถ้าลืม `npm install` ใน `backend/` โปรเจกต์จะเปิดหน้าเว็บได้
> แต่ทุก API จะตอบ 502 ตรวจว่ามีโฟลเดอร์ `backend/node_modules` โผล่ขึ้นมาจริง

### เปิด 2 เทอร์มินัลรันคู่กัน

เทอร์มินัลที่ 1 — backend:
```bash
cd backend
npm run dev
```
ต้องขึ้น `[scimap-backend] listening on :4000 · storage=memory` แล้วปล่อยค้างไว้ ห้ามปิด

เทอร์มินัลที่ 2 — frontend (ที่ root):
```bash
npm run dev
```

เปิดที่ http://localhost:3000

> ไม่ต้องใช้ API key ใดๆ

### ตรวจว่าทำงานถูก

```bash
curl http://localhost:4000/health
# {"ok":true,"backend":"scimap","storage":"memory"}
```

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| ทุก API ตอบ `เชื่อมต่อ backend ไม่ได้` | backend ไม่ได้รัน หรือลืม `npm install` ใน `backend/` | เปิดเทอร์มินัลที่ 2 รัน backend |
| ล็อกอินแล้วเห็น**ชื่อผู้ใช้เก่า** ไม่ตรงกับ `db/seed.sql` | เบราว์เซอร์จำ user เดิมไว้ใน `localStorage` key `kmitlmap:user` | F12 → Application → Clear site data แล้วรีเฟรช |
| แก้ `db/seed.sql` แล้วข้อมูลไม่เปลี่ยน | volume เก่ายังอยู่ | `docker compose down -v` แล้ว build ใหม่ |
| `sh: next: Permission denied` | ก็อป `node_modules` ข้ามเครื่อง/ผ่าน zip แล้วสิทธิ์หาย | `rm -rf node_modules && npm install` |
| build cache ค้าง เห็นโค้ดเวอร์ชันเก่า | `.next/` ติดมาด้วย | `rm -rf .next` แล้วรันใหม่ |

---

## บัญชีทดสอบ (รหัสผ่าน `1234` ทุกบัญชี)

| E-mail | ชื่อ | Actor |
|---|---|---|
| exec@kmitl.ac.th | จินยอง ปาร์ค | บริหาร |
| marketing@kmitl.ac.th | อาฮยาน จาง | ฝ่ายการตลาด |
| gis@kmitl.ac.th | ธานอส ซัง | ผู้ดูแลข้อมูลสถานที่และอาคาร |
| admin@kmitl.ac.th | แตงโม จัง | ฝ่ายดูแลระบบ |
| pr@kmitl.ac.th | อาสะ คิม | ฝ่ายประชาสัมพันธ์ |
| registrar@kmitl.ac.th | ฮง ไลเคน | ฝ่ายทะเบียน |
| student@kmitl.ac.th | อินฟินิตี้ ไอ | ผู้ใช้งานทั่วไป |
| somchai@kmitl.ac.th | สมชาย ตั้งมั่น | ผู้ใช้งานทั่วไป (บัญชีถูกระงับ — ใช้ทดสอบ UC16) |

> ชื่อในตารางนี้ต้องตรงกับ `db/seed.sql` และ `backend/src/store.js` เสมอ
> ถ้าไม่ตรง ให้ดูหัวข้อ "แก้ปัญหาที่พบบ่อย" ด้านบน

---

## API

ทุกเส้นเรียกผ่าน frontend ที่ `/api/...` (ถูก proxy ไป backend อัตโนมัติ)

| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/health` | health check (เรียกที่ backend ตรงๆ :4000) |
| `POST` | `/api/auth` | ลงทะเบียน / เข้าสู่ระบบ (UC27, UC28) |
| `GET` | `/api/data/:name` | อ่านข้อมูล collection |
| `POST` | `/api/data/:name` | เพิ่มข้อมูล |
| `PATCH` | `/api/data/:name` | แก้ไขข้อมูล |
| `DELETE` | `/api/data/:name` | ลบข้อมูล |
| `GET` | `/api/stats` | สถิติภาพรวม (UC1, UC14, UC20) |
| `GET` | `/api/osm` | ข้อมูลอาคารจาก OpenStreetMap |
| `GET` | `/api/walknet` | โครงข่ายทางเดิน |

collection ที่รองรับใน `/api/data/:name` — `users`, `requests`, `feedback`, `mapEdits`,
`contracts`, `institutionAccess`, `broadcasts`, `mapBoundaries`, `mapAssets`, `mapDrafts`,
`categories`, `news`, `events`, `eventInterest`, `eventStats`, `floors`, `rooms`, `usage`,
`requestQuota`, `notifications`

---

## ขอบเขตงาน (Use Case)

| Actor | Use Case |
|---|---|
| บริหาร | UC1 ดูรายงานและสถิติภาพรวมระบบ · UC2 ตรวจสอบข้อเสนอแนะและคำขอจากผู้ใช้งานทั่วไป · UC3 ตรวจสอบบันทึกประวัติการแก้ไขข้อมูลแผนที่ |
| ฝ่ายการตลาด | UC4 ติดตามวันหมดอายุสัญญาบริการ · UC5 ส่งข้อความแจ้งเตือนระบบถึงทุกมหาวิทยาลัย · UC6 จัดการสิทธิ์การเข้าถึงระดับสถาบัน |
| ผู้ดูแลข้อมูลสถานที่และอาคาร | UC7 จัดการขอบเขตแผนผัง · UC8 จัดการข้อมูลประกอบแผนผัง · UC9 บันทึกข้อมูลแผนที่ |
| ฝ่ายดูแลระบบ | UC10 ค้นหาและเรียกดูข้อมูลผู้ใช้งาน · UC11 ค้นหาและเรียกดูข้อมูลคำร้อง · UC12 จัดการแก้ไขสิทธิ์ผู้ใช้งาน · UC13 ตรวจสอบและพิจารณาคำร้อง · UC14 จัดทำรายงานสรุปข้อมูลคำร้อง · UC15 กำหนดจำนวนการส่งคำร้อง · UC16 จัดการสถานะบัญชีของผู้ใช้งาน |
| ฝ่ายประชาสัมพันธ์ | UC17 จัดการข้อมูลข่าวสารและกิจกรรม · UC18 จัดการข้อมูลตำแหน่งกิจกรรมและการค้นหาบนแผนที่ · UC19 จัดหมวดหมู่สถานที่และกิจกรรม · UC20 ตรวจสอบสถิติความสนใจของกิจกรรม · UC29 เพิ่ม/แก้ไข/ลบหมวดหมู่ |
| ฝ่ายทะเบียน | UC21 จัดการรายละเอียดข้อมูลห้อง · UC22 จัดการรายละเอียดข้อมูลชั้น |
| ผู้ใช้งานทั่วไป | UC23 ค้นหาห้องเรียน/อาคาร/ชื่ออาจารย์ · UC24 ค้นหาวิธีไปยังจุดหมาย · UC25 ส่งข้อเสนอแนะหรือแจ้งปัญหา · UC26 เพิ่มกิจกรรมที่สนใจเข้าร่วม |
| ผู้ใช้งานทุกคน | UC27 ลงทะเบียนเข้าใช้ระบบ · UC28 เข้าสู่ระบบด้วย E-mail |

---

## โครงสร้างไฟล์

```
app/                        ── frontend (Next.js)
  page.jsx                  เกตล็อกอิน + เมนูตาม Actor + shell
  layout.jsx                metadata / ฟอนต์ / Leaflet CSS
  api/[...path]/route.js    พร็อกซี /api/* ทั้งหมดไป backend

components/
  AuthPage.jsx              UC27, UC28
  UserApp.jsx               UC23–UC26
  panels/*.jsx              UC1–UC22, UC29 แยกตาม Actor
  MapView.jsx               แผนที่ + ผังชั้นในอาคาร + นำทาง
  mapConstants.js           พิกัด/ขอบเขต/กราฟ node-edge ของอาคาร Sc8
  mapGeo.js                 คำนวณเส้นทาง (Dijkstra) และ geocoding
  mapBaseLayer.js           เรนเดอร์แผนที่พื้นสไตล์ Google Maps
  ui.jsx                    ชุด UI กลาง + hook เรียก API

backend/                    ── backend (Express)
  src/server.js             API ทุกเส้น
  src/store.js              เลือกใช้ pg.js หรือ mock in-memory
  src/pg.js                 อะแดปเตอร์ PostgreSQL (interface เดียวกับ mock)
  src/overpass.js           พร็อกซี OpenStreetMap / Overpass

lib/                        ── โค้ดที่ frontend ใช้ร่วมกัน
  usecases.js               สารบัญ Use Case ต่อ Actor
  schedule.js               คำนวณสถานะข่าว/กิจกรรมตามช่วงเวลา

db/
  schema.sql                โครงสร้างตาราง
  seed.sql                  ข้อมูลตัวอย่าง (ต้องตรงกับ backend/src/store.js)

public/data/                ผังชั้น SVG / ไอคอน / ภาพอาคาร
deploy/                     สคริปต์และคู่มือขึ้น Google Cloud VM
```

---

## หมายเหตุ

- ชื่อคอลัมน์ฝั่ง DB ใช้ `snake_case` และถูกแปลงเป็น `camelCase` อัตโนมัติที่ `backend/src/pg.js`
- ข้อมูลตัวอย่างมี **2 ชุดที่ต้องตรงกันเสมอ** — `db/seed.sql` (ใช้ตอนต่อ PostgreSQL) และ
  `backend/src/store.js` (ใช้ตอนรัน mock) ถ้าแก้ที่หนึ่งต้องแก้อีกที่ด้วย
- โหมด mock in-memory ข้อมูลจะรีเซ็ตทุกครั้งที่รีสตาร์ท backend เหมาะกับการพัฒนา/เดโมเท่านั้น
- ส่วนที่ไม่อยู่ในขอบเขต SciMap ถูกลบออกแล้ว ได้แก่ ระบบเดินกลางคืน/ไฟส่องสว่าง (streetlight,
  จุดมืด), การคำนวณร่มเงา/แดด, ข้อมูลน้ำท่วมและ Traffy Fondue, กล้อง CCTV, โหมดนำทาง 3D และแชทบอท AI

### สิ่งที่ต้องแก้ก่อนใช้งานจริง (production)

- รหัสผ่านในตาราง `users` เก็บเป็น plaintext — ต้องเปลี่ยนเป็น bcrypt hash
- `GET /api/data/users` ส่งฟิลด์ `password` กลับมาด้วย — ควรกรองออกที่ `backend/src/server.js`
- ยังไม่มีระบบ session/token จริง — `app/page.jsx` เก็บ user ไว้ใน `localStorage` ตรงๆ
- ไม่ควร commit ไฟล์ `.env` ขึ้น git ควรใส่ไว้ใน `.gitignore`