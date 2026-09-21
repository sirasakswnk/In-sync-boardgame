'use client';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
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
import { RevealBreakdown } from './RevealBreakdown';
import styles from './reveal.module.css';
import roomStyles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };

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

  const headline =
    outcome === 'tie'
      ? { emoji: '🤝', text: 'เสมอกัน! รู้ใจกันพอ ๆ กันเลย' }
      : outcome === 'you'
        ? { emoji: '🎉', text: `คุณรู้ใจ${partnerName}มากกว่านิดนึง` }
        : { emoji: '💝', text: `${partnerName}รู้ใจคุณมากกว่านิดนึง` };

  function rematch() {
    void cmds.send(key, {
      kind: 'rematch',
      gameId: game.id,
      roundIndex: game.roundIndex,
      expectedPhase: 'RESULTS',
    });
  }

  return (
    <div className={roomStyles.stack}>
      <section className={styles.resultsHero}>
        <span className={styles.resultsEmoji} aria-hidden="true">
          {headline.emoji}
        </span>
        <h1 className={styles.resultsTitle}>{headline.text}</h1>
        <p className={roomStyles.muted}>
          ผลัดกันทายคนละ {GUESSES_PER_PLAYER} รอบ · เต็มคนละ {MAX_GAME_SCORE}
        </p>
      </section>

      <section className={styles.scoreCards} aria-label="คะแนนรวม">
        <ScoreCard
          label={`คุณทาย${partnerName}ได้`}
          score={game.totals.you}
          avatarId={view.you.avatarId}
          lead={outcome === 'you'}
        />
        <ScoreCard
          label={`${partnerName}ทายคุณได้`}
          score={game.totals.partner}
          avatarId={view.partner!.avatarId}
          lead={outcome === 'partner'}
        />
      </section>

      <section className={styles.highlights}>
        {yourBest && (
          <Highlight
            icon="🏅"
            title="รอบที่คุณทายแม่นที่สุด"
            round={yourBest}
            score={yourBest.score.score}
          />
        )}
        {partnerBest && (
          <Highlight
            icon="🌟"
            title={`รอบที่${partnerName}ทายคุณแม่นที่สุด`}
            round={partnerBest}
            score={partnerBest.score.score}
          />
        )}
        <div className={styles.highlight}>
          <span className={styles.hlIcon} aria-hidden="true">
            🎯
          </span>
          <span>
            <strong>
              ทายตรงเป๊ะ · คุณ {yourHits} ใบ · {partnerName} {partnerHits} ใบ
            </strong>
            <small>จากการ์ดที่แต่ละคนทาย คนละ {youGuessed.length * OPTIONS_PER_ROUND} ใบ</small>
          </span>
        </div>
      </section>

      <section className={styles.historyCard} aria-labelledby="history-title">
        <h2 id="history-title" className={styles.historyTitle}>
          ย้อนดูเฉลยทุกรอบ
        </h2>
        {history.map((r) => (
          <HistoryRound key={r.roundIndex} round={r} partnerName={partnerName} />
        ))}
      </section>

      <div className={roomStyles.actionBar}>
        {game.rematch.you ? (
          <div className={roomStyles.waiting} role="status">
            <span className={roomStyles.waitingPulse} aria-hidden="true" />
            <span>อยากเล่นอีกครั้ง • รอ {partnerName} ตอบรับ</span>
          </div>
        ) : (
          <>
            <Button block onClick={rematch} loading={sending} disabled={!partnerOnline}>
              เล่นอีกครั้ง 🔁
            </Button>
            <p className={roomStyles.hint}>
              {!partnerOnline
                ? `รอ ${partnerName} กลับมาออนไลน์`
                : game.rematch.partner
                  ? `${partnerName} อยากเล่นอีกรอบ!`
                  : 'ต้องกดทั้งสองคน แล้วจะกลับไปเลือกหมวดใหม่ในห้องเดิม'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  avatarId,
  lead,
}: {
  label: string;
  score: number;
  avatarId: PlayerView['you']['avatarId'];
  lead: boolean;
}) {
  return (
    <div className={`${styles.scoreCard} ${lead ? styles.scoreLead : ''}`}>
      <Avatar id={avatarId} size="lg" />
      <span className={styles.scoreLabel}>{label}</span>
      <span className={styles.scoreValue}>
        {score}
        <small>/{MAX_GAME_SCORE}</small>
      </span>
      {lead && <span className={styles.leadTag}>👑 ทายแม่นกว่า</span>}
    </div>
  );
}

function Highlight({ icon, title, round, score }: { icon: string; title: string; round: RevealRound; score: number }) {
  return (
    <div className={styles.highlight}>
      <span className={styles.hlIcon} aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong>{title}</strong>
        <small>
          รอบ {round.roundIndex + 1} · {round.question.prompt} · {score}/{MAX_ROUND_SCORE}
        </small>
      </span>
    </div>
  );
}

function HistoryRound({ round, partnerName }: { round: RevealRound; partnerName: string }) {
  const youSet = round.setter === 'you';
  const who = youSet ? `${partnerName}ทายคุณ` : `คุณทาย${partnerName}`;
  return (
    <details className={styles.historyItem}>
      <summary>
        <span className={styles.historyNum}>{round.roundIndex + 1}</span>
        <span className={styles.historyPrompt}>
          {round.question.prompt}
          <small className={styles.historyWho}>{who}</small>
        </span>
        <span className={styles.historyScores}>+{round.score.score}</span>
      </summary>
      <div className={styles.historyBody}>
        <RevealBreakdown
          question={round.question}
          score={round.score}
          subjectName={youSet ? 'คุณ' : partnerName}
          animate={false}
        />
      </div>
    </details>
  );
}
