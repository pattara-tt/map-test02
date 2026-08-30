# การติดตั้ง SciMap บน Compute Engine VM (Docker Compose)

รันทั้ง 3 ส่วนบน VM เครื่องเดียว แยกเป็นคนละคอนเทนเนอร์

```
┌──────────── VM (Compute Engine) ────────────┐
│                                             │
│  frontend  :80 → :3000   Next.js            │
│      │ rewrite /api/*                       │
│      ▼                                      │
│  backend   :4000 (ภายใน)  Express API       │
│      │                                      │
│      ▼                                      │
│  db        :5432 (ภายใน)  PostgreSQL 16     │
│                                             │
└─────────────────────────────────────────────┘
```

มีเพียง frontend เท่านั้นที่เปิดพอร์ตออกอินเทอร์เน็ต backend กับ db คุยกันผ่าน
เครือข่ายภายในของ Docker เท่านั้น จึงไม่ต้องเปิด firewall ให้พอร์ต 4000/5432

## 1. สร้าง VM

Console → Compute Engine → **Create instance**

| หัวข้อ | ค่าที่แนะนำ |
|---|---|
| Region | `asia-southeast1` (สิงคโปร์) |
| Machine type | `e2-medium` (4 GB) — build Next.js ในคอนเทนเนอร์กิน RAM พอสมควร |
| Boot disk | Ubuntu 24.04 LTS, 30 GB |
| Firewall | ติ๊ก **Allow HTTP traffic** |

> ถ้าใช้ `e2-small` (2 GB) ให้เพิ่ม swap ก่อน build:
> ```bash
> sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

## 2. ติดตั้ง Docker

กดปุ่ม **SSH** ในหน้า VM instances แล้วรัน:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker      # หรือ logout แล้ว SSH เข้าใหม่
docker compose version
```

## 3. อัปโหลดโค้ด

```bash
# วิธีที่ 1 — Git
git clone YOUR_REPO_URL scimap && cd scimap

# วิธีที่ 2 — อัปโหลด zip ผ่านปุ่ม ⚙️ → Upload file ในหน้าต่าง SSH
sudo apt-get update && sudo apt-get install -y unzip
unzip ise-kmitlMap.zip && cd ise-kmitlMap
```

## 4. ตั้งรหัสผ่านฐานข้อมูลแล้วรัน

```bash
cp .env.example .env
nano .env                      # แก้ POSTGRES_PASSWORD
docker compose up -d --build
```

ครั้งแรกจะใช้เวลาสัก 3–5 นาที (ดาวน์โหลด image + build) จากนั้นเปิดที่
`http://EXTERNAL_IP` ได้เลย

`db/schema.sql` และ `db/seed.sql` จะถูกรันให้อัตโนมัติตอนสร้างฐานข้อมูลครั้งแรก
ไม่ต้องรัน psql เอง

## 5. คำสั่งที่ใช้บ่อย

```bash
docker compose ps                      # ดูสถานะทั้ง 3 คอนเทนเนอร์
docker compose logs -f backend         # ดู log เฉพาะ backend
docker compose logs -f frontend
docker compose restart backend
docker compose down                    # หยุด (ข้อมูลใน volume ยังอยู่)
docker compose exec db psql -U kmitlmap kmitlmap    # เข้า database
```

## 6. อัปเดตโค้ดใหม่

```bash
git pull                        # หรืออัปโหลด zip ใหม่แล้ว unzip ทับ
docker compose up -d --build
```

Docker จะ build เฉพาะ service ที่ไฟล์เปลี่ยน และข้อมูลใน volume `db_data` ไม่หาย

## 7. สำรองฐานข้อมูล

```bash
# สำรอง
docker compose exec -T db pg_dump -U kmitlmap -Fc kmitlmap > backup-$(date +%F).dump

# กู้คืน
docker compose exec -T db pg_restore -U kmitlmap -d kmitlmap --clean < backup-2026-08-25.dump
```

ตั้ง cron ให้ทำอัตโนมัติ:
```bash
crontab -e
0 2 * * * cd ~/ise-kmitlMap && docker compose exec -T db pg_dump -U kmitlmap -Fc kmitlmap > ~/backups/scimap-$(date +\%F).dump
```

แนะนำให้ส่งไฟล์ backup ขึ้น Cloud Storage ด้วย (`gsutil cp`) เพราะถ้า disk ของ VM
เสียหาย ไฟล์ที่อยู่บน VM เดียวกันก็หายไปพร้อมกัน

## 8. ใส่โดเมนและ HTTPS

วิธีง่ายที่สุดคือเพิ่ม Caddy เป็น reverse proxy หน้า frontend เพราะขอใบรับรอง
ให้อัตโนมัติ — เพิ่มใน `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    command: caddy reverse-proxy --from map.example.ac.th --to frontend:3000
    networks: [scimap]
    volumes: [caddy_data:/data]
```

แล้วเปลี่ยน `ports` ของ frontend เป็น `expose: ["3000"]` และเพิ่ม
`caddy_data:` ในบล็อก `volumes:`

## หมายเหตุด้านความปลอดภัย

- db และ backend ใช้ `expose` ไม่ใช่ `ports` — เข้าถึงได้เฉพาะจากคอนเทนเนอร์
  ในเครือข่ายเดียวกัน ไม่หลุดออกอินเทอร์เน็ต
- ทั้งสอง image รันด้วย user ที่ไม่ใช่ root
- `.env` ห้าม commit ขึ้น git (มี `.gitignore` ครอบไว้แล้ว)
- **ยังต้องทำก่อนใช้จริง:** `users.password` เก็บเป็น plaintext ตาม mock
  ควรเปลี่ยนเป็น bcrypt hash ใน `backend/src/server.js`

## รันบนเครื่องตัวเองโดยไม่ใช้ Docker

ยังทำได้เหมือนเดิม เปิด 2 เทอร์มินัล:

```bash
# เทอร์มินัล 1 — backend (ไม่ตั้ง DATABASE_URL = ใช้ mock in-memory)
cd backend && npm install && npm run dev

# เทอร์มินัล 2 — frontend
npm install && npm run dev
```
