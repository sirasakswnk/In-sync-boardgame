'use client';

import { promptFor, type PlayerView } from '@/lib/game';
import { AVATARS } from '@/lib/ui/avatars';
import styles from './waiting.module.css';

type Props = { view: PlayerView; partnerOnline: boolean };

/** หลังไพ่ที่คู่หูกำลังจัดอยู่ — ลายหัวใจสองดวงตามต้นแบบ */
function CardBack() {
  return (
    <span className={styles.card}>
      <svg className={styles.cardMark} viewBox="0 0 160 160" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M80 14 145 80 80 146 15 80Z" strokeWidth="1.2" opacity=".5" />
          <path d="M80 23 137 80 80 137 23 80Z" strokeWidth=".7" opacity=".25" />
          <path
            d="M64 104C57 98 34 83 34 68C34 53 52 47 64 62C76 47 94 53 94 68C94 83 71 98 64 104Z"
            strokeWidth="3.3"
          />
          <path
            d="M96 111C89 105 66 90 66 75C66 60 84 54 96 69C108 54 126 60 126 75C126 90 103 105 96 111Z"
            strokeWidth="3.3"
          />
          <path d="M80 37v5m0 76v5" strokeWidth="1.6" />
        </g>
      </svg>
    </span>
  );
}

/**
 * SELF_RANK ฝั่งคนทาย — รอคนวางเรียงอันดับของตัวเอง
 * เห็นคำถามล่วงหน้าเพื่อคิดไว้ก่อน แต่ไม่เห็นอะไรจากคำตอบของคนวาง (view ไม่มีข้อมูลนั้นอยู่แล้ว)
 */
export function WaitingTurn({ view, partnerOnline }: Props) {
  const game = view.game!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const avatar = view.partner ? (AVATARS[view.partner.avatarId] ?? AVATARS.cat) : AVATARS.cat;

  const status = partnerOnline
    ? {
        title: `${partnerName}กำลังจัดลำดับของตัวเอง…`,
        detail: 'ยืนยันเสร็จแล้ว จะถึงตาคุณทายทันที',
        partner: `${partnerName} · กำลังคิดอยู่`,
        bottom: 'หน้านี้จะเปลี่ยนอัตโนมัติเมื่อคู่หูกดยืนยัน',
      }
    : {
        title: `รอ${partnerName}กลับมาเชื่อมต่อ`,
        detail: 'คู่หูออฟไลน์อยู่ กลับมาแล้วค่อยเล่นต่อกัน',
        partner: `${partnerName} · ออฟไลน์`,
        bottom: 'เมื่อคู่หูกลับมา สถานะจะอัปเดตอัตโนมัติ',
      };

  return (
    <div className={styles.page} data-state={partnerOnline ? 'waiting' : 'offline'}>
      <section className={styles.question} aria-labelledby="wait-question">
        <p className={styles.role}>เตรียมทายใจ{partnerName}</p>
        <h1 id="wait-question">{promptFor(game.question, { name: partnerName })}</h1>
        <p className={styles.questionBottom}>
          เรียงจาก{game.question.topLabel} → {game.question.bottomLabel}
        </p>
      </section>

      <section className={styles.stage} aria-label="สถานะคู่หู">
        <div className={styles.seatLabel}>อีกฝั่งของโต๊ะ</div>
        <div className={styles.portraitWrap}>
          <div className={styles.portrait} style={{ background: avatar.bg }} aria-hidden="true">
            {avatar.emoji}
          </div>
          <span className={styles.connectionDot} aria-hidden="true" />
          <span className={styles.thinking} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <p className={styles.partnerTitle}>{status.partner}</p>

        {/* โต๊ะฝั่งคู่หู: หลังไพ่ 5 ใบขยับไปมาเหมือนกำลังจัดลำดับ */}
        <div className={styles.tableArt} aria-hidden="true">
          <div className={styles.tableRing} />
          <span className={styles.tinyStar}>✧</span>
          <span className={`${styles.tinyStar} ${styles.tinyStarRight}`}>✦</span>
          <div className={styles.cards}>
            <CardBack />
            <CardBack />
            <CardBack />
            <CardBack />
            <CardBack />
          </div>
        </div>
      </section>

      <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">
        <h2>{status.title}</h2>
        <p>{status.detail}</p>
      </div>

      <div className={styles.turnPath} aria-label="ลำดับการเล่น">
        <span className={`${styles.step} ${styles.current}`} aria-current="step">
          <b>1</b>คู่หูจัดไพ่
        </span>
        <span className={styles.line} aria-hidden="true" />
        <span className={styles.step}>
          <b>2</b>คุณทาย
        </span>
        <span className={styles.line} aria-hidden="true" />
        <span className={styles.step}>
          <b>3</b>ดูเฉลย
        </span>
      </div>

      <section className={styles.note} aria-labelledby="wait-note">
        <span className={styles.tape} aria-hidden="true" />
        <div className={styles.noteHead}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 15v5ZM3 23h18" />
          </svg>
          <h2 id="wait-note">ระหว่างนี้ ลองคิดไว้ก่อน</h2>
        </div>
        <p>คุณว่า{partnerName}จะเลือกอะไรเป็นอันดับหนึ่ง?</p>
        <ul className={styles.options} aria-label="ตัวเลือกของคำถาม ยังไม่ได้เรียงอันดับ">
          {game.question.options.map((o) => (
            <li key={o.id}>
              <span aria-hidden="true">{o.icon ?? '🃏'}</span>
              {o.label}
            </li>
          ))}
        </ul>
        <div className={styles.noteFoot}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="2" />
            <path d="M5 7V4a3 3 0 0 1 6 0v3" />
          </svg>
          นี่คือตัวเลือก ยังไม่ใช่ลำดับของคู่หู
        </div>
      </section>

      <p className={styles.bottom}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <path d="M13 5A5.5 5.5 0 0 0 3 4M3 4V1M3 4h3M3 11a5.5 5.5 0 0 0 10 1m0 0v3m0-3h-3" />
        </svg>
        <span>{status.bottom}</span>
      </p>
    </div>
  );
}
