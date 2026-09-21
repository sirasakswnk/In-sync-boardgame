'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/Button';
import { MAX_ROUND_SCORE, type PlayerView } from '@/lib/game';
import type { useCommands } from '@/lib/client/useRoom';
import { RevealBreakdown } from './RevealBreakdown';
import styles from './reveal.module.css';
import roomStyles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };

export const TALK_PROMPTS = [
  'ข้อไหนทำให้คุณแปลกใจที่สุด?',
  'ถามอีกคนหน่อยว่าทำไมอันดับหนึ่งถึงเป็นแบบนั้น',
  'มีข้อไหนที่คิดว่าอีกคนจะเลือกต่างจากนี้ไหม?',
  'อันดับสุดท้ายของใครน่าสงสัยที่สุด?',
  'ถ้าให้เรียงใหม่ตอนนี้ จะเปลี่ยนอะไรไหม?',
  'ข้อไหนที่ทายถูกเพราะรู้จักกันจริง ๆ?',
];

/**
 * เฉลยทางเดียว: คำทายของคนทายเทียบคำตอบจริงของคนวาง
 * คนวางเป็นคนกด “ไปต่อ” — คนทายเห็นสถานะรอ
 */
export function RevealView({ view, partnerOnline, cmds }: Props) {
  const game = view.game!;
  const reveal = game.reveal!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const last = game.roundIndex >= game.roundCount - 1;
  const youSet = reveal.setter === 'you';
  // เปิดทีละใบครั้งแรกเท่านั้น
  const [played, setPlayed] = useState(false);
  const markPlayed = useCallback(() => setPlayed(true), []);

  const key = `continue:${game.id}:${game.roundIndex}`;
  const sending = cmds.state.kind === 'sending' && cmds.state.key === key;
  const setterTop = reveal.question.options.find((o) => o.id === reveal.setterOrder[0]);
  const nextSetter = youSet ? partnerName : 'คุณ';

  function next() {
    void cmds.send(key, {
      kind: 'continue',
      gameId: game.id,
      roundIndex: game.roundIndex,
      expectedPhase: 'REVEAL',
    });
  }

  return (
    <div className={roomStyles.stack}>
      <section className={roomStyles.questionCard}>
        <p className={roomStyles.eyebrow}>เฉลยรอบ {game.roundIndex + 1}</p>
        <p className={roomStyles.prompt}>{reveal.question.prompt}</p>
      </section>

      <section className={styles.revealCard}>
        <div className={styles.panel}>
          <div className={styles.scoreLine}>
            <span className={styles.bigScore}>+{reveal.score.score}</span>
            <span className={styles.scoreOf}>
              จากเต็ม {MAX_ROUND_SCORE}
              <br />
              <small>{youSet ? `${partnerName}ทายคุณ` : `คุณทาย${partnerName}`}</small>
            </span>
          </div>

          <RevealBreakdown
            question={reveal.question}
            score={reveal.score}
            subjectName={youSet ? 'คุณ' : partnerName}
            animate={!played}
            onAllShown={markPlayed}
          />
          <p className={styles.legend}>
            <span>🎯 ตรงเป๊ะ +2</span>
            <span>👌 ห่างหนึ่งอันดับ +1</span>
            <span>💨 ห่างกว่านั้น +0</span>
          </p>
        </div>
      </section>

      <section className={styles.extras}>
        <p className={styles.tops}>
          อันดับหนึ่งของ{youSet ? 'คุณ' : partnerName}คือ <strong>{setterTop?.label}</strong>
        </p>
        <p className={styles.talk}>
          <span aria-hidden="true">💬</span> {TALK_PROMPTS[game.roundIndex % TALK_PROMPTS.length]}
        </p>
        <p className={styles.totals}>
          คะแนนรวม · คุณ <strong>{game.totals.you}</strong> · {partnerName} <strong>{game.totals.partner}</strong>
        </p>
        {!last && (
          <p className={styles.tops}>
            รอบหน้า: <strong>{nextSetter}</strong> เป็นคนวางลำดับ
          </p>
        )}
      </section>

      <div className={roomStyles.actionBar}>
        {youSet ? (
          <>
            <Button block onClick={next} loading={sending} disabled={!partnerOnline}>
              {last ? 'ดูผลรวม 🏁' : 'ไปรอบต่อไป →'}
            </Button>
            <p className={roomStyles.hint}>
              {!partnerOnline ? `รอ ${partnerName} กลับมาออนไลน์` : 'ไม่มีจับเวลา คุยกันให้พอแล้วค่อยกดไปต่อ'}
            </p>
          </>
        ) : (
          <div className={roomStyles.waiting} role="status">
            <span className={roomStyles.waitingPulse} aria-hidden="true" />
            <span>รอ {partnerName} กดไปต่อ…</span>
          </div>
        )}
      </div>
    </div>
  );
}
