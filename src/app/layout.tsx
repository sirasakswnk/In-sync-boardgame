import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/500.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import '@fontsource/noto-sans-thai/800.css';
import '@fontsource/noto-sans-thai/900.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'IN SYNC',
  description: 'เกมจัดอันดับสำหรับสองคน — เรียงของที่ชอบ ทายใจอีกคน แล้วเปิดเฉลยพร้อมกัน',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fff8f0',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
