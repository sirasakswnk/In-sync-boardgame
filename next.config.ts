import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin ใช้ความสามารถของ Node เต็มรูปแบบ ไม่ต้อง bundle เข้า route handler
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
