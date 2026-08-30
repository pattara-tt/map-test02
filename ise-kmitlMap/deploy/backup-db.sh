#!/usr/bin/env bash
# สำรองฐานข้อมูลรายวัน เก็บย้อนหลัง 14 วัน
# ตั้ง cron:  sudo crontab -e   แล้วใส่บรรทัด
#   0 2 * * * /opt/kmitlmap/deploy/backup-db.sh >> /var/log/kmitlmap-backup.log 2>&1
set -euo pipefail
DB_NAME="${DB_NAME:-kmitlmap}"
DEST="${DEST:-/var/backups/kmitlmap}"
mkdir -p "$DEST"
STAMP=$(date +%F-%H%M)
sudo -u postgres pg_dump -Fc "$DB_NAME" > "$DEST/$DB_NAME-$STAMP.dump"
find "$DEST" -name "*.dump" -mtime +14 -delete
echo "[$(date)] สำรองข้อมูลเรียบร้อย: $DEST/$DB_NAME-$STAMP.dump"
# แนะนำ: ส่งขึ้น Cloud Storage ด้วย เผื่อ VM เสียหายทั้งเครื่อง
#   gsutil cp "$DEST/$DB_NAME-$STAMP.dump" gs://YOUR_BUCKET/kmitlmap/
