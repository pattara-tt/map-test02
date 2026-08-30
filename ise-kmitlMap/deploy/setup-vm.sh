#!/usr/bin/env bash
# ============================================================
# KMITL MAP — ติดตั้งทั้งเว็บแอปและฐานข้อมูลบน VM ตัวเดียว
# ทดสอบบน Compute Engine e2-small / Ubuntu 24.04 LTS
#
# วิธีใช้:
#   sudo bash deploy/setup-vm.sh
# ============================================================
set -euo pipefail

DB_NAME="${DB_NAME:-kmitlmap}"
DB_USER="${DB_USER:-kmitlmap}"
DB_PASS="${DB_PASS:-}"
APP_DIR="${APP_DIR:-/opt/kmitlmap}"
APP_USER="${APP_USER:-kmitlmap}"

if [[ -z "$DB_PASS" ]]; then
  echo "กรุณากำหนดรหัสผ่านฐานข้อมูลก่อน เช่น:"
  echo "  sudo DB_PASS='รหัสผ่านที่ต้องการ' bash deploy/setup-vm.sh"
  exit 1
fi

echo "▶ ติดตั้ง PostgreSQL, Node.js 22 และ Nginx"
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib nginx curl ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
apt-get install -y -qq nodejs

echo "▶ สร้างฐานข้อมูลและผู้ใช้"
# PostgreSQL ฟังเฉพาะ localhost อยู่แล้วโดยดีฟอลต์ — ไม่ต้องเปิดพอร์ตออกอินเทอร์เน็ต
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='${DB_NAME}')\gexec
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo "▶ สร้างตารางและข้อมูลตัวอย่าง"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCRIPT_DIR/db/schema.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCRIPT_DIR/db/seed.sql"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};"

echo "▶ ติดตั้งแอปไปที่ ${APP_DIR}"
id -u "$APP_USER" &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude .next --exclude .git "$SCRIPT_DIR/" "$APP_DIR/"
cat > "$APP_DIR/.env.local" <<ENV
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
ENV
chmod 600 "$APP_DIR/.env.local"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev --no-audit --no-fund   # ติดตั้ง pg ด้วย (อยู่ใน optionalDependencies)
sudo -u "$APP_USER" npm run build

echo "▶ ตั้ง systemd service ให้รันอัตโนมัติเมื่อบูต"
cp "$SCRIPT_DIR/deploy/kmitlmap.service" /etc/systemd/system/kmitlmap.service
systemctl daemon-reload
systemctl enable --now kmitlmap

echo "▶ ตั้ง Nginx เป็น reverse proxy (พอร์ต 80 → 3000)"
cp "$SCRIPT_DIR/deploy/nginx.conf" /etc/nginx/sites-available/kmitlmap
ln -sf /etc/nginx/sites-available/kmitlmap /etc/nginx/sites-enabled/kmitlmap
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo
echo "✅ เสร็จแล้ว — เปิดที่ http://$(curl -s -H 'Metadata-Flavor: Google' metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || echo 'EXTERNAL_IP')"
echo "   ดู log:      sudo journalctl -u kmitlmap -f"
echo "   รีสตาร์ท:    sudo systemctl restart kmitlmap"
