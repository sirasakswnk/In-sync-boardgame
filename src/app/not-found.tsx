import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <span style={{ fontSize: 56 }} aria-hidden="true">
          🧭
        </span>
        <h1>ไม่พบหน้านี้</h1>
        <p style={{ color: 'var(--ink-muted)' }}>ลิงก์อาจพิมพ์ผิด หรือหน้านี้ไม่มีอยู่แล้ว</p>
        <Link href="/">กลับหน้าหลัก</Link>
      </div>
    </main>
  );
}
