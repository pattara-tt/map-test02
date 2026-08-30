-- ============================================================
-- ข้อมูลตัวอย่างสำหรับ SciMap (ตรงกับ mock ใน lib/store.js)
-- รันหลัง schema.sql:  psql "$DATABASE_URL" -f db/seed.sql
-- ============================================================

BEGIN;

INSERT INTO users (id, email, password, name, username, role, institution, status, created_at) VALUES
  ('U001','exec@kmitl.ac.th','1234','จินยอง ปาร์ค','exec','exec','KMITL','active','2026-01-12'),
  ('U002','marketing@kmitl.ac.th','1234','อาฮยาน จาง','marketing','marketing','KMITL','active','2026-01-12'),
  ('U003','gis@kmitl.ac.th','1234','ธานอส ซัง','gis','gis','KMITL','active','2026-01-15'),
  ('U004','admin@kmitl.ac.th','1234','แตงโม จัง','admin','admin','KMITL','active','2026-01-10'),
  ('U005','pr@kmitl.ac.th','1234','อาสะ คิม','pr','pr','KMITL','active','2026-02-02'),
  ('U006','registrar@kmitl.ac.th','1234','ฮง ไลเคน','registrar','registrar','KMITL','active','2026-02-02'),
  ('U007','student@kmitl.ac.th','1234','อินฟินิตี้ ไอ','student','user','KMITL','active','2026-03-01'),
  ('U008','somchai@kmitl.ac.th','1234','สมชาย ตั้งมั่น','somchai','user','KMITL','active','2026-03-04')
ON CONFLICT (id) DO NOTHING;

INSERT INTO request_quota (id, per_user_per_day, per_user_per_month, updated_by) VALUES
  ('RQ-CONF', 3, 20, 'U004')
ON CONFLICT (id) DO NOTHING;

INSERT INTO requests (id, user_id, subject, detail, room_id, node_id, before, after, status, note, created_at) VALUES
(
    'RQ-1001', 'U007', 'ขอแก้ไขข้อมูลห้อง 106', 'ขอเปลี่ยนประเภทห้อง 106 จากห้องเรียนเป็นห้องปฏิบัติการ', 'RM-01', 'Sc8StudyRoom3F1',
    '{"name":"ห้อง 106","type":"ห้องเรียน","capacity":45,"teacher":"อ.ดร. ปรีชา วงศ์ทอง"}',
    '{"name":"ห้อง 106","type":"ห้องปฏิบัติการ","capacity":45,"teacher":"อ.ดร. ปรีชา วงศ์ทอง"}',
    'pending', '','2026-08-24'
),

(
    'RQ-1002', 'U007', 'แจ้งข้อมูลอาจารย์ประจำห้อง 107 ไม่ถูกต้อง', 'ชื่ออาจารย์ประจำห้อง 107 ไม่ตรงกับข้อมูลที่แสดงในระบบ', 'RM-02', 'Sc8StudyRoom2F1',
    '{"name":"ห้อง 107","type":"ห้องปฏิบัติการ","capacity":40,"teacher":"อ.ดร. สุนิสา ภูผา"}',
    '{"name":"ห้อง 107","type":"ห้องปฏิบัติการ","capacity":40,"teacher":"อ.ดร. วิชัย ใจดี"}',
    'pending', '','2026-08-24'
),

(
    'RQ-1003', 'U008', 'แจ้งข้อมูลความจุ Coworking Space KDAI', 'ขอให้ตรวจสอบจำนวนที่นั่งของ Coworking Space KDAI', 'RM-03', 'Sc8CoWork1F1',
    '{"name":"Coworking Space KDAI","type":"พื้นที่ทำงานร่วม","capacity":60,"teacher":"-"}',
    '{"name":"Coworking Space KDAI","type":"พื้นที่ทำงานร่วม","capacity":70,"teacher":"-"}',
    'pending', '','2026-08-24'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feedback (id, user_id, user_name, topic, detail, status, reply, created_at) VALUES
  ('FB-2001','U007','อินฟินิตี้ ไอ','การใช้งานแผนที่','อยากให้ค้นหาด้วยรหัสวิชาได้','new','','2026-08-19'),
  ('FB-2002','U008','สมชาย ตั้งมั่น','ปัญหาการใช้ระบบ','กดค้นหาห้องน้ำแล้วหมุดไม่ขึ้น','reviewed','แก้ไขแล้วในเวอร์ชัน 1.2.3','2026-08-12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contracts (id, institution, plan, start_date, end_date, status, contact) VALUES
  ('CT-01','สจล. (KMITL)','Campus Pro','2025-09-01','2026-08-31','active','ict@kmitl.ac.th'),
  ('CT-02','มหาวิทยาลัย A','Campus Basic','2025-06-01','2026-09-15','active','it@univ-a.ac.th'),
  ('CT-03','มหาวิทยาลัย B','Campus Pro','2024-10-01','2026-08-26','active','admin@univ-b.ac.th'),
  ('CT-04','มหาวิทยาลัย C','Trial','2026-05-01','2026-07-31','expired','office@univ-c.ac.th')
ON CONFLICT (id) DO NOTHING;

INSERT INTO broadcasts (id, title, body, audience, send_at, sent_by) VALUES
  ('BC-01','แจ้งปิดปรับปรุงระบบ','ระบบจะปิดปรับปรุง 30 ส.ค. 2026 เวลา 01:00–03:00 น.','ทุกมหาวิทยาลัย','2026-08-15 10:00','อาฮยาน จาง'),
  ('BC-02','แจ้งกำหนดการบำรุงรักษาเซิร์ฟเวอร์','ระบบแผนที่จะไม่สามารถใช้งานได้ชั่วคราวในคืนวันที่กำหนด','ทุกมหาวิทยาลัย','2026-09-10 08:00','อาฮยาน จาง')
ON CONFLICT (id) DO NOTHING;

INSERT INTO institution_access (id, institution, level, modules, seats, updated_at) VALUES
  ('IA-01','สจล. (KMITL)','full', ARRAY['map','events','rooms','reports'], 5000,'2026-07-01'),
  ('IA-02','มหาวิทยาลัย A','standard', ARRAY['map','events'], 2000,'2026-06-11'),
  ('IA-03','มหาวิทยาลัย B','full', ARRAY['map','events','rooms'], 3500,'2026-05-20'),
  ('IA-04','มหาวิทยาลัย C','readonly', ARRAY['map'], 300,'2026-05-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, kind, color, "desc") VALUES
  ('CAT-01','วิชาการ','event','#1A73E8','สัมมนา บรรยาย อบรม'),
  ('CAT-02','กีฬา/นันทนาการ','event','#188038','กิจกรรมกีฬาและสันทนาการ'),
  ('CAT-03','อาคารเรียน','place','#E37400','อาคารสำหรับการเรียนการสอน'),
  ('CAT-04','โรงอาหาร','place','#D93025','จุดจำหน่ายอาหารและเครื่องดื่ม'),
  ('CAT-05','ลานกิจกรรม','place','#8430CE','พื้นที่โล่งสำหรับจัดกิจกรรม')
ON CONFLICT (id) DO NOTHING;

INSERT INTO news (id, title, body, publish_at, expire_at, published, author, created_at) VALUES
  ('NW-01','ประกาศตารางสอบกลางภาค 1/2569','นักศึกษาสามารถตรวจสอบตารางสอบกลางภาคได้ที่ระบบทะเบียน','2026-08-20','2026-09-30',TRUE,'อาสะ คิม','2026-08-18'),
  ('NW-02','เปิดรับสมัครทุนการศึกษา ประจำปี 2569','เปิดรับสมัครทุนสำหรับนักศึกษาชั้นปีที่ 2 ขึ้นไป','2026-09-01','2026-10-15',TRUE,'อาสะ คิม','2026-08-22'),
  ('NW-03','แจ้งปิดปรับปรุงลิฟต์อาคาร Sc8','ลิฟต์ฝั่งทิศเหนือปิดปรับปรุงชั่วคราว','2026-07-01','2026-07-31',TRUE,'อาสะ คิม','2026-06-28'),
  ('NW-04','ร่าง: กำหนดการปฐมนิเทศนักศึกษาใหม่','อยู่ระหว่างรอยืนยันกำหนดการจากคณะ',NULL,NULL,FALSE,'อาสะ คิม','2026-08-23')
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, name, detail, category_id, start_at, end_at, place_name, lat, lon, temp_place_category_id, published, author, created_at) VALUES
  ('EV-01','ISE Open House 2026','เปิดบ้านคณะวิศวกรรมศาสตร์นานาชาติ','CAT-01','2026-09-05 09:00','2026-09-05 16:00','ลานหน้าอาคารพระจอมเกล้าฯ (Sc8)',13.729721,100.780099,'CAT-05',TRUE,'อาสะ คิม','2026-08-10'),
  ('EV-02','กีฬาสีภาควิชา','แข่งขันกีฬาสีประจำปี','CAT-02','2026-09-18 08:00','2026-09-19 17:00','สนามกีฬากลาง สจล.',13.7275,100.7772,NULL,TRUE,'อาสะ คิม','2026-08-12'),
  ('EV-03','อบรมการใช้งาน SciMap','อบรมสำหรับเจ้าหน้าที่ภาควิชา','CAT-01','2026-08-01 13:00','2026-08-01 16:00','Coworking Space KDAI',13.729,100.7799,NULL,TRUE,'อาสะ คิม','2026-07-20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_interest (id, event_id, user_id, created_at) VALUES
  ('EI-01','EV-01','U007','2026-08-20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_stats (event_id, interested, searched) VALUES
  ('EV-01',176,402), ('EV-02',41,88), ('EV-03',33,51)
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO floors (id, building, floor, name, svg, note, status) VALUES
  ('FL-01','Sc8','1','ชั้น 1','/data/floorplans/Sc8/floor1.svg','โถงต้อนรับ / Coworking','active'),
  ('FL-02','Sc8','2','ชั้น 2','/data/floorplans/Sc8/floor2.svg','ห้องเรียนรวม','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, building, floor, code, name, type, capacity, teacher, node_id, category_id) VALUES
  ('RM-01','Sc8','1','106','ห้อง 106','ห้องเรียน',45,'อ.ดร. ปรีชา วงศ์ทอง','Sc8StudyRoom3F1','CAT-03'),
  ('RM-02','Sc8','1','107','ห้อง 107','ห้องปฏิบัติการ',40,'อ.ดร. สุนิสา ภูผา','Sc8StudyRoom2F1','CAT-03'),
  ('RM-03','Sc8','1','KDAI','Coworking Space KDAI','พื้นที่ทำงานร่วม',60,'-','Sc8CoWork1F1','CAT-03'),
  ('RM-04','Sc8','1','108','ห้อง 108','ห้องเรียน',45,'อ.ดร. มานพ ศรีสุข','Sc8StudyRoom1F1','CAT-03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO map_boundaries (id, name, type, points, status, updated_at) VALUES
  ('MB-01','ขอบเขตวิทยาเขตลาดกระบัง','campus',42,'published','2026-08-01'),
  ('MB-02','ขอบเขตอาคารพระจอมเกล้าฯ (Sc8)','building',8,'published','2026-08-20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO map_assets (id, name, kind, file,status,building, floor, updated_at) VALUES
  ('MA-01','ผังชั้น 1 อาคาร Sc8','floorplan','/data/floorplans/Sc8/floor1.svg','published','Sc8','1','2026-08-06'),
  ('MA-02','ผังชั้น 2 อาคาร Sc8','floorplan','/data/floorplans/Sc8/floor2.svg','published','Sc8','2','2026-08-06'),
  ('MA-03','ภาพอาคาร Sc8','image','/data/places/sc8.png','published','Sc8',null,'2026-07-28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO map_drafts (id, name, note, saved_at, saved_by, status) VALUES
  ('MD-01','ปรับพิกัดทางเข้าอาคาร Sc8','ย้ายจุดทางเข้าฝั่งเหนือ 3 เมตร','2026-08-22 11:15','ธานอส ซัง','draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO map_edits (id, at, actor_id, actor_name, action, target, before, after) VALUES
  ('ML-3001','2026-08-20 14:02','U003','ธานอส ซัง','แก้ไขขอบเขตแผนผัง','ขอบเขตอาคารพระจอมเกล้าฯ (Sc8)','polygon v2','polygon v3'),
  ('ML-3002','2026-08-19 09:41','U006','ฮง ไลเคน','แก้ไขข้อมูลห้อง','ห้อง 107 ชั้น 1','ห้องเรียนรวม','ห้องปฏิบัติการ'),
  ('ML-3003','2026-08-17 16:20','U005','อาสะ คิม','เพิ่มตำแหน่งกิจกรรม','ISE Open House 2026','-','ลานหน้าอาคาร Sc8')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usage (month, active_users, searches, routes) VALUES
  ('2026-03',1820,9120,4310), ('2026-04',2110,10480,5020), ('2026-05',2450,12240,6110),
  ('2026-06',1980,8830,3990), ('2026-07',2680,13910,6840), ('2026-08',3120,16240,7930)
ON CONFLICT (month) DO NOTHING;

INSERT INTO notifications (id, user_id, kind, title, body, read, created_at) VALUES
  ('NT-001', 'U008','account','บัญชีถูกระงับ','บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', FALSE,'2026-08-26')
ON CONFLICT (id) DO NOTHING;

COMMIT;
