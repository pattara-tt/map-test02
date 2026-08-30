/** @type {import('next').NextConfig} */
const nextConfig = {
  // API ทั้งหมดอยู่ใน app/api/* (route handlers) — deploy บน Vercel ได้เลย
  // ไม่ใช้ output:"standalone" เพราะ Vercel จัดการ build output ให้เอง
  // ถ้าจะกลับไปรันบน Docker/VM ให้เปิดบรรทัดล่างนี้แทน
  // output: "standalone",
  outputFileTracingIncludes: {
    "/api/**": ["./lib/**"],
  },
};

module.exports = nextConfig;
