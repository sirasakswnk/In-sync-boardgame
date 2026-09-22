'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PlayerView } from '@/lib/game';
import { useCopied, useInviteUrl } from '@/lib/client/clipboard';
import styles from './room.module.css';

type Props = { view: PlayerView; onLeave: () => void };

/**
 * เมนู ⋯ ในส่วนหัว: รหัสห้อง, คัดลอกรหัส/ลิงก์เชิญ, ชื่อเต็มของผู้เล่น และออกจากห้อง
 * “ออกจากห้อง” เรียก onLeave เดิม ซึ่งเปิด ConfirmDialog ก่อนส่งคำสั่ง leave
 */
export function RoomMenu({ view, onLeave }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrap = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const first = useRef<HTMLButtonElement | null>(null);
  const inviteUrl = useInviteUrl(view.code);
  const { copied, copy } = useCopied<'code' | 'link'>();

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  // เปิดแล้ว focus รายการแรก · แตะนอกเมนูหรือกด Escape เพื่อปิด
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={styles.menuWrap}>
      <button
        ref={trigger}
        type="button"
        className={styles.menuButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="เมนูห้อง"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div id={menuId} className={styles.menu} role="menu" aria-label="เมนูห้อง">
          <div className={styles.menuSection}>
            <span className={styles.menuLabel}>ผู้เล่นในห้อง</span>
            <span className={styles.menuName}>{view.you.displayName} (คุณ)</span>
            {view.partner && <span className={styles.menuName}>{view.partner.displayName}</span>}
          </div>
          <div className={styles.menuSection}>
            <span className={styles.menuLabel}>รหัสห้อง</span>
            <span className={styles.menuCode}>{view.code}</span>
          </div>
          <button ref={first} type="button" role="menuitem" className={styles.menuItem} onClick={() => copy(view.code, 'code')}>
            {copied === 'code' ? 'คัดลอกรหัสแล้ว ✓' : '📋 คัดลอกรหัสห้อง'}
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => copy(inviteUrl, 'link')}>
            {copied === 'link' ? 'คัดลอกลิงก์แล้ว ✓' : '🔗 คัดลอกลิงก์เชิญ'}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.menuDanger}`}
            onClick={() => {
              close(false);
              onLeave();
            }}
          >
            🚪 ออกจากห้อง…
          </button>
          <p className={styles.srOnlyLive} aria-live="polite">
            {copied === 'code' ? 'คัดลอกรหัสห้องแล้ว' : copied === 'link' ? 'คัดลอกลิงก์เชิญแล้ว' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
