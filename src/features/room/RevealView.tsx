'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/Button';
import { MAX_ROUND_SCORE, type PlayerView } from '@/lib/game';
import type { useCommands } from '@/lib/client/useRoom';
import { RevealBreakdown } from './RevealBreakdown';
import styles from './reveal.module.css';
import roomStyles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };
type Tab = 'you' | 'partner';

export const TALK_PROMPTS = [
  'ข้อไหนทำให้คุณแปลกใจที่สุด?',
  'ถามอีกคนหน่อยว่าทำไมอันดับหนึ่งถึงเป็นแบบนั้น',
  'มีข้อไหนที่คิดว่าอีกคนจะเลือกต่างจากนี้ไหม?',
  'อันดับสุดท้ายของใครน่าสงสัยที่สุด?',
  'ถ้าให้เรียงใหม่ตอนนี้ จะเปลี่ยนอะไรไหม?',
  'ข้อไหนที่ทายถูกเพราะรู้จักกันจริง ๆ?',
];

export function RevealView({ view, partnerOnline, cmds }: Props) {
  const game = view.game!;
  const reveal = game.reveal!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const last = game.roundIndex >= game.roundCount - 1;
  const [tab, setTab] = useState<Tab>('you');
  // เปิดทีละใบเฉพาะครั้งแรกของแต่ละแท็บ สลับกลับมาแล้วแสดงทันที
  const [played, setPlayed] = useState<Record<Tab, boolean>>({ you: false, partner: false });
  const tabs = useRef<Record<Tab, HTMLButtonElement | null>>({ you: null, partner: null });
  const markPlayed = useCallback(() => setPlayed((p) => (p[tab] ? p : { ...p, [tab]: true })), [tab]);

  const key = `continue:${game.id}:${game.roundIndex}`;
  const sending = cmds.state.kind === 'sending' && cmds.state.key === key;

  const current =
    tab === 'you'
      ? { score: reveal.yourGuessScore, subject: partnerName, title: `คุณทาย${partnerName}` }
      : { score: reveal.partnerGuessScore, subject: 'คุณ', title: `${partnerName}ทายคุณ` };

  const topYou = reveal.question.options.find((o) => o.id === reveal.yourSelf[0]);
  const topPartner = reveal.question.options.find((o) => o.id === reveal.partnerSelf[0]);

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next: Tab = tab === 'you' ? 'partner' : 'you';
    setTab(next);
    tabs.current[next]?.focus();
  }

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
        <div className={styles.tabs} role="tablist" aria-label="เลือกดูผลการทาย" onKeyDown={onTabKey}>
          {(['you', 'partner'] as const).map((t) => (
            <button
              key={t}
              ref={(el) => {
                tabs.current[t] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls="reveal-panel"
              tabIndex={tab === t ? 0 : -1}
              className={`${styles.tab} ${tab === t ? styles.tabOn : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'you' ? `คุณทาย ${partnerName}` : `${partnerName} ทายคุณ`}
              <span className={styles.tabScore}>
                +{t === 'you' ? reveal.yourGuessScore.score : reveal.partnerGuessScore.score}
              </span>
            </button>
          ))}
        </div>

        <div id="reveal-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={styles.panel}>
          <div className={styles.scoreLine}>
            <span className={styles.bigScore}>+{current.score.score}</span>
            <span className={styles.scoreOf}>
              จากเต็ม {MAX_ROUND_SCORE}
              <br />
              <small>{current.title}</small>
            </span>
          </div>

          <RevealBreakdown
            key={tab}
            question={reveal.question}
            score={current.score}
            subjectName={current.subject}
            animate={!played[tab]}
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
        {reveal.sameTopPick ? (
          <p className={styles.sameTop}>
            <span aria-hidden="true">💞</span> อันดับหนึ่งเหมือนกัน: <strong>{topYou?.label}</strong>
          </p>
        ) : (
          <p className={styles.tops}>
            อันดับหนึ่งของคุณคือ <strong>{topYou?.label}</strong> ส่วนของ{partnerName}คือ <strong>{topPartner?.label}</strong>
          </p>
        )}
        <p className={styles.talk}>
          <span aria-hidden="true">💬</span> {TALK_PROMPTS[game.roundIndex % TALK_PROMPTS.length]}
        </p>
        <p className={styles.totals}>
          คะแนนรวม · คุณ <strong>{game.totals.you}</strong> · {partnerName} <strong>{game.totals.partner}</strong>
        </p>
      </section>

      <div className={roomStyles.actionBar}>
        {game.continued.you ? (
          <div className={roomStyles.waiting} role="status">
            <span className={roomStyles.waitingPulse} aria-hidden="true" />
            <span>
              พร้อมแล้ว • รอ {partnerName} กด{last ? 'ดูผลรวม' : 'ไปต่อ'}
            </span>
          </div>
        ) : (
          <>
            <Button block onClick={next} loading={sending} disabled={!partnerOnline}>
              {last ? 'ดูผลรวม 🏁' : 'พร้อมไปข้อต่อไป →'}
            </Button>
            <p className={roomStyles.hint}>
              {!partnerOnline
                ? `รอ ${partnerName} กลับมาออนไลน์`
                : game.continued.partner
                  ? `${partnerName} พร้อมไปต่อแล้ว`
                  : 'ไม่มีจับเวลา คุยกันให้พอแล้วค่อยไปต่อ'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
