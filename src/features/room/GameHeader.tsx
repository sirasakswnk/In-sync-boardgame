import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { ROUNDS_PER_GAME, type PlayerView } from '@/lib/game';
import styles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; onLeave: () => void };

export function GameHeader({ view, partnerOnline, onLeave }: Props) {
  const game = view.game;
  const showScores = Boolean(game);
  const revealedRounds = game ? game.history.length : 0;

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <Link href="/" className={styles.brand}>
          <span aria-hidden="true">💞</span> ใจตรงกันแค่ไหน
        </Link>
        <span className={styles.roomTag}>
          ห้อง <strong>{view.code}</strong>
        </span>
        <button type="button" className={styles.leaveButton} onClick={onLeave}>
          ออกจากห้อง
        </button>
      </div>

      <div className={styles.players}>
        <PlayerChip
          name={view.you.displayName}
          isYou
          avatarId={view.you.avatarId}
          online
          score={showScores ? game!.totals.you : null}
        />

        {game ? (
          <div className={styles.progress} aria-label={`รอบ ${game.roundIndex + 1} จาก ${ROUNDS_PER_GAME}`}>
            <span className={styles.progressText}>
              {view.phase === 'RESULTS' ? 'จบเกม' : `รอบ ${game.roundIndex + 1}/${ROUNDS_PER_GAME}`}
            </span>
            <span className={styles.dots} aria-hidden="true">
              {Array.from({ length: ROUNDS_PER_GAME }, (_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${i < revealedRounds ? styles.dotDone : ''} ${
                    i === game.roundIndex && view.phase !== 'RESULTS' ? styles.dotNow : ''
                  }`}
                />
              ))}
            </span>
            {view.phase !== 'RESULTS' && (
              // สั้นไว้ไม่ให้เบียดชื่อ/คะแนนบนจอ 360px — หัวการ์ดคำถามบอกบทบาทเต็มอยู่แล้ว
              <span className={styles.roleChip} aria-label={game.role === 'setter' ? 'ตาคุณวาง' : 'ตาคุณทาย'}>
                {game.role === 'setter' ? '✍️ คุณวาง' : '🔮 คุณทาย'}
              </span>
            )}
          </div>
        ) : (
          <span className={styles.vs} aria-hidden="true">
            💞
          </span>
        )}

        {view.partner ? (
          <PlayerChip
            name={view.partner.displayName}
            avatarId={view.partner.avatarId}
            online={partnerOnline}
            score={showScores ? game!.totals.partner : null}
            alignEnd
          />
        ) : (
          <span className={styles.waitingChip}>รอคู่หู…</span>
        )}
      </div>
    </header>
  );
}

function PlayerChip({
  name,
  isYou,
  avatarId,
  online,
  score,
  alignEnd,
}: {
  name: string;
  isYou?: boolean;
  avatarId: PlayerView['you']['avatarId'];
  online: boolean;
  score: number | null;
  alignEnd?: boolean;
}) {
  return (
    <div className={`${styles.playerChip} ${alignEnd ? styles.alignEnd : ''}`}>
      <Avatar id={avatarId} size="md" online={online} label={`${name} ${online ? 'ออนไลน์' : 'ออฟไลน์'}`} />
      <span className={styles.playerMeta}>
        <span className={styles.playerName}>{name}</span>
        <span className={styles.playerScore}>
          {isYou && <strong className={styles.youTag}>คุณ · </strong>}
          {score !== null ? (
            <>
              {score}
              <span className={styles.scoreUnit}> คะแนน</span>
            </>
          ) : online ? (
            'ออนไลน์'
          ) : (
            'ออฟไลน์'
          )}
        </span>
      </span>
    </div>
  );
}
