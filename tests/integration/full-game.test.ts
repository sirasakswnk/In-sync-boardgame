import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PlayerView } from '@/lib/game';
import {
  ack,
  firebaseReady,
  Janitor,
  pick,
  Player,
  scopedBody,
  TestServer,
  viewOf,
  waitFor,
} from './harness';

const I = [0, 1, 2, 3, 4];
const R = [4, 3, 2, 1, 0];

// แผนเดียวกับ unit test: คะแนนคำนวณล่วงหน้าได้เพราะอิง index ของตัวเลือก ไม่ใช่คำถามที่สุ่มได้
const PLAN = [
  { aSelf: I, bSelf: I, aGuess: I, bGuess: [2, 1, 0, 3, 4] }, // A10 B6
  { aSelf: I, bSelf: R, aGuess: R, bGuess: R }, // A10 B2
  { aSelf: R, bSelf: I, aGuess: [1, 0, 2, 3, 4], bGuess: R }, // A8 B10
  { aSelf: I, bSelf: I, aGuess: R, bGuess: I }, // A2 B10
  { aSelf: I, bSelf: I, aGuess: [2, 1, 0, 3, 4], bGuess: [1, 0, 2, 3, 4] }, // A6 B8
  { aSelf: I, bSelf: I, aGuess: [0, 1, 2, 4, 3], bGuess: R }, // A8 B2
];
const EXPECTED_A = [10, 10, 8, 2, 6, 8];
const EXPECTED_B = [6, 2, 10, 10, 8, 2];

/** ส่วนของมุมมองที่ต้องไม่เปลี่ยนเมื่อคู่หูส่งคำตอบลับ */
function stable(v: PlayerView) {
  const { revision: _r, expiresAt: _e, ...rest } = structuredClone(v);
  if (rest.game) rest.game.submitted.partner = false;
  return rest;
}

describe.skipIf(!firebaseReady())('เกมเต็ม 6 รอบ: สองผู้เล่นคุยกับ backend จริง (§13 ข้อ 15, 16)', () => {
  const server = new TestServer();
  const janitor = new Janitor();
  let alice: Player;
  let bob: Player;
  let carol: Player;
  let code = '';
  let roomId = '';

  beforeAll(async () => {
    await server.start();
    alice = janitor.trackPlayer(await Player.create('alice', server));
    bob = janitor.trackPlayer(await Player.create('bob', server));
    carol = janitor.trackPlayer(await Player.create('carol', server));
    expect((await alice.profile('อลิซ', 'cat')).status).toBe(200);
    expect((await bob.profile('บ็อบ', 'dog')).status).toBe(200);
    expect((await carol.profile('แครอล', 'fox')).status).toBe(200);
  }, 180_000);

  afterAll(async () => {
    await janitor.cleanup();
    await server.stop();
  }, 60_000);

  it('สร้างห้อง → เข้าห้อง → คนที่สามเข้าไม่ได้', async () => {
    const created = await alice.createRoom();
    code = created.code;
    roomId = created.roomId;
    janitor.trackRoom(roomId, code);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(created.view.isHost).toBe(true);

    const joined = await bob.join(code);
    expect(joined.status).toBe(200);
    expect(viewOf(joined).you.seat).toBe(1);
    expect(viewOf(joined).partner?.displayName).toBe('อลิซ');

    // สมาชิกเดิมเข้าซ้ำ (เช่นรีเฟรช/deep link) ได้ที่นั่งเดิม ไม่กินที่ใหม่
    const again = await bob.join(code);
    expect(viewOf(again).you.seat).toBe(1);

    const third = await carol.join(code);
    expect(third.status).toBe(409);
    expect(ack(third).code).toBe('ROOM_FULL');

    // คนนอกอ่าน snapshot ไม่ได้ และไม่ได้ข้อมูลเกม
    const peek = await carol.snapshot(code);
    expect(peek.body.ok).toBe(false);
    expect(peek.body.view).toBeUndefined();
  });

  it('RTDB rules: อ่านได้เฉพาะมุมมองตัวเอง, state และ view ของคนอื่นอ่านไม่ได้, client เขียนเกมไม่ได้', async () => {
    await alice.online(roomId);
    await bob.online(roomId);

    expect(await alice.canRead(`rooms/${roomId}/views/${alice.uid}`)).toBe(true);
    expect(await alice.canRead(`rooms/${roomId}/views/${bob.uid}`)).toBe(false);
    expect(await alice.canRead(`rooms/${roomId}/state`)).toBe(false);
    expect(await alice.canRead(`rooms/${roomId}`)).toBe(false);
    expect(await alice.canRead(`rooms/${roomId}/presence`)).toBe(true);
    expect(await carol.canRead(`rooms/${roomId}/presence`)).toBe(false);
    expect(await carol.canRead(`rooms/${roomId}/views/${carol.uid}`)).toBe(false);
    expect(await alice.canRead(`users/${bob.uid}`)).toBe(false);

    expect(await alice.canWrite(`rooms/${roomId}/state/game`, { phase: 'RESULTS' })).toBe(false);
    expect(await alice.canWrite(`rooms/${roomId}/views/${alice.uid}/phase`, 'REVEAL')).toBe(false);
    expect(await alice.canWrite(`rooms/${roomId}/presence/${bob.uid}/fake`, true)).toBe(false);
    expect(await carol.canWrite(`rooms/${roomId}/presence/${carol.uid}/sneak`, true)).toBe(false);
    expect(await alice.canWrite(`rooms/${roomId}/presence/${alice.uid}/bad`, 'yes')).toBe(false);
  });

  it('lobby: ready ทั้งคู่ แล้ว host เริ่มเกมใน game ID เดียวกัน', async () => {
    expect(ack(await bob.command(code, { kind: 'start' })).code).toBe('NOT_HOST');
    expect(ack(await alice.command(code, { kind: 'start' })).code).toBe('NOT_READY');
    expect(ack(await alice.command(code, { kind: 'ready', ready: true })).ok).toBe(true);
    expect(ack(await bob.command(code, { kind: 'ready', ready: true })).ok).toBe(true);
    const started = await alice.command(code, { kind: 'start' });
    expect(ack(started).ok).toBe(true);

    const va = viewOf(started);
    const vb = (await bob.readView(roomId))!;
    expect(va.phase).toBe('SELF_RANK');
    expect(vb.phase).toBe('SELF_RANK');
    expect(vb.game!.id).toBe(va.game!.id);
    expect(vb.game!.question.id).toBe(va.game!.question.id);
  });

  it('เล่นครบ 6 รอบ: ความลับไม่รั่วก่อนเฉลย และคะแนนตรงค่าที่คำนวณไว้', async () => {
    for (let round = 0; round < 6; round++) {
      const plan = PLAN[round]!;
      let va = (await alice.readView(roomId))!;
      let vb = (await bob.readView(roomId))!;
      expect(va.game!.roundIndex).toBe(round);
      expect(va.phase).toBe('SELF_RANK');

      // --- SELF_RANK: บ็อบส่งก่อน มุมมองของอลิซต้องเปลี่ยนแค่ flag ---
      const beforeA = (await alice.readView(roomId))!;
      expect(ack(await bob.command(code, scopedBody(vb, 'self', pick(vb, plan.bSelf)))).ok).toBe(true);
      const afterA = await waitFor(async () => {
        const v = await alice.readView(roomId);
        return v?.game?.submitted.partner ? v : null;
      }, 'อลิซเห็นว่าบ็อบส่งแล้ว');
      expect(stable(afterA)).toEqual(stable(beforeA));
      expect(afterA.phase).toBe('SELF_RANK');

      va = afterA;
      const selfA = await alice.command(code, scopedBody(va, 'self', pick(va, plan.aSelf)));
      expect(ack(selfA).ok).toBe(true);
      expect(viewOf(selfA).phase).toBe('GUESS_RANK');

      // --- GUESS_RANK: อลิซเห็นคำตอบตัวเอง แต่ไม่เห็นของบ็อบ ---
      va = (await alice.readView(roomId))!;
      vb = (await bob.readView(roomId))!;
      expect(va.game!.yourSelf).toEqual(pick(va, plan.aSelf));
      expect(va.game!.reveal).toBeNull();
      // history มีได้เฉพาะรอบที่เฉลยแล้ว (plan.md §9.3) ส่วนรอบปัจจุบันต้องไม่มีข้อมูลของคู่หูเลย
      const { history, ...currentRound } = va.game!;
      expect(history.every((h) => h.roundIndex < round)).toBe(true);
      expect(JSON.stringify(currentRound)).not.toMatch(/partnerSelf|partnerGuess|breakdown/);

      const beforeGuessA = va;
      expect(ack(await bob.command(code, scopedBody(vb, 'guess', pick(vb, plan.bGuess)))).ok).toBe(true);
      const afterGuessA = await waitFor(async () => {
        const v = await alice.readView(roomId);
        return v?.game?.submitted.partner ? v : null;
      }, 'อลิซเห็นว่าบ็อบทายแล้ว');
      expect(stable(afterGuessA)).toEqual(stable(beforeGuessA));
      expect(afterGuessA.game!.totals.you).toBe(EXPECTED_A.slice(0, round).reduce((s, x) => s + x, 0));

      const guessA = await alice.command(code, scopedBody(afterGuessA, 'guess', pick(afterGuessA, plan.aGuess)));
      expect(ack(guessA).ok).toBe(true);

      // --- REVEAL: ทั้งคู่เห็นเฉลยพร้อมกันใน phase เดียว ---
      va = viewOf(guessA);
      vb = await waitFor(async () => {
        const v = await bob.readView(roomId);
        return v?.phase === 'REVEAL' ? v : null;
      }, 'บ็อบเห็นเฉลย');
      expect(va.phase).toBe('REVEAL');
      expect(va.game!.reveal!.yourGuessScore.score).toBe(EXPECTED_A[round]);
      expect(va.game!.reveal!.partnerGuessScore.score).toBe(EXPECTED_B[round]);
      expect(vb.game!.reveal!.yourGuessScore.score).toBe(EXPECTED_B[round]);
      expect(vb.game!.reveal!.partnerSelf).toEqual(va.game!.reveal!.yourSelf);

      // --- continue barrier: คนเดียวกดไม่เลื่อน ---
      const contA = await alice.command(code, scopedBody(va, 'continue'));
      expect(viewOf(contA).phase).toBe('REVEAL');
      const contB = await bob.command(code, scopedBody(vb, 'continue'));
      expect(ack(contB).ok).toBe(true);
      expect(viewOf(contB).phase).toBe(round === 5 ? 'RESULTS' : 'SELF_RANK');
    }

    const finalA = (await alice.readView(roomId))!;
    const finalB = (await bob.readView(roomId))!;
    expect(finalA.phase).toBe('RESULTS');
    expect(finalA.game!.totals).toEqual({ you: 44, partner: 38 });
    expect(finalB.game!.totals).toEqual({ you: 38, partner: 44 });
    expect(finalA.game!.history.map((h) => h.roundIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  }, 180_000);

  it('rematch ต้องยืนยันทั้งสองคน แล้วเกมใหม่เริ่มจากศูนย์ด้วย game ID ใหม่', async () => {
    const va = (await alice.readView(roomId))!;
    const vb = (await bob.readView(roomId))!;
    const oldGameId = va.game!.id;
    const oldQuestions = va.game!.history.map((h) => h.question.id);

    const first = await alice.command(code, scopedBody(va, 'rematch'));
    expect(viewOf(first).phase).toBe('RESULTS');
    const second = await bob.command(code, scopedBody(vb, 'rematch'));
    expect(viewOf(second).phase).toBe('LOBBY');
    expect(viewOf(second).you.lobbyReady).toBe(false);

    await alice.command(code, { kind: 'ready', ready: true });
    await bob.command(code, { kind: 'ready', ready: true });
    const started = viewOf(await alice.command(code, { kind: 'start' }));
    expect(started.game!.id).not.toBe(oldGameId);
    expect(started.game!.totals).toEqual({ you: 0, partner: 0 });
    expect(started.game!.roundIndex).toBe(0);
    expect(oldQuestions).not.toContain(started.game!.question.id);

    // rematch จากเกมเก่าไม่กระทบเกมใหม่
    const stale = await bob.command(code, {
      kind: 'rematch',
      gameId: oldGameId,
      roundIndex: 5,
      expectedPhase: 'RESULTS',
    });
    expect(ack(stale).code).toBe('WRONG_PHASE');
    expect((await bob.readView(roomId))!.game!.id).toBe(started.game!.id);
  }, 60_000);

  it('ออกจากห้องปิดห้องให้ทั้งคู่ และห้องที่ปิดแล้วเข้าไม่ได้', async () => {
    const left = await bob.command(code, { kind: 'leave' });
    expect(ack(left).ok).toBe(true);
    const va = await waitFor(async () => {
      const v = await alice.readView(roomId);
      return v?.status === 'CLOSED' ? v : null;
    }, 'อลิซเห็นว่าห้องปิด');
    expect(va.status).toBe('CLOSED');
    expect(ack(await alice.command(code, { kind: 'ready', ready: true })).code).toBe('ROOM_CLOSED');
    expect(ack(await carol.join(code)).code).toBe('ROOM_CLOSED');
  }, 60_000);
});
