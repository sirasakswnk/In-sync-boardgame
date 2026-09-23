import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { ROUNDS_PER_GAME, type PlayerView } from '@/lib/game';
import { RoomMenu } from './RoomMenu';
import styles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; onLeave: () => void };

/**
 * ส่วนหัวกะทัดรัด: แถวแรกชื่อเกม + เมนู ⋯ (รหัสห้อง, คัดลอกลิงก์, ออกจากห้อง)
 * แถวสองผู้เล่นสองฝั่งกับ “รอบ n/6” ตรงกลาง — บทบาทของรอบแสดงในกล่องคำถามแทน
 */
export function GameHeader({ view, partnerOnline, onLeave }: Props) {
  const game = view.game;
  const center =
    !game ? null : view.phase === 'RESULTS' ? 'จบเกม' : `รอบ ${game.roundIndex + 1}/${ROUNDS_PER_GAME}`;

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <Link href="/" className={styles.brand}>
          <span aria-hidden="true">💞</span> IN SYNC
        </Link>
        <RoomMenu view={view} onLeave={onLeave} />
      </div>

      <div className={styles.players}>
        <PlayerChip
          name={view.you.displayName}
          isYou
          avatarId={view.you.avatarId}
          online
          score={game ? game.totals.you : null}
        />

        {center ? (
          <span className={styles.roundTag}>{center}</span>
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
            score={game ? game.totals.partner : null}
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
  const status = online ? 'ออนไลน์' : 'ออฟไลน์';
  return (
    <div className={`${styles.playerChip} ${alignEnd ? styles.alignEnd : ''} ${isYou ? styles.isYou : ''}`}>
      <Avatar id={avatarId} size="sm" online={online} label={`${name}${isYou ? ' (คุณ)' : ''} ${status}`} />
      {/* ชื่อยาวตัดด้วย … แต่ title/aria-label ยังมีชื่อเต็ม และเมนู ⋯ แสดงชื่อเต็มด้วย */}
      {/* ฝั่งคุณอยู่ซ้ายเสมอและมีวงทองรอบอวาตาร์ — ไม่ใส่คำว่า “คุณ” หน้าชื่อเพื่อเหลือที่ให้ชื่อบนจอแคบ */}
      <span className={styles.playerName} title={isYou ? `${name} (คุณ)` : name}>
        {name}
      </span>
      {score !== null && (
        <span className={styles.scoreToken} aria-label={`${score} คะแนน`}>
          {score}
        </span>
      )}
    </div>
  );
}
