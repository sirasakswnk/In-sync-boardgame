'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { RankBoard } from '@/components/RankBoard';
import { RankList } from '@/components/RankList';
import { promptFor, type PlayerView } from '@/lib/game';
import { clearDrafts, draftKey, loadDraft, loadSlots, saveDraft, saveSlots } from '@/lib/client/drafts';
import { useLivePublisher } from '@/lib/client/live';
import type { useCommands } from '@/lib/client/useRoom';
import { emptySlots, isComplete, placedCount, slotsToStrings } from '@/lib/ui/board';
import styles from './room.module.css';

type Props = {
  view: PlayerView;
  uid: string;
  partnerOnline: boolean;
  cmds: ReturnType<typeof useCommands>;
  /** 'list' = รายการการ์ดแนวนอน (ค่าเริ่มต้น) · 'board' = ไพ่ในมือ + แท่นอันดับ (ธีมโต๊ะบอร์ดเกม) */
  variant?: 'list' | 'board';
};

/**
 * ตาของคนที่ต้องเรียง: SELF_RANK ของคนวาง — “สำหรับฉัน…” และ GUESS_RANK ของคนทาย — “ฉันคิดว่า [คู่หู]…”
 * คอมโพเนนต์ถูก remount ทุกครั้งที่ เกม/รอบ/ช่วง เปลี่ยน (ผ่าน key) จึงเริ่มจาก layout ใหม่เสมอ
 */
export function RankStage({ view, uid, partnerOnline, cmds, variant = 'list' }: Props) {
  const board = variant === 'board';
  const game = view.game!;
  const guessing = game.phase === 'GUESS_RANK';
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const optionIds = game.question.options.map((o) => o.id);
  const key = `${guessing ? 'guess' : 'self'}:${game.id}:${game.roundIndex}`;
  const dk = draftKey(uid, game.id, game.roundIndex, game.phase);

  // ลำดับตั้งต้น = draft ที่ยังไม่ส่ง (ถ้ามีและถูกต้อง) ไม่งั้นใช้ layout สุ่มจาก server
  const [order, setOrder] = useState<string[]>(() => loadDraft(dk, optionIds) ?? game.layout);
  // แบบแท่น: เริ่มจากไพ่อยู่ในมือทั้งหมด (ลำดับในมือ = layout สุ่มจาก server) — draft วางไม่ครบได้
  const [slots, setSlots] = useState<(string | null)[]>(() => loadSlots(dk, optionIds) ?? emptySlots(optionIds.length));

  // phase เปลี่ยนแล้ว draft ของช่วงอื่นไม่มีประโยชน์ (plan.md §11)
  useEffect(() => clearDrafts(uid, dk), [uid, dk]);

  // คนวางดูเราเรียงสด ๆ: ส่งลำดับตั้งต้น (หรือ draft ที่กู้หลัง refresh) ทันที แล้วส่งทุกครั้งที่ขยับ
  const publishLive = useLivePublisher(view.roomId, uid, game.liveKey, guessing && !game.yourGuess);
  const initialOrder = useRef<string[]>(board ? slotsToStrings(slots) : order);
  useEffect(() => {
    publishLive(initialOrder.current);
    // ส่งครั้งเดียวตอนเข้าช่วงทาย — การขยับถัดไปส่งผ่าน change()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmed = guessing ? game.yourGuess : game.yourSelf;
  const pending = cmds.pendingFor(key);
  const uncertain = cmds.state.kind === 'uncertain' && cmds.state.key === key;
  const sending = cmds.state.kind === 'sending' && cmds.state.key === key;

  // ส่งแล้ว (server ยืนยัน) → ข้อมูล server ชนะ draft เสมอ
  const lockedOrder = confirmed ?? (pending && 'optionIds' in pending ? pending.optionIds : null);
  const shownOrder = lockedOrder ?? order;
  const shownSlots: (string | null)[] = lockedOrder ? [...lockedOrder] : slots;
  const ready = !board || isComplete(shownSlots);
  const placed = board ? placedCount(shownSlots) : optionIds.length;

  useEffect(() => {
    if (confirmed) clearDrafts(uid);
  }, [confirmed, uid]);

  function change(next: string[]) {
    setOrder(next);
    saveDraft(dk, next);
    publishLive(next);
  }

  function changeSlots(next: (string | null)[]) {
    setSlots(next);
    saveSlots(dk, next);
    publishLive(slotsToStrings(next));
  }

  function submit() {
    // กันกดซ้ำระหว่างส่ง (useCommands กันอีกชั้นด้วย commandId เดิมต่อ key)
    if (sending) return;
    const optionIds = board ? (isComplete(shownSlots) ? [...shownSlots] : null) : [...shownOrder];
    if (!optionIds) return;
    void cmds.send(key, {
      kind: guessing ? 'guess' : 'self',
      optionIds,
      gameId: game.id,
      roundIndex: game.roundIndex,
      expectedPhase: game.phase,
    });
  }

  const actions = (
    <>
      {confirmed ? (
        <div className={styles.waiting} role="status">
          <span className={styles.waitingPulse} aria-hidden="true" />
          <span>{guessing ? 'ล็อกคำทายแล้ว • กำลังเปิดเฉลย…' : `ยืนยันแล้ว • ถึงตา ${partnerName} ทาย`}</span>
        </div>
      ) : uncertain ? (
        <>
          <Banner tone="warn" icon="⏳" live>
            {cmds.state.kind === 'uncertain' ? cmds.state.message : ''} ถ้ายังไม่ขึ้นว่าส่งแล้ว กดส่งอีกครั้งได้ — ระบบจะไม่นับซ้ำ
          </Banner>
          <Button block onClick={submit} disabled={!partnerOnline}>
            ลองส่งอีกครั้ง
          </Button>
        </>
      ) : (
        <>
          <p className={`${styles.boardStatus} ${ready ? styles.boardStatusReady : ''}`} aria-live="polite">
            {ready ? 'ครบแล้ว! ตรวจอันดับก่อนยืนยัน' : `จัดแล้ว ${placed}/${optionIds.length} ใบ`}
          </p>
          <Button block onClick={submit} loading={sending} disabled={!partnerOnline || !ready || sending}>
            {guessing ? 'ล็อกคำทาย' : 'ยืนยันอันดับของฉัน'}
          </Button>
          {!partnerOnline ? (
            <p className={styles.hint}>รอ {partnerName} กลับมาออนไลน์ก่อนจึงส่งได้</p>
          ) : !board ? (
            <p className={styles.hint}>ส่งแล้วแก้ไม่ได้ — ลากการ์ด หรือใช้ปุ่มลูกศรเพื่อเรียง</p>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <div className={`${styles.stack} ${board ? styles.compactStage : ''}`}>
      <section className={styles.questionCard}>
        {/* บทบาทอยู่ในกล่องคำถาม ให้อ่านจุดเดียวว่ากำลังตอบแทนใคร */}
        <p className={styles.roleLabel} title={guessing ? `ทายใจ ${partnerName}` : undefined}>
          {guessing ? (
            <Avatar id={view.partner!.avatarId} size="sm" online={partnerOnline} label={partnerName} />
          ) : (
            <span className={styles.roleIcon} aria-hidden="true">
              ✍️
            </span>
          )}
          <span className={styles.roleText}>{guessing ? `ทายใจ ${partnerName}` : 'จัดอันดับของคุณ'}</span>
        </p>
        <h1 className={styles.prompt}>{promptFor(game.question, guessing ? { name: partnerName } : { you: true })}</h1>
        {guessing ? (
          <p className={styles.watching}>
            <span aria-hidden="true">👀</span> {partnerName} กำลังดูคุณเรียงอยู่
          </p>
        ) : (
          <p className={styles.muted}>ตอบตามใจคุณจริง ๆ แล้ว {partnerName} จะมาทาย</p>
        )}
      </section>

      <section className={styles.boardCard} aria-label={guessing ? `คำทายอันดับของ${partnerName}` : 'อันดับของฉัน'}>
        {board ? (
          <RankBoard
            options={game.question.options}
            layout={game.layout}
            slots={shownSlots}
            topLabel={game.question.topLabel}
            bottomLabel={game.question.bottomLabel}
            label={guessing ? `คำทายอันดับของ${partnerName}` : 'อันดับของฉัน'}
            onChange={lockedOrder ? undefined : changeSlots}
            disabled={sending}
            footer={actions}
            trayNote={guessing ? <span className={styles.trayWatching}>👀 {partnerName} กำลังดูอยู่</span> : undefined}
          />
        ) : (
          <RankList
            options={game.question.options}
            order={shownOrder}
            topLabel={game.question.topLabel}
            bottomLabel={game.question.bottomLabel}
            label={guessing ? `คำทายอันดับของ${partnerName}` : 'อันดับของฉัน'}
            onChange={lockedOrder ? undefined : change}
            disabled={sending}
          />
        )}
      </section>

      {!board && <div className={styles.actionBar}>{actions}</div>}
    </div>
  );
}
