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
// คนวางสลับ อลิซ, บ็อบ, … → คนทาย บ็อบ, อลิซ, …
const PLAN = [
  { self: I, guess: [2, 1, 0, 3, 4] }, // บ็อบ 6
  { self: R, guess: R }, // อลิซ 10
  { self: I, guess: R }, // บ็อบ 2
  { self: R, guess: [3, 4, 2, 1, 0] }, // อลิซ 8
  { self: I, guess: [1, 0, 2, 3, 4] }, // บ็อบ 8
  { self: I, guess: [2, 1, 0, 3, 4] }, // อลิซ 6
];
const EXPECTED = [6, 10, 2, 8, 8, 6];

function liveEntry(v: PlayerView, order: number[], key = v.game!.liveKey) {
  return { key, order: pick(v, order), at: Date.now() };
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

  it('เล่นครบ 6 รอบแบบผลัดเทิร์น: ความลับไม่รั่ว คำทายสดผ่าน rules และคะแนนตรงค่าที่คำนวณไว้', async () => {
    let previousKey = '';
    for (let round = 0; round < 6; round++) {
      const plan = PLAN[round]!;
      const setter = round % 2 === 0 ? alice : bob;
      const guesser = round % 2 === 0 ? bob : alice;
      const livePath = `live/${roomId}/${guesser.uid}`;

      let sv = (await setter.readView(roomId))!;
      let gv = (await guesser.readView(roomId))!;
      expect(sv.game!.roundIndex).toBe(round);
      expect(sv.phase).toBe('SELF_RANK');
      expect(sv.game!.role).toBe('setter');
      expect(gv.game!.role).toBe('guesser');

      // --- SELF_RANK: คนทายรอ — ส่งไม่ได้ และเขียนคำทายสดยังไม่ได้ ---
      expect(ack(await guesser.command(code, scopedBody(gv, 'self', pick(gv, I)))).code).toBe('NOT_YOUR_TURN');
      expect(await guesser.canWrite(livePath, liveEntry(gv, I))).toBe(false);

      const selfRes = await setter.command(code, scopedBody(sv, 'self', pick(sv, plan.self)));
      expect(ack(selfRes).ok).toBe(true);
      expect(viewOf(selfRes).phase).toBe('GUESS_RANK');

      // --- GUESS_RANK: คนทายไม่เห็นคำตอบของคนวางในรูปใดเลย ---
      gv = await waitFor(async () => {
        const v = await guesser.readView(roomId);
        return v?.phase === 'GUESS_RANK' ? v : null;
      }, 'คนทายเห็นว่าถึงตาทาย');
      expect(gv.game!.yourSelf).toBeNull();
      expect(gv.game!.reveal).toBeNull();
      const { history, ...currentRound } = gv.game!;
      expect(history.every((h) => h.roundIndex < round)).toBe(true);
      expect(JSON.stringify(currentRound)).not.toMatch(/setterOrder|guessOrder|breakdown/);
      expect(await guesser.canRead(`rooms/${roomId}/state`)).toBe(false);
      expect(await guesser.canRead(`rooms/${roomId}/turn`)).toBe(false);

      // --- คำทายสด: เฉพาะคนทาย เฉพาะรอบนี้ และคนวางอ่านได้ ---
      sv = (await setter.readView(roomId))!;
      expect(sv.game!.yourSelf).toEqual(pick(sv, plan.self));
      expect(await guesser.canWrite(livePath, liveEntry(gv, R))).toBe(true);
      expect(await setter.readValue(livePath)).toMatchObject({ key: gv.game!.liveKey, order: pick(gv, R) });
      expect(await setter.canWrite(livePath, liveEntry(gv, I))).toBe(false);
      expect(await setter.canWrite(`live/${roomId}/${setter.uid}`, liveEntry(gv, I))).toBe(false);
      expect(await carol.canRead(`live/${roomId}`)).toBe(false);
      expect(await guesser.canWrite(livePath, { ...liveEntry(gv, I), extra: 1 })).toBe(false);
      expect(await guesser.canWrite(livePath, { ...liveEntry(gv, I), order: pick(gv, I).slice(0, 4) })).toBe(false);
      if (previousKey) expect(await guesser.canWrite(livePath, liveEntry(gv, I, previousKey))).toBe(false);
      previousKey = gv.game!.liveKey;

      // คนวางทายไม่ได้
      expect(ack(await setter.command(code, scopedBody(sv, 'guess', pick(sv, I)))).code).toBe('NOT_YOUR_TURN');

      const guessRes = await guesser.command(code, scopedBody(gv, 'guess', pick(gv, plan.guess)));
      expect(ack(guessRes).ok).toBe(true);

      // --- REVEAL: ทั้งคู่เห็นเฉลยเดียวกัน คะแนนเข้าคนทาย ---
      gv = viewOf(guessRes);
      sv = await waitFor(async () => {
        const v = await setter.readView(roomId);
        return v?.phase === 'REVEAL' ? v : null;
      }, 'คนวางเห็นเฉลย');
      expect(gv.phase).toBe('REVEAL');
      expect(gv.game!.reveal!.setter).toBe('partner');
      expect(sv.game!.reveal!.setter).toBe('you');
      expect(gv.game!.reveal!.score.score).toBe(EXPECTED[round]);
      expect(sv.game!.reveal!.score).toEqual(gv.game!.reveal!.score);
      expect(gv.game!.reveal!.setterOrder).toEqual(pick(gv, plan.self));
      // ผ่านช่วงทายแล้ว server ลบคำทายสด และเขียนใหม่ไม่ได้
      await waitFor(async () => (await setter.readValue(`live/${roomId}`)) === null || null, 'ลบคำทายสด');
      expect(await guesser.canWrite(livePath, liveEntry(gv, I))).toBe(false);

      // --- ไปต่อ: คนวางกดคนเดียว คนทายกดไม่ได้ ---
      expect(ack(await guesser.command(code, scopedBody(gv, 'continue'))).code).toBe('NOT_YOUR_TURN');
      const cont = await setter.command(code, scopedBody(sv, 'continue'));
      expect(ack(cont).ok).toBe(true);
      expect(viewOf(cont).phase).toBe(round === 5 ? 'RESULTS' : 'SELF_RANK');
    }

    const finalA = (await alice.readView(roomId))!;
    const finalB = (await bob.readView(roomId))!;
    expect(finalA.phase).toBe('RESULTS');
    expect(finalA.game!.totals).toEqual({ you: 24, partner: 16 });
    expect(finalB.game!.totals).toEqual({ you: 16, partner: 24 });
    expect(finalA.game!.history.map((h) => h.roundIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  }, 240_000);

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
