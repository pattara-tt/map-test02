/** @type {import('next').NextConfig} */
const nextConfig = {
  // API ทั้งหมดอยู่ที่ backend service — frontend ส่งต่อผ่าน app/api/[...path]/route.js
  // ซึ่งอ่าน BACKEND_URL ตอน request จริง (เปลี่ยนค่าได้โดยไม่ต้อง build ใหม่)
  output: "standalone",
};

module.exports = nextConfig;
