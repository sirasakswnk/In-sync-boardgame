'use client';

import { Avatar } from '@/components/Avatar';
import type { PlayerView } from '@/lib/game';
import styles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean };

/**
 * SELF_RANK ฝั่งคนทาย — รอคนวางเรียงอันดับของตัวเอง
 * เห็นคำถามล่วงหน้าเพื่อคิดไว้ก่อน แต่ไม่เห็นอะไรจากคำตอบของคนวาง (view ไม่มีข้อมูลนั้นอยู่แล้ว)
 */
export function WaitingTurn({ view, partnerOnline }: Props) {
  const game = view.game!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const icons = game.question.options.map((o) => o.icon ?? '🃏');

  return (
    <div className={styles.stack}>
      <section className={styles.questionCard}>
        <p className={styles.eyebrow}>รอบ {game.roundIndex + 1} · ตาคุณทาย</p>
        <p className={styles.prompt}>{game.question.prompt}</p>
        <p className={styles.muted}>คิดไว้ก่อนเลยว่า {partnerName} จะเรียงยังไง</p>
      </section>

      <section className={styles.waitCard}>
        {view.partner && (
          <span className={styles.waitAvatar}>
            <Avatar id={view.partner.avatarId} size="xl" online={partnerOnline} label={partnerName} />
          </span>
        )}
        <div className={styles.waitDeck} aria-hidden="true">
          {icons.map((icon, i) => (
            <span key={i}>{icon}</span>
          ))}
        </div>
        <p className={styles.waitTitle} role="status">
          <span className={styles.waitDots}>{partnerName} กำลังเรียงอันดับของตัวเอง</span>
        </p>
        <p className={styles.muted}>
          {partnerOnline ? 'เรียงเสร็จเมื่อไร ถึงตาคุณทายทันที' : `${partnerName} หลุดการเชื่อมต่ออยู่ รอสักครู่`}
        </p>
      </section>
    </div>
  );
}
