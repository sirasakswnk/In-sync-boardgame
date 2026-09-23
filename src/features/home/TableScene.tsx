'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import styles from './HomePage.module.css';

/** ไพ่ตัวอย่างบนโต๊ะหน้าแรก — ภาพ SVG วาดเอง ไม่ใช้ไฟล์ภาพ */
const CARDS: Array<{ place: string; bg: string; art: ReactNode }> = [
  {
    place: 'สวนสนุก',
    bg: '#f7ddd3',
    art: (
      <>
        <path d="M18 60L33 28 47 60" stroke="#b86e58" strokeWidth="3" fill="none" />
        <circle cx="33" cy="28" r="19" fill="none" stroke="#c48864" strokeWidth="2" />
        <path d="M33 9V47M14 28H52M19 15L46 41M19 41L46 15" stroke="#c48864" />
        <g fill="#ea9286">
          <rect x="10" y="23" width="9" height="11" rx="3" />
          <rect x="47" y="23" width="9" height="11" rx="3" />
          <rect x="29" y="5" width="9" height="11" rx="3" />
          <rect x="29" y="42" width="9" height="11" rx="3" />
        </g>
        <path d="M12 62H53" stroke="#86684e" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  {
    place: 'ภูเขา',
    bg: '#e0e7d6',
    art: (
      <>
        <circle cx="48" cy="16" r="8" fill="#e7c274" />
        <path d="M0 61L25 17 48 61Z" fill="#618774" />
        <path d="M25 17L35 36 25 31 18 34Z" fill="#fff9e7" />
        <path d="M30 61L48 32 68 61Z" fill="#95ad8b" />
        <path d="M0 64Q30 57 65 64V70H0Z" fill="#3e6d56" />
      </>
    ),
  },
  {
    place: 'ทะเล',
    bg: '#d8ece7',
    art: (
      <>
        <circle cx="48" cy="15" r="9" fill="#efc876" />
        <path d="M0 43Q16 38 34 43T70 42V70H0Z" fill="#82c4bf" />
        <path d="M0 55Q30 46 65 57V70H0Z" fill="#f0d9a8" />
        <path d="M25 59Q35 33 27 25" stroke="#a57c54" strokeWidth="4" fill="none" />
        <path
          d="M28 28Q8 17 6 33Q18 29 28 28M28 28Q18 5 9 13Q20 18 28 28M28 28Q43 10 47 25Q36 24 28 28M28 28Q43 29 42 41Q34 32 28 28"
          fill="#4e8563"
        />
        <path d="M39 46h12M5 49h10" stroke="#eaf5ed" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  {
    place: 'เมืองเก่า',
    bg: '#ecdde2',
    art: (
      <>
        <path d="M25 21H42V59H25Z" fill="#c38673" />
        <path d="M19 24L33 10 47 24ZM13 38L33 23 52 38ZM8 52L33 36 58 52Z" fill="#ab5866" />
        <path d="M14 62H53" stroke="#806c65" strokeWidth="4" />
        <path d="M30 54H36V61H30Z" fill="#584b55" />
      </>
    ),
  },
  {
    place: 'เมืองใหญ่',
    bg: '#dedff0',
    art: (
      <>
        <rect x="9" y="30" width="17" height="33" rx="2" fill="#8f8dab" />
        <rect x="27" y="15" width="20" height="48" rx="2" fill="#626285" />
        <rect x="46" y="39" width="12" height="24" rx="1" fill="#a4a0b8" />
        <path d="M32 23h4m3 0h4m-11 9h4m3 0h4m-11 9h4m3 0h4m-11 9h4M14 38h6m-6 10h6" stroke="#f5d694" strokeWidth="3" />
        <path d="M5 63H61" stroke="#52536c" strokeWidth="3" />
      </>
    ),
  },
];

/**
 * ฉากโต๊ะตัวอย่างบนหน้าแรก: สองผู้เล่น การ์ดคำถาม และพัดไพ่ที่แตะเลือกได้
 * เป็นแค่การสาธิต ไม่ส่งอะไรไป server
 */
export function TableScene() {
  const [picked, setPicked] = useState('ทะเล');

  return (
    <section className={styles.scene} aria-label="ตัวอย่างโต๊ะเกม: แตะไพ่เพื่อเลือกสถานที่ท่องเที่ยว">
      <div className={styles.tableEdge} aria-hidden="true">
        <div className={styles.tableFelt} />
      </div>

      <div className={`${styles.player} ${styles.playerLeft}`}>
        <span className={styles.avatarDisc} aria-hidden="true">
          🦊
        </span>
        <span className={styles.speech} aria-live="polite">
          ฉันว่าเธอเลือก{picked}!
        </span>
      </div>
      <div className={`${styles.player} ${styles.playerRight}`}>
        <span className={styles.avatarDisc} aria-hidden="true">
          🐰
        </span>
        <span className={styles.speech}>ไม่บอกจ้าา ♡</span>
      </div>

      <div className={styles.questionSlip}>
        <small>การ์ดคำถาม</small>
        <b>ตั๋วเที่ยวฟรี…จะไปไหนดี?</b>
      </div>
      <span className={styles.detailSpark} aria-hidden="true">
        ✧
      </span>

      <div className={styles.hand}>
        {CARDS.map((c, i) => (
          <button
            key={c.place}
            type="button"
            className={styles.travelCard}
            style={{ '--artbg': c.bg, '--i': i } as CSSProperties}
            aria-label={`ลองเลือก${c.place}`}
            aria-pressed={picked === c.place}
            onClick={() => setPicked(c.place)}
          >
            <span className={styles.rankCoin} aria-hidden="true">
              1
            </span>
            <span className={styles.art}>
              <svg viewBox="0 0 65 70" aria-hidden="true">
                {c.art}
              </svg>
            </span>
            <b>{c.place}</b>
          </button>
        ))}
      </div>
      <span className={styles.tinyToken} aria-hidden="true">
        ♥
      </span>
    </section>
  );
}
