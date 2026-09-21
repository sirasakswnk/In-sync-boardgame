import { describe, expect, it } from 'vitest';
import { buildTurn, buildViews, projectRoomForPlayer, type PlayerView } from '@/lib/game';
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

  it('SELF_RANK: คนทายเห็นคำถามและบทบาท แต่ไม่มี layout หรือคำตอบใด ๆ', () => {
    const t = new Table();
    t.startGame();
    const va = viewOf(t, A);
    const vb = viewOf(t, B);
    expect(va.game!.role).toBe('setter');
    expect(vb.game!.role).toBe('guesser');
    expect(va.game!.layout).toEqual(t.round.layouts[A]!.self);
    // คนทายยังไม่ถึงตาเรียง
    expect(vb.game!.layout).toEqual([]);
    expect(vb.game!.yourSelf).toBeNull();
    expect(vb.game!.liveKey).toBe(`${t.game.id}:0`);
    expect(vb.game!.guesserUid).toBe(B);
  });

  it('GUESS_RANK: คนวางเห็นคำตอบตัวเอง คนทายไม่เห็นคำตอบ คะแนน หรือเฉลย', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    expectOk(t.scoped(A, 'self', [...ids].reverse()));

    const va = viewOf(t, A);
    expect(va.phase).toBe('GUESS_RANK');
    expect(va.game!.yourSelf).toEqual([...ids].reverse());
    expect(va.game!.yourGuess).toBeNull();

    const vb = viewOf(t, B);
    expect(vb.game!.yourSelf).toBeNull();
    // layout ของช่วงทายมาจาก layouts.guess ไม่ใช่คำตอบของคนวาง
    expect(vb.game!.layout).toEqual(t.round.layouts[B]!.guess);
    expect(vb.game!.submitted).toEqual({ you: false, partner: false });
    expect(vb.game!.reveal).toBeNull();
    expect(vb.game!.history).toHaveLength(0);
    expect(JSON.stringify(vb)).not.toMatch(/breakdown|score|setterOrder|guessOrder/);
  });

  it('REVEAL: ทั้งสองฝั่งเห็นเฉลยเดียวกัน บอกถูกว่าใครวาง และคะแนนเข้าคนทาย', () => {
    const t = new Table();
    t.startGame();
    t.playRound({ self: IDENTITY, guess: [1, 0, 2, 3, 4] });
    const va = viewOf(t, A);
    const vb = viewOf(t, B);
    expect(va.phase).toBe('REVEAL');

    const ra = va.game!.reveal!;
    const rb = vb.game!.reveal!;
    expect(ra.setter).toBe('you');
    expect(rb.setter).toBe('partner');
    expect(ra.score.score).toBe(8);
    expect(rb.score).toEqual(ra.score);
    expect(rb.setterOrder).toEqual(ra.setterOrder);
    expect(rb.guessOrder).toEqual(ra.guessOrder);
    expect(va.game!.totals).toEqual({ you: 0, partner: 8 });
    expect(vb.game!.totals).toEqual({ you: 8, partner: 0 });
  });

  it('รอบถัดไป: ผลรอบก่อนอยู่ใน history แต่คำตอบรอบปัจจุบันของคนวางยังเป็นความลับ', () => {
    const t = new Table();
    t.startGame();
    t.playRound({ self: IDENTITY, guess: IDENTITY });
    t.advance();
    // รอบ 2: B วาง A ทาย
    expectOk(t.scoped(B, 'self', t.optionIds()));

    const v = viewOf(t, A);
    expect(v.game!.roundIndex).toBe(1);
    expect(v.game!.role).toBe('guesser');
    expect(v.game!.history.map((h) => h.roundIndex)).toEqual([0]);
    expect(v.game!.reveal).toBeNull();
    expect(v.game!.yourSelf).toBeNull();
    expect(v.game!.totals).toEqual({ you: 0, partner: 10 });
    // ไม่มีคำถามของรอบอนาคตหลุดมา
    const futureIds = t.game.rounds.slice(2).map((r) => r.question.id);
    const json = JSON.stringify(v);
    for (const id of futureIds) expect(json).not.toContain(`"${id}"`);
  });

  it('RESULTS: ย้อนดูได้ครบ 6 รอบ และแต่ละคนเป็นคนวาง 3 รอบ', () => {
    const t = new Table();
    t.startGame();
    for (let i = 0; i < 6; i++) {
      t.playRound({ self: IDENTITY, guess: i % 2 === 0 ? REVERSED : IDENTITY });
      t.advance();
    }
    const v = viewOf(t, A);
    expect(v.phase).toBe('RESULTS');
    expect(v.game!.history.map((h) => h.roundIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(v.game!.history.map((h) => h.setter)).toEqual(['you', 'partner', 'you', 'partner', 'you', 'partner']);
    // A ทายรอบคี่ได้ 10×3, B ทายรอบคู่ได้ 2×3
    expect(v.game!.totals).toEqual({ you: 30, partner: 6 });
  });

  /**
   * Non-interference: สร้างสองโลกที่ต่างกันแค่ "คำตอบลับของคนวาง" ส่วนอื่นเหมือนกันทุกอย่าง
   * ถ้ามุมมองของคนทายในสองโลกไม่เท่ากัน แปลว่าคำตอบลับรั่วเข้ามาไม่ทางใดก็ทางหนึ่ง
   * (จับได้แม้ข้อมูลที่รั่วจะมีอยู่แล้วก่อนคนวางกระทำ ซึ่งการ diff ก่อน/หลังจับไม่ได้)
   */
  describe('non-interference: คำตอบลับของคนวางไม่มีผลต่อมุมมองคนทายก่อน REVEAL', () => {
    const orderX = IDENTITY;
    const orderY = [3, 0, 4, 2, 1];

    // รอบแรก A วาง / รอบสอง B วาง — ทดสอบทั้งสองทิศและรอบที่มี history แล้ว
    function world(setterSelf: number[], round: 0 | 1) {
      const t = new Table();
      t.startGame();
      if (round === 1) {
        t.playRound({ self: IDENTITY, guess: IDENTITY });
        t.advance();
      }
      const ids = t.optionIds();
      const guesser = t.guesser;
      expectOk(t.scoped(t.setter, 'self', setterSelf.map((i) => ids[i]!)));
      return viewOf(t, guesser);
    }

    it.each([0, 1] as const)('รอบ %i ช่วง GUESS_RANK', (round) => {
      const v1 = world(orderX, round);
      const v2 = world(orderY, round);
      expect(v1.phase).toBe('GUESS_RANK');
      expect(v2).toEqual(v1);
    });

    it('เมื่อถึง REVEAL มุมมองต่างกันได้ (ยืนยันว่าเทสต์นี้ไวพอจะเห็นความต่าง)', () => {
      const reveal = (setterSelf: number[]) => {
        const t = new Table();
        t.startGame();
        const ids = t.optionIds();
        expectOk(t.scoped(A, 'self', setterSelf.map((i) => ids[i]!)));
        expectOk(t.scoped(B, 'guess', ids));
        return viewOf(t, B);
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

  it('buildTurn สรุปเทิร์นให้ rules ของ /live: key ของรอบ, phase และคนทาย', () => {
    const t = new Table();
    expect(buildTurn(t.room)).toBeNull();
    t.startGame();
    expect(buildTurn(t.room)).toEqual({ key: `${t.game.id}:0`, phase: 'SELF_RANK', guesserUid: B });
    t.playRound({ self: IDENTITY, guess: IDENTITY });
    t.advance();
    expect(buildTurn(t.room)).toEqual({ key: `${t.game.id}:1`, phase: 'SELF_RANK', guesserUid: A });
    // ไม่มีข้อมูลลับใน turn
    expect(JSON.stringify(buildTurn(t.room))).not.toMatch(/self|guess"|score/);
  });

  it('buildViews สร้างมุมมองแยกของทุกสมาชิก', () => {
    const t = new Table();
    const views = buildViews(t.room);
    expect(Object.keys(views).sort()).toEqual([A, B].sort());
    expect(views[A]!.you.uid).toBe(A);
    expect(views[B]!.you.uid).toBe(B);
  });
});
