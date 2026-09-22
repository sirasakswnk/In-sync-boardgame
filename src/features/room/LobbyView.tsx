'use client';

import { useSyncExternalStore } from 'react';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  countQuestionsIn,
  getQuestionBank,
  ROUNDS_PER_GAME,
  type Category,
  type PlayerView,
  type PublicMember,
} from '@/lib/game';
import { useCopied, useInviteUrl } from '@/lib/client/clipboard';
import type { useCommands } from '@/lib/client/useRoom';
import { uuidv4 } from '@/lib/client/uuid';
import styles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };

const bank = getQuestionBank();

const noSubscribe = () => () => undefined;

export function LobbyView({ view, partnerOnline, cmds }: Props) {
  const { copied, copy } = useCopied<'link' | 'code'>();
  const partner = view.partner;
  const selected = view.settings.categories;
  const questionCount = countQuestionsIn(bank, selected);
  const enough = questionCount >= ROUNDS_PER_GAME;
  const sending = cmds.state.kind === 'sending';

  // ค่าที่มีเฉพาะในเบราว์เซอร์: ใช้ server snapshot ตอน hydrate เพื่อไม่ให้ HTML ไม่ตรงกัน
  const canShare = useSyncExternalStore(noSubscribe, () => 'share' in navigator, () => false);
  const inviteUrl = useInviteUrl(view.code);

  function toggle(category: Category) {
    if (!view.isHost) return;
    const next = selected.includes(category) ? selected.filter((c) => c !== category) : [...selected, category];
    if (next.length === 0) return;
    // เรียงตามลำดับหมวดเดิมเพื่อให้ผลเหมือนกันทุกครั้ง
    const ordered = CATEGORIES.filter((c) => next.includes(c));
    void cmds.send(`settings:${uuidv4()}`, { kind: 'settings', categories: ordered });
  }

  const startBlocker = !partner
    ? 'รอเพื่อนเข้าห้องก่อน'
    : !partnerOnline
      ? `${partner.displayName} ออฟไลน์อยู่`
      : !enough
        ? `หมวดที่เลือกมีคำถาม ${questionCount} ข้อ ต้องมีอย่างน้อย ${ROUNDS_PER_GAME} ข้อ`
        : !view.you.lobbyReady
          ? 'กด “ฉันพร้อมแล้ว” ก่อน'
          : !partner.lobbyReady
            ? `รอ ${partner.displayName} กดพร้อม`
            : null;

  return (
    <div className={styles.stack}>
      <section className={styles.inviteCard} aria-labelledby="invite-title">
        <p id="invite-title" className={styles.eyebrow}>
          ชวนเพื่อนเข้าห้อง
        </p>
        <button
          type="button"
          className={styles.codeButton}
          onClick={() => copy(view.code, 'code')}
          aria-label={`รหัสห้อง ${view.code.split('').join(' ')} กดเพื่อคัดลอก`}
        >
          {view.code}
        </button>
        <div className={styles.inviteActions}>
          <Button variant="secondary" onClick={() => copy(inviteUrl, 'link')}>
            {copied === 'link' ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกลิงก์เชิญ'}
          </Button>
          {canShare && (
            <Button
              variant="ghost"
              onClick={() =>
                navigator.share({ title: 'ใจตรงกันแค่ไหน', text: `มาเล่นด้วยกัน! รหัสห้อง ${view.code}`, url: inviteUrl }).catch(() => undefined)
              }
            >
              แชร์…
            </Button>
          )}
        </div>
        <p className={styles.srOnlyLive} aria-live="polite">
          {copied === 'code' ? 'คัดลอกรหัสห้องแล้ว' : copied === 'link' ? 'คัดลอกลิงก์เชิญแล้ว' : ''}
        </p>
      </section>

      <section className={styles.seats} aria-label="ผู้เล่นในห้อง">
        <Seat member={view.you} isYou isHost={view.hostUid === view.you.uid} online />
        {partner ? (
          <Seat member={partner} isHost={view.hostUid === partner.uid} online={partnerOnline} />
        ) : (
          <div className={`${styles.seat} ${styles.seatEmpty}`}>
            <span className={styles.seatGhost} aria-hidden="true">
              ?
            </span>
            <span>
              <strong>ที่นั่งว่าง</strong>
              <small>ส่งรหัสหรือลิงก์ให้เพื่อน</small>
            </span>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="cat-title">
        <div className={styles.panelHead}>
          <h2 id="cat-title">หมวดคำถาม</h2>
          <span className={styles.muted}>
            {questionCount} ข้อในคลัง · เล่น {ROUNDS_PER_GAME} ข้อ
          </span>
        </div>
        {!view.isHost && <p className={styles.muted}>เจ้าของห้องเป็นคนเลือกหมวด</p>}
        <div className={styles.chips}>
          {CATEGORIES.map((c) => {
            const on = selected.includes(c);
            return (
              <button
                key={c}
                type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                aria-pressed={on}
                disabled={!view.isHost || sending || (on && selected.length === 1)}
                onClick={() => toggle(c)}
              >
                <span aria-hidden="true">{on ? '✓' : '+'}</span>
                {CATEGORY_LABELS[c]}
                {c === 'relationships' && <small>เลือกเองถ้าอยาก</small>}
              </button>
            );
          })}
        </div>
        {!enough && (
          <Banner tone="warn">
            หมวดที่เลือกมีคำถาม {questionCount} ข้อ ต้องมีอย่างน้อย {ROUNDS_PER_GAME} ข้อ เลือกเพิ่มอีกหน่อยนะ
          </Banner>
        )}
        {view.isHost && <p className={styles.hint}>เปลี่ยนหมวดแล้ว ความพร้อมของทั้งคู่จะถูกรีเซ็ตเพื่อให้เห็นการตั้งค่าใหม่</p>}
      </section>

      <div className={styles.actionBar}>
        <Button
          variant={view.you.lobbyReady ? 'secondary' : 'primary'}
          block
          loading={sending}
          onClick={() => cmds.send(`ready:${uuidv4()}`, { kind: 'ready', ready: !view.you.lobbyReady })}
        >
          {view.you.lobbyReady ? 'ยกเลิกความพร้อม' : 'ฉันพร้อมแล้ว'}
        </Button>

        {view.isHost ? (
          <>
            <Button
              block
              disabled={startBlocker !== null || sending}
              onClick={() => cmds.send(`start:${view.revision}`, { kind: 'start' })}
            >
              เริ่มเกม 🎲
            </Button>
            {startBlocker && <p className={styles.hint}>{startBlocker}</p>}
          </>
        ) : (
          <p className={styles.hint}>
            {view.you.lobbyReady
              ? `รอ ${partner?.displayName ?? 'เจ้าของห้อง'} กดเริ่มเกม…`
              : 'กด “ฉันพร้อมแล้ว” เมื่อพร้อมเล่น'}
          </p>
        )}
      </div>
    </div>
  );
}

function Seat({
  member,
  isYou,
  isHost,
  online,
}: {
  member: PublicMember;
  isYou?: boolean;
  isHost: boolean;
  online: boolean;
}) {
  return (
    <div className={`${styles.seat} ${member.lobbyReady ? styles.seatReady : ''}`}>
      <Avatar id={member.avatarId} size="lg" online={online} label={`${member.displayName} ${online ? 'ออนไลน์' : 'ออฟไลน์'}`} />
      <span className={styles.seatMeta}>
        <strong className={styles.seatName}>
          {member.displayName}
          {isYou && <small> (คุณ)</small>}
        </strong>
        <span className={styles.seatTags}>
          {isHost && <span className={styles.tag}>👑 เจ้าของห้อง</span>}
          <span className={`${styles.tag} ${online ? styles.tagOnline : styles.tagOffline}`}>
            {online ? '● ออนไลน์' : '○ ออฟไลน์'}
          </span>
        </span>
        <span className={member.lobbyReady ? styles.readyYes : styles.readyNo}>
          {member.lobbyReady ? '✓ พร้อมแล้ว' : '… ยังไม่พร้อม'}
        </span>
      </span>
    </div>
  );
}
