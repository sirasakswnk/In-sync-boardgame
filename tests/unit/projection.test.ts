import { describe, expect, it } from 'vitest';
import { buildViews, projectRoomForPlayer, type PlayerView } from '@/lib/game';
import { A, B, C, IDENTITY, REVERSED, Table, expectOk } from './helpers';

/**
 * แนวคิดการทดสอบความลับ: ถ้าคู่หูส่งคำตอบแล้ว มุมมองของเราต้องเปลี่ยน *เฉพาะ* flag boolean
 * ว่าคู่หูส่งแล้ว (และ revision) — ถ้าข้อมูลอื่นเปลี่ยน แปลว่าคำตอบของคู่หูรั่วมาในรูปใดรูปหนึ่ง
 */
function viewOf(t: Table, uid: string): PlayerView {
  const v = projectRoomForPlayer(t.room, uid);
  if (!v) throw new Error('not a member');
  return v;
}

function withoutVolatile(v: PlayerView) {
  const { revision: _revision, expiresAt: _expiresAt, ...rest } = structuredClone(v);
  if (rest.game) rest.game.submitted.partner = false;
  return rest;
}

describe('projectRoomForPlayer — allowlist (plan.md §9.3, §13 ข้อ 5)', () => {
  it('ไม่ใช่สมาชิกได้ null', () => {
    const t = new Table();
    expect(projectRoomForPlayer(t.room, C)).toBeNull();
  });

  it('LOBBY ไม่มีข้อมูลเกม', () => {
    const t = new Table();
    const v = viewOf(t, A);
    expect(v.phase).toBe('LOBBY');
    expect(v.game).toBeNull();
    expect(v.partner?.displayName).toBe('บ็อบ');
    expect(v.isHost).toBe(true);
    expect(viewOf(t, B).isHost).toBe(false);
  });

  it('SELF_RANK: คำตอบของคู่หูไม่รั่ว เห็นแค่ว่าส่งแล้ว', () => {
    const t = new Table();
    t.startGame();
    const before = viewOf(t, A);
    expectOk(t.scoped(B, 'self', t.optionIds().reverse()));
    const after = viewOf(t, A);

    expect(after.game!.submitted).toEqual({ you: false, partner: true });
    expect(withoutVolatile(after)).toEqual(withoutVolatile(before));
    expect(after.game!.reveal).toBeNull();
  });

  it('GUESS_RANK: เห็นคำตอบตัวเอง แต่ไม่เห็นคำตอบ/คำทาย/คะแนนของคู่หู', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    expectOk(t.scoped(A, 'self', ids));
    expectOk(t.scoped(B, 'self', [...ids].reverse()));

    const before = viewOf(t, A);
    expect(before.phase).toBe('GUESS_RANK');
    expect(before.game!.yourSelf).toEqual(ids);
    // layout ของช่วงทายมาจาก layouts.guess ไม่ใช่คำตอบของใคร
    expect(before.game!.layout).toEqual(t.round.layouts[A]!.guess);

    expectOk(t.scoped(B, 'guess', ids));
    const after = viewOf(t, A);
    expect(after.game!.submitted).toEqual({ you: false, partner: true });
    expect(withoutVolatile(after)).toEqual(withoutVolatile(before));
    expect(after.game!.totals).toEqual({ you: 0, partner: 0 });
  });

  it('คนที่ทายเสร็จก่อนก็ยังไม่เห็นคะแนนรอบนี้จนคู่หูทายครบ', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    expectOk(t.scoped(A, 'self', ids));
    expectOk(t.scoped(B, 'self', ids));
    expectOk(t.scoped(A, 'guess', ids));
    const v = viewOf(t, A);
    expect(v.game!.yourGuess).toEqual(ids);
    expect(v.game!.reveal).toBeNull();
    expect(v.game!.history).toHaveLength(0);
    expect(v.game!.totals.you).toBe(0);
    expect(JSON.stringify(v)).not.toMatch(/breakdown|score|partnerSelf|partnerGuess/);
  });

  it('REVEAL: ทั้งสองฝั่งเห็นข้อมูลครบ และมุมมองสลับฝั่งกันถูกต้อง', () => {
    const t = new Table();
    t.startGame();
    t.playRound({ aSelf: IDENTITY, bSelf: REVERSED, aGuess: REVERSED, bGuess: [1, 0, 2, 3, 4] });
    const va = viewOf(t, A);
    const vb = viewOf(t, B);
    expect(va.phase).toBe('REVEAL');

    const ra = va.game!.reveal!;
    const rb = vb.game!.reveal!;
    expect(ra.yourGuessScore.score).toBe(10); // A ทาย B
    expect(ra.partnerGuessScore.score).toBe(8); // B ทาย A
    expect(rb.yourGuessScore).toEqual(ra.partnerGuessScore);
    expect(rb.partnerSelf).toEqual(ra.yourSelf);
    expect(va.game!.totals).toEqual({ you: 10, partner: 8 });
    expect(vb.game!.totals).toEqual({ you: 8, partner: 10 });
    expect(ra.sameTopPick).toBe(false);
  });

  it('รอบถัดไป: ผลรอบก่อนอยู่ใน history แต่คำตอบรอบปัจจุบันของคู่หูยังเป็นความลับ', () => {
    const t = new Table();
    t.startGame();
    t.playRound({ aSelf: IDENTITY, bSelf: IDENTITY, aGuess: IDENTITY, bGuess: IDENTITY });
    t.continueBoth();
    expectOk(t.scoped(B, 'self', t.optionIds()));

    const v = viewOf(t, A);
    expect(v.game!.roundIndex).toBe(1);
    expect(v.game!.history.map((h) => h.roundIndex)).toEqual([0]);
    expect(v.game!.reveal).toBeNull();
    expect(v.game!.totals).toEqual({ you: 10, partner: 10 });
    // ไม่มีคำถามของรอบอนาคตหลุดมา
    const futureIds = t.game.rounds.slice(2).map((r) => r.question.id);
    const json = JSON.stringify(v);
    for (const id of futureIds) expect(json).not.toContain(`"${id}"`);
  });

  it('RESULTS: ย้อนดูได้ครบ 6 รอบ', () => {
    const t = new Table();
    t.startGame();
    for (let i = 0; i < 6; i++) {
      t.playRound({ aSelf: IDENTITY, bSelf: IDENTITY, aGuess: IDENTITY, bGuess: REVERSED });
      t.continueBoth();
    }
    const v = viewOf(t, A);
    expect(v.phase).toBe('RESULTS');
    expect(v.game!.history.map((h) => h.roundIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(v.game!.totals).toEqual({ you: 60, partner: 12 });
  });

  /**
   * Non-interference: สร้างสองโลกที่ต่างกันแค่ "คำตอบลับของคู่หู" ส่วนอื่นเหมือนกันทุกอย่าง
   * ถ้ามุมมองของเราในสองโลกไม่เท่ากัน แปลว่าคำตอบลับรั่วเข้ามาไม่ทางใดก็ทางหนึ่ง
   * (จับได้แม้ข้อมูลที่รั่วจะมีอยู่แล้วก่อนคู่หูกระทำ ซึ่งการ diff ก่อน/หลังจับไม่ได้)
   */
  describe('non-interference: คำตอบลับของคู่หูไม่มีผลต่อมุมมองเราก่อน REVEAL', () => {
    const orderX = IDENTITY;
    const orderY = [3, 0, 4, 2, 1];

    function world(bSelf: number[], bGuess: number[], stopAt: 'self' | 'guess-before' | 'guess-after') {
      const t = new Table();
      t.startGame();
      // จบรอบแรกให้มี history ก่อน เพื่อทดสอบในรอบที่สองด้วย
      t.playRound({ aSelf: IDENTITY, bSelf: IDENTITY, aGuess: IDENTITY, bGuess: IDENTITY });
      t.continueBoth();
      const ids = t.optionIds();
      const pick = (idx: number[]) => idx.map((i) => ids[i]!);
      expectOk(t.scoped(B, 'self', pick(bSelf)));
      if (stopAt === 'self') return viewOf(t, A);
      expectOk(t.scoped(A, 'self', ids));
      if (stopAt === 'guess-before') return viewOf(t, A);
      expectOk(t.scoped(B, 'guess', pick(bGuess)));
      return viewOf(t, A);
    }

    it.each(['self', 'guess-before', 'guess-after'] as const)('ช่วง %s', (stopAt) => {
      const v1 = world(orderX, orderX, stopAt);
      const v2 = world(orderY, orderY, stopAt);
      expect(v1.phase).toBe(stopAt === 'self' ? 'SELF_RANK' : 'GUESS_RANK');
      expect(v2).toEqual(v1);
    });

    it('เมื่อถึง REVEAL มุมมองต่างกันได้ (ยืนยันว่าเทสต์นี้ไวพอจะเห็นความต่าง)', () => {
      const reveal = (bSelf: number[]) => {
        const t = new Table();
        t.startGame();
        const ids = t.optionIds();
        const pick = (idx: number[]) => idx.map((i) => ids[i]!);
        expectOk(t.scoped(B, 'self', pick(bSelf)));
        expectOk(t.scoped(A, 'self', ids));
        expectOk(t.scoped(B, 'guess', ids));
        expectOk(t.scoped(A, 'guess', ids));
        return viewOf(t, A);
      };
      expect(reveal(orderY)).not.toEqual(reveal(orderX));
    });
  });

  it('ไม่มี receipts/layout ของคู่หู/state ภายในหลุดในมุมมองใด ๆ', () => {
    const t = new Table();
    t.startGame();
    const v = viewOf(t, A);
    const json = JSON.stringify(v);
    expect(json).not.toContain('receipts');
    expect(json).not.toContain('payloadHash');
    expect(json).not.toContain('layouts');
    expect(json).not.toContain('previousQuestionIds');
    // layout ที่เห็นเป็นของตัวเองเท่านั้น
    expect(v.game!.layout).toEqual(t.round.layouts[A]!.self);
  });

  it('buildViews สร้างมุมมองแยกของทุกสมาชิก', () => {
    const t = new Table();
    const views = buildViews(t.room);
    expect(Object.keys(views).sort()).toEqual([A, B].sort());
    expect(views[A]!.you.uid).toBe(A);
    expect(views[B]!.you.uid).toBe(B);
  });
});
