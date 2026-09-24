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
  isSpecialOnly,
  ROUNDS_PER_GAME,
  roundsFor,
  SPECIAL_CATEGORY,
  type Category,
  type PlayerView,
  type PublicMember,
} from '@/lib/game';
import { useCopied, useInviteUrl } from '@/lib/client/clipboard';
import type { useCommands } from '@/lib/client/useRoom';
import { uuidv4 } from '@/lib/client/uuid';
import lobby from './lobby.module.css';
import styles from './room.module.css';

type Props = { view: PlayerView; partnerOnline: boolean; cmds: ReturnType<typeof useCommands> };

const bank = getQuestionBank();

/** ไอคอนหน้ากองคำถามแต่ละหมวด */
const CATEGORY_ICONS: Record<Category, string> = {
  daily: '🏠',
  food: '🍜',
  gaming: '🎮',
  hypothetical: '🔮',
  annoyances: '😤',
  relationships: '💞',
  custom: '⭐',
};

const noSubscribe = () => () => undefined;

export function LobbyView({ view, partnerOnline, cmds }: Props) {
  const { copied, copy } = useCopied<'link' | 'code'>();
  const partner = view.partner;
  const selected = view.settings.categories;
  const questionCount = countQuestionsIn(bank, selected);
  const special = isSpecialOnly(selected);
  const rounds = roundsFor(bank, selected);
  const enough = rounds > 0;
  const notEnoughMessage = special
    ? `ชุดพิเศษมี ${questionCount} ข้อ ต้องเป็นเลขคู่ตั้งแต่ 2 ข้อขึ้นไป ทั้งสองคนจึงได้ทายเท่ากัน`
    : `หมวดที่เลือกมีคำถาม ${questionCount} ข้อ ต้องมีอย่างน้อย ${ROUNDS_PER_GAME} ข้อ`;
  const sending = cmds.state.kind === 'sending';

  // ค่าที่มีเฉพาะในเบราว์เซอร์: ใช้ server snapshot ตอน hydrate เพื่อไม่ให้ HTML ไม่ตรงกัน
  const canShare = useSyncExternalStore(noSubscribe, () => 'share' in navigator, () => false);
  const inviteUrl = useInviteUrl(view.code);

  function toggle(category: Category) {
    let next = selected.includes(category) ? selected.filter((c) => c !== category) : [...selected, category];
    // ชุดพิเศษเล่นแยกจากกองอื่น: เลือกชุดพิเศษ = ใช้กองเดียว, เลือกกองอื่น = ออกจากชุดพิเศษ
    if (!selected.includes(category)) {
      next = category === SPECIAL_CATEGORY ? [category] : next.filter((c) => c !== SPECIAL_CATEGORY);
    }
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
        ? notEnoughMessage
        : !view.you.lobbyReady
          ? 'กด “ฉันพร้อมแล้ว” ก่อน'
          : !partner.lobbyReady
            ? `รอ ${partner.displayName} กดพร้อม`
            : null;

  return (
    <div className={lobby.page}>
      {/* ไพ่เชิญ: รหัสห้องเป็นตัวต่อไม้ กดทั้งแถวเพื่อคัดลอก */}
      <section className={lobby.invite} aria-labelledby="invite-title">
        <p id="invite-title" className={lobby.inviteTitle}>
          ไพ่เชิญเข้าห้อง
        </p>
        <button
          type="button"
          className={lobby.codeTiles}
          onClick={() => copy(view.code, 'code')}
          aria-label={`รหัสห้อง ${view.code.split('').join(' ')} กดเพื่อคัดลอก`}
        >
          {view.code.split('').map((ch, i) => (
            <span key={i} className={lobby.tile} aria-hidden="true">
              {ch}
            </span>
          ))}
        </button>
        <p className={lobby.inviteHint}>{copied === 'code' ? 'คัดลอกรหัสแล้ว ✓' : 'แตะรหัสเพื่อคัดลอก'}</p>
        <div className={lobby.inviteActions}>
          <button type="button" className={lobby.paperButton} onClick={() => copy(inviteUrl, 'link')}>
            {copied === 'link' ? 'คัดลอกลิงก์แล้ว ✓' : '🔗 คัดลอกลิงก์เชิญ'}
          </button>
          {canShare && (
            <button
              type="button"
              className={lobby.paperButton}
              onClick={() =>
                navigator.share({ title: 'IN SYNC', text: `มาเล่นด้วยกัน! รหัสห้อง ${view.code}`, url: inviteUrl }).catch(() => undefined)
              }
            >
              📤 แชร์…
            </button>
          )}
        </div>
        <p className={styles.srOnlyLive} aria-live="polite">
          {copied === 'code' ? 'คัดลอกรหัสห้องแล้ว' : copied === 'link' ? 'คัดลอกลิงก์เชิญแล้ว' : ''}
        </p>
      </section>

      {/* ที่นั่งรอบโต๊ะ: ไพ่ผู้เล่นสองใบหันหน้าเข้าหากัน */}
      <section className={lobby.table} aria-label="ผู้เล่นในห้อง">
        <Seat member={view.you} isYou isHost={view.hostUid === view.you.uid} online />
        <span className={lobby.vs} aria-hidden="true">
          💞
        </span>
        {partner ? (
          <Seat member={partner} isHost={view.hostUid === partner.uid} online={partnerOnline} />
        ) : (
          <div className={`${lobby.seat} ${lobby.seatBack}`}>
            <span className={lobby.backMark} aria-hidden="true">
              ?
            </span>
            <strong className={lobby.seatName}>รอเพื่อน…</strong>
            <small className={lobby.backHint}>ส่งรหัสหรือลิงก์ให้เพื่อน</small>
          </div>
        )}
      </section>

      {/* เลือกกองคำถาม */}
      <section className={lobby.decksBoard} aria-labelledby="cat-title">
        <div className={lobby.decksHead}>
          <h2 id="cat-title">เลือกกองคำถาม</h2>
          <span>
            {special ? `เล่นครบ ${questionCount} ข้อตามลำดับ` : `${questionCount} ข้อในกอง · เล่น ${ROUNDS_PER_GAME} ข้อ`}
          </span>
        </div>
        <p className={lobby.boardNote}>ทั้งสองคนเลือกกองได้ · เจ้าของห้องเป็นคนกดเริ่มเกม</p>
        <div className={lobby.decks}>
          {CATEGORIES.map((c) => {
            const on = selected.includes(c);
            return (
              <button
                key={c}
                type="button"
                className={`${lobby.deck} ${on ? lobby.deckOn : ''}`}
                aria-pressed={on}
                disabled={sending || (on && selected.length === 1)}
                onClick={() => toggle(c)}
              >
                <span className={lobby.deckIcon} aria-hidden="true">
                  {CATEGORY_ICONS[c]}
                </span>
                <span className={lobby.deckText}>
                  <span className={lobby.deckName}>{CATEGORY_LABELS[c]}</span>
                  <small>
                    {countQuestionsIn(bank, [c])} ข้อ
                    {c === 'relationships' ? ' · เลือกเองถ้าอยาก' : c === SPECIAL_CATEGORY ? ' · เล่นครบทุกข้อ' : ''}
                  </small>
                </span>
                {on && (
                  <span className={lobby.deckCheck} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!enough && (
          <Banner tone="warn">
            {special ? notEnoughMessage : `${notEnoughMessage} เลือกเพิ่มอีกหน่อยนะ`}
          </Banner>
        )}
        <p className={lobby.boardNote}>เปลี่ยนกองแล้ว ความพร้อมของทั้งคู่จะถูกรีเซ็ตเพื่อให้เห็นการตั้งค่าใหม่</p>

        {/* ถาดไม้: ปุ่มพร้อม / เริ่มเกม */}
        <div className={lobby.tray}>
          <Button
            variant={view.you.lobbyReady ? 'secondary' : 'primary'}
            block
            loading={sending}
            onClick={() => cmds.send(`ready:${uuidv4()}`, { kind: 'ready', ready: !view.you.lobbyReady })}
          >
            {view.you.lobbyReady ? 'ยกเลิกความพร้อม' : 'ฉันพร้อมแล้ว ✋'}
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
              {startBlocker && <p className={lobby.trayHint}>{startBlocker}</p>}
            </>
          ) : (
            <p className={lobby.trayHint}>
              {view.you.lobbyReady
                ? `รอ ${partner?.displayName ?? 'เจ้าของห้อง'} กดเริ่มเกม…`
                : 'กด “ฉันพร้อมแล้ว” เมื่อพร้อมเล่น'}
            </p>
          )}
        </div>
      </section>
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
  const name = `${member.displayName}${isYou ? ' (คุณ)' : ''}`;
  return (
    <div className={`${lobby.seat} ${member.lobbyReady ? lobby.seatReady : ''}`}>
      {isHost && (
        <span className={lobby.crown} role="img" aria-label="เจ้าของห้อง">
          👑
        </span>
      )}
      <Avatar id={member.avatarId} size="lg" online={online} label={`${name} ${online ? 'ออนไลน์' : 'ออฟไลน์'}`} />
      <strong className={lobby.seatName} title={name}>
        {member.displayName}
      </strong>
      <small className={lobby.seatSub}>
        {isYou ? 'คุณ · ' : ''}
        {online ? 'ออนไลน์' : 'ออฟไลน์'}
      </small>
      {/* ความพร้อมเป็นตราประทับ */}
      <span className={member.lobbyReady ? lobby.stampReady : lobby.stampWaiting}>
        {member.lobbyReady ? 'พร้อม!' : 'ยังไม่พร้อม'}
      </span>
    </div>
  );
}
