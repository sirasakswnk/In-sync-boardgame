'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { messageFor, type ClientErrorCode } from '@/lib/client/api';
import styles from './screen.module.css';

/** โครงหน้าเดี่ยวนอกโต๊ะเกม: ผ้าเขียว ชื่อเกมด้านบน และ MADE FOR TWO ด้านล่าง */
function Screen({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div className={styles.page}>
      <main className={styles.wrap} aria-busy={busy || undefined}>
        <p className={styles.brand}>
          <span aria-hidden="true">♥♥</span>IN SYNC
        </p>
        {children}
        <p className={styles.footer}>
          MADE FOR TWO <span aria-hidden="true">♥</span>
        </p>
      </main>
    </div>
  );
}

export function RoomLoading() {
  return (
    <Screen busy>
      <div className={styles.loading}>
        {/* หลังไพ่ 3 ใบกางออกแล้วหุบ ระหว่างรอเปิดห้อง */}
        <div className={styles.deck} aria-hidden="true">
          <span className={styles.deckCard}>♥</span>
          <span className={styles.deckCard}>♥</span>
          <span className={styles.deckCard}>♥</span>
        </div>
        <p className={styles.loadingText} role="status">
          กำลังเปิดห้อง…
        </p>
      </div>
    </Screen>
  );
}

/**
 * หัวข้อของแต่ละกรณี — `message` ใช้แทนข้อความกลางเมื่อข้อความกลางขึ้นต้นซ้ำกับหัวข้อ
 * (ข้อความกลางยังใช้ตามเดิมในที่อื่น เช่น banner ตอนใส่รหัสห้องผิดบนหน้าแรก)
 */
const TITLES: Partial<Record<ClientErrorCode, { emoji: string; title: string; message?: string }>> = {
  ROOM_NOT_FOUND: { emoji: '🔍', title: 'ไม่พบห้องนี้', message: 'ลองตรวจรหัสอีกครั้ง หรือสร้างห้องใหม่' },
  ROOM_FULL: { emoji: '🙅', title: 'ห้องนี้เต็มแล้ว' },
  ROOM_CLOSED: { emoji: '🚪', title: 'ห้องนี้ปิดแล้ว', message: 'เล่นต่อในห้องนี้ไม่ได้แล้ว กลับหน้าหลักเพื่อสร้างห้องใหม่' },
  UNAUTHORIZED: { emoji: '🔒', title: 'เข้าห้องนี้ไม่ได้' },
  NETWORK: { emoji: '📡', title: 'เชื่อมต่อไม่ได้' },
  TIMEOUT: { emoji: '⏳', title: 'เซิร์ฟเวอร์ตอบช้า' },
};

/** หน้าข้อผิดพลาดของห้อง — มีทางกลับหน้าหลักเสมอ (plan.md §6.2) */
export function RoomProblem({
  code,
  emoji,
  title,
  message,
}: {
  code?: ClientErrorCode;
  emoji?: string;
  title?: string;
  message?: string;
}) {
  const preset = code ? TITLES[code] : undefined;
  const retryable = code === 'NETWORK' || code === 'TIMEOUT' || code === 'INTERNAL';
  const text = message ?? preset?.message ?? (code ? messageFor(code) : '');
  return (
    <Screen>
      <section className={styles.board} aria-labelledby="problem-title">
        <span className={styles.medal} aria-hidden="true">
          {emoji ?? preset?.emoji ?? '😵'}
        </span>
        <h1 id="problem-title" className={styles.title}>
          {title ?? preset?.title ?? 'เกิดข้อผิดพลาด'}
        </h1>
        {text && <p className={styles.message}>{text}</p>}
        <div className={styles.actions}>
          {retryable && (
            <button type="button" className={styles.paper} onClick={() => window.location.reload()}>
              ลองใหม่
            </button>
          )}
          <Link href="/" className={styles.primary}>
            กลับหน้าหลัก
          </Link>
        </div>
      </section>
    </Screen>
  );
}
