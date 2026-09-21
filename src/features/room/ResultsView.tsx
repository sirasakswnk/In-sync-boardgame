'use client';

import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import {
  bestRound,
  MAX_GAME_SCORE,
  MAX_ROUND_SCORE,
  outcomeOf,
  sameTopCount,
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
  const yourBest = bestRound(history, (r) => r.yourGuessScore.score);
  const partnerBest = bestRound(history, (r) => r.partnerGuessScore.score);
  const sameTop = sameTopCount(history);

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
        <p className={roomStyles.muted}>คะแนนมาจากการทายอันดับของอีกคน รอบละเต็ม {MAX_ROUND_SCORE}</p>
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
            score={yourBest.yourGuessScore.score}
          />
        )}
        {partnerBest && (
          <Highlight
            icon="🌟"
            title={`รอบที่${partnerName}ทายคุณแม่นที่สุด`}
            round={partnerBest}
            score={partnerBest.partnerGuessScore.score}
          />
        )}
        <div className={styles.highlight}>
          <span className={styles.hlIcon} aria-hidden="true">
            💞
          </span>
          <span>
            <strong>อันดับหนึ่งตรงกัน {sameTop} จาก {history.length} รอบ</strong>
            <small>เป็นแค่เรื่องชวนคุย ไม่ใช่คะแนนความเข้ากันได้</small>
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
  const [tab, setTab] = useState<'you' | 'partner'>('you');
  return (
    <details className={styles.historyItem}>
      <summary>
        <span className={styles.historyNum}>{round.roundIndex + 1}</span>
        <span className={styles.historyPrompt}>{round.question.prompt}</span>
        <span className={styles.historyScores}>
          +{round.yourGuessScore.score} / +{round.partnerGuessScore.score}
        </span>
      </summary>
      <div className={styles.historyBody}>
        <div className={styles.miniTabs}>
          <button type="button" aria-pressed={tab === 'you'} onClick={() => setTab('you')}>
            คุณทาย{partnerName} (+{round.yourGuessScore.score})
          </button>
          <button type="button" aria-pressed={tab === 'partner'} onClick={() => setTab('partner')}>
            {partnerName}ทายคุณ (+{round.partnerGuessScore.score})
          </button>
        </div>
        <RevealBreakdown
          key={tab}
          question={round.question}
          score={tab === 'you' ? round.yourGuessScore : round.partnerGuessScore}
          subjectName={tab === 'you' ? partnerName : 'คุณ'}
          animate={false}
        />
      </div>
    </details>
  );
}
