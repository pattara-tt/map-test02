-- ============================================================
-- SciMap — โครงสร้างฐานข้อมูล (PostgreSQL / Cloud SQL)
-- รันด้วย:  psql "$DATABASE_URL" -f db/schema.sql
-- ชื่อคอลัมน์ใช้ snake_case ฝั่ง DB และแปลงเป็น camelCase อัตโนมัติที่ lib/pg.js
-- ============================================================

BEGIN;

-- ─────────── ผู้ใช้งานและสิทธิ์ ───────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,              -- production: เก็บ bcrypt hash ไม่ใช่ plaintext
  name          TEXT NOT NULL,
  username      TEXT,
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('exec','marketing','gis','admin','pr','registrar','user')),
  institution   TEXT DEFAULT 'KMITL',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  suspend_reason TEXT,
  suspended_at DATE,
  suspended_by TEXT,

  restore_reason TEXT,
  restored_at DATE,
  restored_by TEXT,
  created_at    DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ─────────── คำร้อง (ฝ่ายดูแลระบบ) ───────────
CREATE TABLE IF NOT EXISTS requests (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL,                 -- หัวข้อคำร้อง
  detail       TEXT,
  room_id      TEXT,                          -- ห้องที่อ้างถึง (ถ้ามีอยู่ในตาราง rooms)
  node_id      TEXT,                          -- จุดบนผังอาคารที่ผู้ใช้กดแจ้ง
  before       JSONB,                         -- ข้อมูลเดิมในระบบ
  after        JSONB,                         -- ข้อมูลที่ผู้ใช้ขอให้แก้เป็น
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  note         TEXT DEFAULT '',
  reviewed_by  TEXT,
  reviewed_at  DATE,
  created_at   DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_requests_status  ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_user    ON requests(user_id);

-- โควตาการส่งคำร้อง (มีแถวเดียว)
CREATE TABLE IF NOT EXISTS request_quota (
  id                  TEXT PRIMARY KEY,
  per_user_per_day    INTEGER NOT NULL DEFAULT 3,
  per_user_per_month  INTEGER NOT NULL DEFAULT 20,
  updated_by          TEXT,
  updated_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          DATE NOT NULL DEFAULT CURRENT_DATE
);

-- แจ้งเตือนรายบุคคล (เช่น ผลการพิจารณาคำร้อง)
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'system',
  title       TEXT NOT NULL,
  body        TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- ─────────── ข้อเสนอแนะจากผู้ใช้ ───────────
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT,
  topic       TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed')),
  reply       TEXT DEFAULT '',
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- ─────────── บันทึกประวัติการแก้ไขข้อมูลแผนที่ ───────────
CREATE TABLE IF NOT EXISTS map_edits (
  id          TEXT PRIMARY KEY,
  at          TEXT NOT NULL,
  actor_id    TEXT,
  actor_name  TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  before      TEXT DEFAULT '-',
  after       TEXT DEFAULT '-',
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_map_edits_at ON map_edits(at DESC);

-- ─────────── ฝ่ายการตลาด: สัญญา / สิทธิ์สถาบัน / ประกาศ ───────────
CREATE TABLE IF NOT EXISTS contracts (
  id           TEXT PRIMARY KEY,
  institution  TEXT NOT NULL,
  plan         TEXT,
  start_date   DATE,
  end_date     DATE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  contact      TEXT,
  created_at   DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_contracts_end ON contracts(end_date);

CREATE TABLE IF NOT EXISTS institution_access (
  id           TEXT PRIMARY KEY,
  institution  TEXT NOT NULL,
  level        TEXT NOT NULL DEFAULT 'standard' CHECK (level IN ('full','standard','readonly')),
  modules      TEXT[] NOT NULL DEFAULT '{}',
  seats        INTEGER DEFAULT 0,
  updated_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT,
  audience    TEXT DEFAULT 'ทุกมหาวิทยาลัย',
  send_at     TIMESTAMP,          -- วัน-เวลาที่กำหนดให้ส่ง (อนาคต = ยังรอส่ง)
  sent_by     TEXT,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ─────────── ผู้ดูแลข้อมูลสถานที่และอาคาร ───────────
CREATE TABLE IF NOT EXISTS map_boundaries (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'building' CHECK (type IN ('campus','building','zone')),
  points      INTEGER DEFAULT 0,
  geometry    JSONB,                        -- เก็บ polygon [[lon,lat],...] ไว้ต่อยอดได้
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  updated_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS map_assets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'floorplan' CHECK (kind IN ('floorplan','image','icon')),
  file        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  building    TEXT,
  floor       TEXT,
  updated_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS map_drafts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  note        TEXT,
  saved_at    TEXT,
  saved_by    TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ─────────── ฝ่ายประชาสัมพันธ์ ───────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('event','place')),
  color       TEXT DEFAULT '#1A73E8',
  "desc"      TEXT,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_categories_kind ON categories(kind);

CREATE TABLE IF NOT EXISTS news (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT,
  publish_at    DATE,
  expire_at     DATE,
  published     BOOLEAN NOT NULL DEFAULT FALSE,
  author        TEXT,
  replaced_from TEXT,                       -- อ้างถึงฉบับเดิม เมื่อแก้ไขข่าวที่เผยแพร่แล้ว
  created_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT news_range CHECK (expire_at IS NULL OR publish_at IS NULL OR expire_at >= publish_at)
);
CREATE INDEX IF NOT EXISTS idx_news_window ON news(published, publish_at, expire_at);

CREATE TABLE IF NOT EXISTS events (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  detail                  TEXT,
  category_id             TEXT REFERENCES categories(id) ON DELETE SET NULL,
  start_at                TIMESTAMP,
  end_at                  TIMESTAMP,
  place_name              TEXT,
  lat                     DOUBLE PRECISION,
  lon                     DOUBLE PRECISION,
  temp_place_category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  published               BOOLEAN NOT NULL DEFAULT FALSE,
  author                  TEXT,
  replaced_from           TEXT,
  created_at              DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT events_range CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS idx_events_window   ON events(published, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);

CREATE TABLE IF NOT EXISTS event_interest (
  id          TEXT PRIMARY KEY,
  event_id    TEXT REFERENCES events(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (event_id, user_id)                -- ผู้ใช้หนึ่งคนกดสนใจกิจกรรมเดียวกันได้ครั้งเดียว
);

CREATE TABLE IF NOT EXISTS event_stats (
  event_id    TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  interested  INTEGER NOT NULL DEFAULT 0,
  searched    INTEGER NOT NULL DEFAULT 0
);

-- ─────────── ฝ่ายทะเบียน: ชั้นและห้อง ───────────
CREATE TABLE IF NOT EXISTS floors (
  id          TEXT PRIMARY KEY,
  building    TEXT NOT NULL,
  floor       TEXT NOT NULL,
  name        TEXT,
  svg         TEXT,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft')),
  created_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (building, floor)
);

CREATE TABLE IF NOT EXISTS rooms (
  id           TEXT PRIMARY KEY,
  building     TEXT NOT NULL,
  floor        TEXT NOT NULL,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT,
  capacity     INTEGER,
  teacher      TEXT,
  node_id      TEXT,                        -- ผูกกับ node บนผังชั้นใน mapConstants.js
  category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (building, floor, code)
);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building, floor);

-- ─────────── สถิติภาพรวมระบบ (รายเดือน) ───────────
CREATE TABLE IF NOT EXISTS usage (
  month         TEXT PRIMARY KEY,           -- รูปแบบ 'YYYY-MM'
  active_users  INTEGER DEFAULT 0,
  searches      INTEGER DEFAULT 0,
  routes        INTEGER DEFAULT 0
);

COMMIT;
