# Deploy บน Vercel

## สิ่งที่เปลี่ยนไปจากเดิม

เดิมโปรเจกต์แยกเป็น 2 service (Next.js + Express backend) และ `app/api/[...path]/route.js`
ทำหน้าที่พร็อกซีไปหา `BACKEND_URL` — Vercel รัน long-running server แยกไม่ได้
จึงย้าย endpoint ทั้งหมดของ Express มาเป็น Next.js route handler:

| เดิม (Express)           | ใหม่ (Next.js)                 |
|--------------------------|--------------------------------|
| `POST /api/auth`         | `app/api/auth/route.js`        |
| `/api/data/:name` (CRUD) | `app/api/data/[name]/route.js` |
| `GET /api/stats`         | `app/api/stats/route.js`       |
| `GET /api/osm`           | `app/api/osm/route.js`         |
| `GET /api/walknet`       | `app/api/walknet/route.js`     |

โค้ดฝั่ง frontend ไม่ต้องแก้เลย เพราะ path เหมือนเดิมทุกตัว
โฟลเดอร์ `backend/` และไฟล์ Docker ถูกลบออกแล้ว เพราะ Vercel จะเห็น
`backend/package.json` แล้วตรวจจับเป็น **service ที่สอง** (Express) ทำให้บังคับให้เขียน
`vercel.json` แบบ multi-service และกด Deploy ไม่ผ่าน — ตอนนี้เหลือ service เดียวคือ Next.js
(โค้ด Express เดิมยังเก็บไว้ใน zip ชุดก่อนหน้าได้ ถ้าจะย้อนกลับ)

## ขั้นตอน deploy

1. push โค้ดขึ้น GitHub
2. Vercel → New Project → Import repo → Framework = Next.js (ตรวจจับอัตโนมัติ)
3. ตั้งค่า Environment Variables (ดูหัวข้อล่าง) แล้วกด Deploy

## ฐานข้อมูล — สำคัญมาก

ถ้าไม่ตั้ง `DATABASE_URL` ระบบจะใช้ mock in-memory store ซึ่ง **ข้อมูลจะหาย**
ทุกครั้งที่ serverless function ถูกรีไซเคิล และแต่ละ instance เห็นข้อมูลไม่ตรงกัน
ใช้ได้เฉพาะตอน demo สั้น ๆ เท่านั้น

สำหรับใช้งานจริงให้สร้าง Postgres (Vercel Postgres / Neon / Supabase) แล้ว:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

จากนั้นตั้งค่าใน Vercel → Settings → Environment Variables:

```
DATABASE_URL = postgresql://user:pass@host/dbname?sslmode=require
DB_SSL       = true
```

> Neon/Supabase ควรใช้ connection string แบบ **pooled** (pgbouncer)
> เพราะ serverless เปิดคอนเนกชันได้เยอะกว่าโหมดปกติ

## ถ้า Vercel ยังขึ้นว่า "multiple services"

แปลว่าใน repo ยังมีโฟลเดอร์ที่มี `package.json` ของตัวเองอยู่ (เช่น `backend/`)
ให้ลบออกจาก repo แล้ว push ใหม่ — `.vercelignore` ไม่ช่วย เพราะการตรวจจับ service
เกิดขึ้นก่อนขั้นตอน ignore

## กลับไปรันบน VM/Docker

เปิดคอมเมนต์ `output: "standalone"` ใน `next.config.js` แล้วเปลี่ยน
`"start"` ใน package.json กลับเป็น `"cd .next/standalone && node server.js"`
(ไม่ต้องใช้ Express แล้ว API อยู่ใน Next.js ทั้งหมด)
