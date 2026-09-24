'use client';

import { OptionIcon } from '@/components/OptionIcon';
import { useEffect, useState } from 'react';
import { MAX_ROUND_SCORE, promptFor, type PlayerView } from '@/lib/game';
import type { useCommands } from '@/lib/client/useRoom';
import { AVATARS } from '@/lib/ui/avatars';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import styles from './reveal.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };

export const TALK_PROMPTS = [
  'ข้อไหนทำให้คุณแปลกใจที่สุด?',
  'ถามอีกคนหน่อยว่าทำไมอันดับหนึ่งถึงเป็นแบบนั้น',
  'มีข้อไหนที่คิดว่าอีกคนจะเลือกต่างจากนี้ไหม?',
  'อันดับสุดท้ายของใครน่าสงสัยที่สุด?',
  'ถ้าให้เรียงใหม่ตอนนี้ จะเปลี่ยนอะไรไหม?',
  'ข้อไหนที่ทายถูกเพราะรู้จักกันจริง ๆ?',
];

const STEP_MS = 350;
const FIRST_MS = 450;

const VERDICT = {
  2: { text: 'ตรงเป๊ะ', cls: 'exact' },
  1: { text: 'ใกล้มาก', cls: 'near' },
  0: { text: 'ยังไม่ตรง', cls: 'miss' },
} as const;

/** ลายหลังไพ่ — หัวใจสองดวงแบบเดียวกับหน้ารอคู่หู */
function CardMark() {
  return (
    <svg className={styles.cardMark} viewBox="0 0 160 160" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M80 14 145 80 80 146 15 80Z" strokeWidth="1.2" opacity=".5" />
        <path d="M80 23 137 80 80 137 23 80Z" strokeWidth=".7" opacity=".25" />
        <path d="M64 104C57 98 34 83 34 68C34 53 52 47 64 62C76 47 94 53 94 68C94 83 71 98 64 104Z" strokeWidth="3.3" />
        <path
          d="M96 111C89 105 66 90 66 75C66 60 84 54 96 69C108 54 126 60 126 75C126 90 103 105 96 111Z"
          strokeWidth="3.3"
        />
        <path d="M80 37v5m0 76v5" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/**
 * เฉลยทางเดียว: คำทายของคนทายเทียบคำตอบจริงของคนวาง
 * คนวางเป็นคนกด “ไปต่อ” — คนทายเห็นสถานะรอ
 * แยก key ตามรอบ เพื่อให้เปิดไพ่ทีละใบใหม่ทุกครั้งที่ขึ้นรอบใหม่
 */
export function RevealView({ view, partnerOnline, cmds }: Props) {
  return <RoundReveal key={view.game!.roundIndex} view={view} partnerOnline={partnerOnline} cmds={cmds} />;
}

function RoundReveal({ view, partnerOnline, cmds }: Props) {
  const game = view.game!;
  const reveal = game.reveal!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const youName = view.you.displayName;
  const last = game.roundIndex >= game.roundCount - 1;
  const youSet = reveal.setter === 'you';
  const subject = youSet ? 'คุณ' : partnerName;
  const guesser = youSet ? partnerName : 'คุณ';
  const guesserAvatar = AVATARS[(youSet ? view.partner?.avatarId : view.you.avatarId) ?? 'cat'] ?? AVATARS.cat;

  const entries = reveal.score.breakdown;
  const total = entries.length;
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(reducedMotion ? total : 0);
  const done = shown >= total;
  const runningScore = entries.slice(0, shown).reduce((n, e) => n + e.points, 0);

  // เปิดไพ่ทีละใบ จนครบทั้งกอง
  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? FIRST_MS : STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, done]);

  const key = `continue:${game.id}:${game.roundIndex}`;
  const sending = cmds.state.kind === 'sending' && cmds.state.key === key;
  const setterTop = reveal.question.options.find((o) => o.id === reveal.setterOrder[0]);
  const byId = new Map(reveal.question.options.map((o) => [o.id, o]));

  const scoreTitle = !done
    ? 'ไหนดูหน่อยสิทายเก่งแค่ไหน'
    : reveal.score.score === MAX_ROUND_SCORE
      ? 'ใจตรงกันทุกใบเลย!'
      : reveal.score.score >= 8
        ? 'ทายเก่งอยู่เหมือนกันน้าา'
        : 'อาจจะยังน้าา';

  function next() {
    void cmds.send(key, {
      kind: 'continue',
      gameId: game.id,
      roundIndex: game.roundIndex,
      expectedPhase: 'REVEAL',
    });
  }

  return (
    <div className={styles.page}>
      <section className={styles.question} aria-labelledby="reveal-question">
        <p className={styles.eyebrow}>
          เฉลยรอบ {game.roundIndex + 1} · {guesser}ทายใจ{subject}
        </p>
        <h1 id="reveal-question">{promptFor(reveal.question, youSet ? { you: true } : { name: partnerName })}</h1>
        <p className={styles.questionBottom}>
          เรียงจาก{reveal.question.topLabel} → {reveal.question.bottomLabel}
        </p>
      </section>

      {/* เหรียญคะแนน: เด้งทุกครั้งที่เปิดไพ่เพิ่มหนึ่งใบ */}
      <section className={styles.scoreStage} aria-label="คะแนนรอบนี้">
        <div className={styles.coin} key={shown}>
          <strong>+{runningScore}</strong>
        </div>
        <div className={styles.scoreCopy}>
          <p className={styles.scoreOwner}>
            <span className={styles.tinyAvatar} aria-hidden="true">
              {guesserAvatar.emoji}
            </span>
            คะแนนของ{guesser === 'คุณ' ? youName : guesser}
          </p>
          <h2>{scoreTitle}</h2>
          <p className={styles.scoreDetail}>
            {done ? 'คะแนนรอบนี้' : 'กำลังเปิดคำตอบ'} · เต็ม {MAX_ROUND_SCORE} คะแนน
          </p>
        </div>
      </section>

      <section className={styles.cardsSection} aria-label="เฉลยคำตอบ">
        <div className={styles.deckLabel}>
          <span>อันดับจริงของ{subject}</span>
          <small>
            เปิดแล้ว {shown} / {total} ใบ
          </small>
        </div>

        <ol className={styles.cards}>
          {entries.map((entry, i) => {
            const option = byId.get(entry.optionId)!;
            const verdict = VERDICT[entry.points as 0 | 1 | 2];
            const open = i < shown;
            return (
              <li
                key={entry.optionId}
                className={styles.card}
                aria-label={open ? undefined : `อันดับ ${entry.actualIndex + 1} ยังไม่เปิด`}
              >
                {open ? (
                  <div className={styles.cardFace}>
                    <span className={styles.rank} aria-hidden="true">
                      {entry.actualIndex + 1}
                    </span>
                    <span className={styles.optionIcon} aria-hidden="true">
                      <OptionIcon icon={option.icon} />
                    </span>
                    <div>
                      <h3 className={styles.optionName}>{option.label}</h3>
                      <p className={styles.comparison}>
                        ทายอันดับ <b>{entry.guessedIndex + 1}</b> · จริงอันดับ <b>{entry.actualIndex + 1}</b>
                      </p>
                    </div>
                    <span className={`${styles.verdict} ${styles[verdict.cls]}`}>
                      {verdict.text}
                      <strong>+{entry.points}</strong>
                    </span>
                  </div>
                ) : (
                  <div className={styles.cardBack} aria-hidden="true">
                    <span className={styles.backNumber}>{entry.actualIndex + 1}</span>
                    <CardMark />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className={styles.revealActions}>
          {done ? (
            <p className={styles.completeLabel}>เปิดครบแล้ว · ไหนขอดูหน่อยสิ๊</p>
          ) : (
            <button type="button" className={styles.skip} onClick={() => setShown(total)}>
              เปิดทั้งหมด →
            </button>
          )}
        </div>

        <p className={styles.legend}>
          <span>
            <i aria-hidden="true" />
            ตรงเป๊ะ +2
          </span>
          <span>
            <i aria-hidden="true" />
            ห่าง 1 อันดับ +1
          </span>
          <span>
            <i aria-hidden="true" />
            ห่างกว่านั้น +0
          </span>
        </p>
      </section>

      {done && (
        <>
          <section className={styles.note} aria-labelledby="reveal-note">
            <span className={styles.tape} aria-hidden="true" />
            <p className={styles.noteEyebrow}>บันทึกความรู้ใจ</p>
            <h2 id="reveal-note">
              อันดับหนึ่งของ{subject}คือ “{setterTop?.label}”
            </h2>
            <p className={styles.noteTalk}>
              ลองถามกันเล่น ๆ
              <br />
              “{TALK_PROMPTS[game.roundIndex % TALK_PROMPTS.length]}”
            </p>
          </section>

          <div className={styles.totals}>
            <span className={styles.totalsLabel}>คะแนนรวมตอนนี้</span>
            <span>
              คุณ <b>{game.totals.you}</b>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {partnerName} <b>{game.totals.partner}</b>
            </span>
          </div>
        </>
      )}

      <footer className={styles.actionBar}>
        {!last && (
          <p className={styles.nextRole}>
            รอบหน้า: <b>{youSet ? partnerName : 'คุณ'}เป็นคนวางลำดับ</b>
          </p>
        )}
        {youSet ? (
          <button
            type="button"
            className={styles.primary}
            onClick={next}
            disabled={!done || sending || !partnerOnline}
            aria-busy={sending || undefined}
          >
            {sending ? 'กำลังส่ง…' : last ? 'ดูผลรวม 🏁' : 'ไปรอบต่อไป →'}
          </button>
        ) : (
          <div className={styles.waiting}>
            <span className={styles.waitingDot} aria-hidden="true" />
            <span>{done ? `รอ${partnerName}กดไปต่อ…` : 'รอเปิดคำตอบให้ครบก่อน…'}</span>
          </div>
        )}
        <p className={styles.actionHint}>
          {!partnerOnline ? `${partnerName}ออฟไลน์อยู่ รอสักครู่` : 'ไม่มีจับเวลา คุยกันให้พอแล้วค่อยไปต่อ'}
        </p>
      </footer>

      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {done ? `เปิดเฉลยครบแล้ว ${guesser}ได้ ${reveal.score.score} จาก ${MAX_ROUND_SCORE} คะแนน` : ''}
      </p>
    </div>
  );
}
