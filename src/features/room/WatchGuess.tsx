'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { PlayerView, QuestionOption } from '@/lib/game';
import { useLiveOrder } from '@/lib/client/live';
import styles from './room.module.css';

type Props = {
  view: PlayerView;
  partnerOnline: boolean;
  /** เฉพาะหน้า /dev/preview: ลำดับจำลองแทนการฟัง RTDB */
  demoOrder?: string[];
};

const MOVING_MS = 1500;

/**
 * GUESS_RANK ฝั่งคนวาง — ดูคนทายเรียงการ์ดแบบ realtime วางคู่กับคำตอบของตัวเอง
 * ไม่คิดคะแนนและไม่ระบายสีว่าตรงหรือไม่ จนกว่าคนทายจะล็อก (server เป็นคนคิดคะแนนตอน REVEAL)
 */
export function WatchGuess({ view, partnerOnline, demoOrder }: Props) {
  const game = view.game!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const mine = game.yourSelf ?? [];
  const subscribed = useLiveOrder(demoOrder ? null : view.roomId, game.guesserUid, game.liveKey);
  const live = demoOrder ? { order: demoOrder, receivedAt: 0 } : subscribed;
  const byId = new Map(game.question.options.map((o) => [o.id, o]));

  // ป้าย “กำลังขยับการ์ด…” ขึ้นตอนได้ข้อมูลใหม่ แล้วหายไปเองเมื่อเงียบไป MOVING_MS
  const receivedAt = live?.receivedAt ?? 0;
  const [quietAt, setQuietAt] = useState(0);
  useEffect(() => {
    if (!receivedAt) return;
    const t = setTimeout(() => setQuietAt(receivedAt), MOVING_MS);
    return () => clearTimeout(t);
  }, [receivedAt]);
  const moving = receivedAt > 0 && quietAt !== receivedAt;

  const liveOrder = live && live.order.every((id) => byId.has(id)) ? live.order : null;
  const summary = liveOrder
    ? `ตอนนี้${partnerName}เรียง: ${liveOrder.map((id, i) => `${i + 1}. ${byId.get(id)!.label}`).join(', ')}`
    : '';

  return (
    <div className={styles.stack}>
      <section className={styles.questionCard}>
        <p className={styles.eyebrow}>รอบ {game.roundIndex + 1} · ตา{partnerName}ทาย</p>
        <p className={styles.prompt}>{game.question.prompt}</p>
        <p className={styles.muted}>ดู{partnerName}เรียงการ์ดสด ๆ — คะแนนจะเปิดตอน{partnerName}ล็อกคำทาย</p>
      </section>

      <section className={styles.watchCard} aria-label={`${partnerName}กำลังทายอันดับของคุณ`}>
        <div className={styles.watchHead} aria-hidden="true">
          <span />
          <span>คำตอบของคุณ</span>
          <span>👀 {partnerName}</span>
        </div>

        <div className={styles.watchBoard}>
          <ol className={styles.watchRanks} aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n} className={styles.watchRank}>
                {n}
              </li>
            ))}
          </ol>

          <ol className={styles.watchMine} aria-label="คำตอบของคุณ">
            {mine.map((id) => (
              <li key={id}>
                <MiniCard option={byId.get(id)} />
              </li>
            ))}
          </ol>

          <div className={styles.watchLive}>
            {liveOrder ? (
              liveOrder.map((id, i) => (
                <div key={id} className={styles.miniCard} style={{ '--i': i } as CSSProperties} aria-hidden="true">
                  <span className={styles.miniIcon}>{byId.get(id)!.icon}</span>
                  <span>{byId.get(id)!.label}</span>
                </div>
              ))
            ) : (
              <div className={styles.watchEmpty}>รอ {partnerName} เริ่มเรียง…</div>
            )}
          </div>
        </div>

        <p className={styles.watchStatus}>
          {!partnerOnline ? (
            <span>{partnerName} หลุดการเชื่อมต่ออยู่</span>
          ) : moving ? (
            <span className={styles.watchMoving}>
              <span className={styles.waitingPulse} aria-hidden="true" /> {partnerName} กำลังขยับการ์ด…
            </span>
          ) : liveOrder ? (
            <span>{partnerName} กำลังคิด…</span>
          ) : null}
        </p>
        <p className={styles.srOnlyLive} aria-live="polite">
          {moving ? '' : summary}
        </p>
      </section>

      <div className={styles.actionBar}>
        <div className={styles.waiting} role="status">
          <span className={styles.waitingPulse} aria-hidden="true" />
          <span>รอ {partnerName} ล็อกคำทาย</span>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ option }: { option: QuestionOption | undefined }) {
  if (!option) return null;
  return (
    <div className={styles.miniCard}>
      <span className={styles.miniIcon} aria-hidden="true">
        {option.icon}
      </span>
      <span>{option.label}</span>
    </div>
  );
}
