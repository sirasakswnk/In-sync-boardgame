'use client';

import Link from 'next/link';
import { messageFor, type ClientErrorCode } from '@/lib/client/api';
import styles from './room.module.css';

export function RoomLoading() {
  return (
    <main className={styles.center} aria-busy="true">
      <div className={styles.loadingCards} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p role="status">กำลังเปิดห้อง…</p>
    </main>
  );
}

const TITLES: Partial<Record<ClientErrorCode, { emoji: string; title: string }>> = {
  ROOM_NOT_FOUND: { emoji: '🔍', title: 'ไม่พบห้องนี้' },
  ROOM_FULL: { emoji: '🙅', title: 'ห้องนี้เต็มแล้ว' },
  ROOM_CLOSED: { emoji: '🚪', title: 'ห้องนี้ปิดแล้ว' },
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
  return (
    <main className={styles.center}>
      <div className={styles.problem}>
        <span className={styles.problemEmoji} aria-hidden="true">
          {emoji ?? preset?.emoji ?? '😵'}
        </span>
        <h1>{title ?? preset?.title ?? 'เกิดข้อผิดพลาด'}</h1>
        <p>{message ?? (code ? messageFor(code) : '')}</p>
        <div className={styles.problemActions}>
          {retryable && (
            <button type="button" className={styles.linkButton} onClick={() => window.location.reload()}>
              ลองใหม่
            </button>
          )}
          <Link href="/" className={styles.homeLink}>
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </main>
  );
}
