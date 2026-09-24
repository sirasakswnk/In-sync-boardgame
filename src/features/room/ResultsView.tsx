'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  bestRound,
  exactHits,
  GUESSES_PER_PLAYER,
  MAX_GAME_SCORE,
  MAX_ROUND_SCORE,
  OPTIONS_PER_ROUND,
  outcomeOf,
  type PlayerView,
  type RevealRound,
} from '@/lib/game';
import type { useCommands } from '@/lib/client/useRoom';
import { AVATARS } from '@/lib/ui/avatars';
import { useReducedMotion } from '@/lib/ui/useReducedMotion';
import styles from './results.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };
type Standing = 'winner' | 'tied' | 'behind';

export function ResultsView({ view, partnerOnline, cmds }: Props) {
  const game = view.game!;
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const outcome = outcomeOf(game.totals);
  const history = game.history;
  // คุณเป็นคนทายในรอบที่คู่หูวาง และกลับกัน
  const youGuessed = history.filter((r) => r.setter === 'partner');
  const partnerGuessed = history.filter((r) => r.setter === 'you');
  const yourBest = bestRound(youGuessed, (r) => r.score.score);
  const partnerBest = bestRound(partnerGuessed, (r) => r.score.score);
  const yourHits = exactHits(youGuessed);
  const partnerHits = exactHits(partnerGuessed);

  const key = `rematch:${game.id}`;
  const sending = cmds.state.kind === 'sending' && cmds.state.key === key;
  const requested = game.rematch.you;
  const invited = game.rematch.partner;

  const headline =
    outcome === 'tie'
      ? 'เสมอกัน! รอบนี้สูสีกันเลย'
      : outcome === 'you'
        ? 'รอบนี้คุณทายใจแม่นกว่า'
        : `รอบนี้${partnerName}ทายใจแม่นกว่า`;
  const lead = Math.abs(game.totals.you - game.totals.partner);
  const caption =
    outcome === 'tie'
      ? 'คะแนนเท่ากันเป๊ะ · อีกสักรอบไหม?'
      : `${outcome === 'you' ? 'คุณ' : partnerName}นำอยู่ ${lead} คะแนน · รอบหน้าจะเป็นยังไงนะ?`;

  const standing = (side: 'you' | 'partner'): Standing =>
    outcome === 'tie' ? 'tied' : outcome === side ? 'winner' : 'behind';

  const actionLabel = sending
    ? 'กำลังส่ง…'
    : requested
      ? 'ส่งคำชวนแล้ว'
      : !partnerOnline
        ? 'รอคู่หูกลับมา'
        : invited
          ? 'ตอบรับ · เล่นอีกครั้ง'
          : 'เล่นอีกครั้ง';
  const actionHint = requested
    ? partnerOnline
      ? `รอ${partnerName}ตอบรับคำชวนของคุณ`
      : `รอ${partnerName}กลับมาออนไลน์เพื่อตอบรับ`
    : !partnerOnline
      ? `${partnerName}ออฟไลน์อยู่ กลับมาแล้วค่อยเล่นต่อได้`
      : invited
        ? `${partnerName}ชวนคุณเล่นอีกรอบแล้ว ♡`
        : `ชวน${partnerName}เลือกหมวดใหม่ แล้วเล่นต่อในห้องเดิม`;

  function rematch() {
    void cmds.send(key, {
      kind: 'rematch',
      gameId: game.id,
      roundIndex: game.roundIndex,
      expectedPhase: 'RESULTS',
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.endLabel}>จบเกมแล้ว!</p>
        <h1>{headline}</h1>
        <p>
          ผลัดกันทายคนละ {GUESSES_PER_PLAYER} รอบ · เต็มคนละ {MAX_GAME_SCORE} คะแนน
        </p>
      </header>

      {/* ไพ่ผู้เล่นสองใบวางบนโต๊ะ คนที่ทายแม่นกว่ายกขึ้นพร้อมมงกุฎ */}
      <section className={styles.scene} aria-label="คะแนนรวม">
        <span className={`${styles.spark} ${styles.s1}`} aria-hidden="true">
          ✧
        </span>
        <span className={`${styles.spark} ${styles.s2}`} aria-hidden="true">
          ✦
        </span>
        <span className={`${styles.spark} ${styles.s3}`} aria-hidden="true">
          ✧
        </span>
        <div className={styles.pair}>
          <PlayerCard
            suit="♥"
            name={view.you.displayName}
            role="คุณ"
            avatarId={view.you.avatarId}
            score={game.totals.you}
            description={`คะแนนทายใจ${partnerName}`}
            standing={standing('you')}
          />
          <PlayerCard
            suit="♠"
            name={partnerName}
            role="คู่หูของคุณ"
            avatarId={view.partner!.avatarId}
            score={game.totals.partner}
            description={`คะแนนทายใจ${view.you.displayName}`}
            standing={standing('partner')}
          />
        </div>
        <span className={styles.between} aria-hidden="true">
          ♥
        </span>
      </section>
      <p className={styles.afterScore}>{caption}</p>

      <section className={styles.playAction} aria-label="เล่นอีกครั้ง">
        <button
          type="button"
          className={`${styles.playButton} ${requested ? styles.playWaiting : ''}`}
          onClick={rematch}
          disabled={sending || requested || !partnerOnline}
          aria-busy={sending || undefined}
        >
          <span aria-hidden="true">↻</span>
          <span>{actionLabel}</span>
        </button>
        <p className={`${styles.actionHint} ${invited && !requested ? styles.actionInvite : ''}`} role="status">
          {actionHint}
        </p>
      </section>

      <div className={styles.colSide}>
        <h2 className={styles.sectionLabel}>เก็บโมเมนต์จากเกมนี้</h2>
        <section className={styles.note} aria-labelledby="note-heading">
          <span className={styles.tape} aria-hidden="true" />
          <h2 className={styles.noteHeading} id="note-heading">
            <span aria-hidden="true">✎</span> บันทึกความรู้ใจ
          </h2>
          {yourBest && <BestRow title="รอบที่คุณทายแม่นที่สุด" round={yourBest} />}
          {partnerBest && <BestRow title={`รอบที่${partnerName}ทายแม่นที่สุด`} round={partnerBest} />}
          <div className={styles.hits}>
            <span>ทายอันดับตรงเป๊ะ</span>
            <span>
              <strong>คุณ {yourHits}</strong> · {partnerName} {partnerHits} ใบ
            </span>
          </div>
          <p className={styles.hitsOf}>จากไพ่ที่แต่ละคนทาย {youGuessed.length * OPTIONS_PER_ROUND} ใบ</p>
        </section>

        <details className={styles.history}>
          <summary>
            <span aria-hidden="true">▤</span> ย้อนดูเฉลยทุกข้อ <small>{history.length} รอบ</small>
            <span className={styles.chevron} aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className={styles.historyList}>
            {history.map((r) => (
              <HistoryRound key={r.roundIndex} round={r} partnerName={partnerName} />
            ))}
          </div>
        </details>
      </div>

      <footer className={styles.bottom}>
        คะแนนจากคำทายในเกมนี้
        <span>ที่สำคัญ…เราได้รู้จักกันอีกนิดแล้ว ♡</span>
      </footer>
    </div>
  );
}

/** นับคะแนนขึ้นจาก 0 ตอนเปิดหน้า (ปิดเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว) */
function useCountUp(target: number): number {
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const start = performance.now();
    let raf = requestAnimationFrame(function frame(t) {
      const k = Math.min(1, (t - start) / 450);
      setProgress(k);
      if (k < 1) raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  return reducedMotion ? target : Math.round(target * (1 - Math.pow(1 - progress, 3)));
}

const BADGE: Record<Standing, string> = {
  winner: 'ทายแม่นกว่า',
  tied: 'สูสีกันเลย',
  behind: 'เจอกันรอบหน้า!',
};

function PlayerCard({
  suit,
  name,
  role,
  avatarId,
  score,
  description,
  standing,
}: {
  suit: string;
  name: string;
  role: string;
  avatarId: PlayerView['you']['avatarId'];
  score: number;
  description: string;
  standing: Standing;
}) {
  const shown = useCountUp(score);
  const avatar = AVATARS[avatarId] ?? AVATARS.cat;
  const standingClass = standing === 'behind' ? '' : styles[standing];
  return (
    <article className={`${styles.playerCard} ${standingClass}`}>
      <span className={styles.smallSuit} aria-hidden="true">
        {suit}
      </span>
      {standing === 'winner' && (
        <span className={styles.crown} aria-hidden="true">
          <svg viewBox="0 0 48 38">
            <path d="M6 12L17 19 24 5 32 19 43 12 39 31H10Z" fill="#e7bd67" stroke="#f9df9f" strokeWidth="2" />
            <path d="M11 31H39V35H11Z" fill="#c99542" />
            <circle cx="5" cy="10" r="3" fill="#ffe2a2" />
            <circle cx="24" cy="4" r="3" fill="#ffe2a2" />
            <circle cx="44" cy="10" r="3" fill="#ffe2a2" />
          </svg>
        </span>
      )}
      <div className={styles.portrait} style={{ '--portrait': avatar.bg } as CSSProperties} aria-hidden="true">
        {avatar.emoji}
      </div>
      <h2 className={styles.playerName}>{name}</h2>
      <span className={styles.youLabel}>{role}</span>
      <p className={styles.score} aria-label={`${score} จาก ${MAX_GAME_SCORE} คะแนน`}>
        <span aria-hidden="true">{shown}</span>
        <small aria-hidden="true">/{MAX_GAME_SCORE}</small>
      </p>
      <p className={styles.scoreDescription}>{description}</p>
      <span className={styles.resultBadge}>{BADGE[standing]}</span>
    </article>
  );
}

function BestRow({ title, round }: { title: string; round: RevealRound }) {
  return (
    <div className={styles.bestRow}>
      <div>
        <p className={styles.who}>{title}</p>
        <h3>{round.question.prompt}</h3>
        <p className={styles.roundNumber}>รอบ {round.roundIndex + 1}</p>
      </div>
      <p className={styles.bestScore}>
        {round.score.score}
        <small>/{MAX_ROUND_SCORE}</small>
      </p>
    </div>
  );
}

function HistoryRound({ round, partnerName }: { round: RevealRound; partnerName: string }) {
  const who = round.setter === 'you' ? `${partnerName}ทายคุณ` : `คุณทาย${partnerName}`;
  const byId = new Map(round.question.options.map((o) => [o.id, o]));
  return (
    <details className={styles.round}>
      <summary>
        <span className={styles.roundIndex}>{round.roundIndex + 1}</span>
        <span className={styles.roundText}>
          <strong>{round.question.prompt}</strong>
          <small>{who}</small>
        </span>
        <span className={styles.roundTotal}>
          {round.score.score}/{MAX_ROUND_SCORE}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className={styles.breakdown}>
        <table>
          <caption>เปรียบเทียบคำทายกับอันดับจริง</caption>
          <thead>
            <tr>
              <th scope="col">ตัวเลือก</th>
              <th scope="col">ทาย</th>
              <th scope="col">จริง</th>
              <th scope="col">แต้ม</th>
            </tr>
          </thead>
          <tbody>
            {round.score.breakdown.map((entry) => {
              const option = byId.get(entry.optionId)!;
              return (
                <tr key={entry.optionId}>
                  <td>
                    <span aria-hidden="true">{option.icon}</span> {option.label}
                  </td>
                  <td>{entry.guessedIndex + 1}</td>
                  <td>{entry.actualIndex + 1}</td>
                  <td className={entry.points === 2 ? styles.exact : entry.points === 1 ? styles.near : ''}>
                    +{entry.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
