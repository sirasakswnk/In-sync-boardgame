'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { RankList } from '@/components/RankList';
import type { PlayerView } from '@/lib/game';
import { clearDrafts, draftKey, loadDraft, saveDraft } from '@/lib/client/drafts';
import type { useCommands } from '@/lib/client/useRoom';
import styles from './room.module.css';

type Props = {
  view: PlayerView;
  uid: string;
  partnerOnline: boolean;
  cmds: ReturnType<typeof useCommands>;
};

/**
 * SELF_RANK — “สำหรับฉัน…” และ GUESS_RANK — “ฉันคิดว่า [คู่หู]…”
 * คอมโพเนนต์ถูก remount ทุกครั้งที่ เกม/รอบ/ช่วง เปลี่ยน (ผ่าน key) จึงเริ่มจาก layout ใหม่เสมอ
 */
export function RankStage({ view, uid, partnerOnline, cmds }: Props) {
  const game = view.game!;
  const guessing = game.phase === 'GUESS_RANK';
  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const optionIds = game.question.options.map((o) => o.id);
  const key = `${guessing ? 'guess' : 'self'}:${game.id}:${game.roundIndex}`;
  const dk = draftKey(uid, game.id, game.roundIndex, game.phase);

  // ลำดับตั้งต้น = draft ที่ยังไม่ส่ง (ถ้ามีและถูกต้อง) ไม่งั้นใช้ layout สุ่มจาก server
  const [order, setOrder] = useState<string[]>(() => loadDraft(dk, optionIds) ?? game.layout);

  // phase เปลี่ยนแล้ว draft ของช่วงอื่นไม่มีประโยชน์ (plan.md §11)
  useEffect(() => clearDrafts(uid, dk), [uid, dk]);

  const confirmed = guessing ? game.yourGuess : game.yourSelf;
  const pending = cmds.pendingFor(key);
  const uncertain = cmds.state.kind === 'uncertain' && cmds.state.key === key;
  const sending = cmds.state.kind === 'sending' && cmds.state.key === key;
  const partnerDone = game.submitted.partner;

  // ส่งแล้ว (server ยืนยัน) → ข้อมูล server ชนะ draft เสมอ
  const lockedOrder = confirmed ?? (pending && 'optionIds' in pending ? pending.optionIds : null);
  const shownOrder = lockedOrder ?? order;

  useEffect(() => {
    if (confirmed) clearDrafts(uid);
  }, [confirmed, uid]);

  function change(next: string[]) {
    setOrder(next);
    saveDraft(dk, next);
  }

  function submit() {
    void cmds.send(key, {
      kind: guessing ? 'guess' : 'self',
      optionIds: [...shownOrder],
      gameId: game.id,
      roundIndex: game.roundIndex,
      expectedPhase: game.phase,
    });
  }

  return (
    <div className={styles.stack}>
      <section className={styles.questionCard}>
        {guessing ? (
          <div className={styles.guessHead}>
            <Avatar id={view.partner!.avatarId} size="lg" online={partnerOnline} label={partnerName} />
            <div>
              <p className={styles.eyebrow}>ช่วงทายใจ · รอบ {game.roundIndex + 1}</p>
              <h1 className={styles.stageTitle}>ฉันคิดว่า {partnerName}…</h1>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>รอบ {game.roundIndex + 1} · ตอบตามใจตัวเอง</p>
            <h1 className={styles.stageTitle}>สำหรับฉัน…</h1>
          </>
        )}
        <p className={styles.prompt}>{game.question.prompt}</p>
        {guessing && (
          <p className={styles.muted}>เรียงตามที่คิดว่า {partnerName} ตอบ ไม่ใช่คำตอบของคุณเอง</p>
        )}
      </section>

      {guessing && game.yourSelf && (
        <details className={styles.ownAnswer}>
          <summary>
            <span aria-hidden="true">📝</span> ดูอันดับของฉันเอง <small>(คำตอบของคุณ ไม่ใช่ของ{partnerName})</small>
          </summary>
          <ol className={styles.ownList}>
            {game.yourSelf.map((id, i) => {
              const o = game.question.options.find((x) => x.id === id)!;
              return (
                <li key={id}>
                  <span className={styles.ownRank}>{i + 1}</span>
                  <span aria-hidden="true">{o.icon}</span> {o.label}
                </li>
              );
            })}
          </ol>
        </details>
      )}

      <section className={styles.boardCard} aria-label={guessing ? `คำทายอันดับของ${partnerName}` : 'อันดับของฉัน'}>
        <RankList
          options={game.question.options}
          order={shownOrder}
          topLabel={game.question.topLabel}
          bottomLabel={game.question.bottomLabel}
          label={guessing ? `คำทายอันดับของ${partnerName}` : 'อันดับของฉัน'}
          onChange={lockedOrder ? undefined : change}
          disabled={sending}
        />
      </section>

      <div className={styles.actionBar}>
        {confirmed ? (
          <div className={styles.waiting} role="status">
            <span className={styles.waitingPulse} aria-hidden="true" />
            {partnerDone ? (
              <span>ส่งครบทั้งคู่แล้ว กำลังไปต่อ…</span>
            ) : (
              <span>
                {guessing ? 'ล็อกคำทายแล้ว' : 'ส่งแล้ว'} • รอ {partnerName}
              </span>
            )}
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
            <Button block onClick={submit} loading={sending} disabled={!partnerOnline}>
              {guessing ? `ล็อกคำทาย 🔒` : 'ยืนยันอันดับของฉัน'}
            </Button>
            <p className={styles.hint}>
              {!partnerOnline
                ? `รอ ${partnerName} กลับมาออนไลน์ก่อนจึงส่งได้`
                : partnerDone
                  ? `${partnerName} ส่งแล้ว เหลือคุณคนเดียว`
                  : 'ส่งแล้วแก้ไม่ได้ — ลากการ์ด หรือใช้ปุ่มลูกศรเพื่อเรียง'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
