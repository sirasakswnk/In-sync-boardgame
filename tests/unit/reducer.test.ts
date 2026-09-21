import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { joinRoom, ROOM_TTL_MS, type Command } from '@/lib/game';
import { A, B, C, IDENTITY, REVERSED, Table, expectError, expectOk } from './helpers';

describe('lobby', () => {
  it('เริ่มเกมได้เมื่อมีสองคน พร้อมทั้งคู่ และ host เป็นคนกด', () => {
    const t = new Table();
    expectError(t.cmd(A, { kind: 'start' }), 'NOT_READY');
    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    expectError(t.cmd(A, { kind: 'start' }), 'NOT_READY');
    expectOk(t.cmd(B, { kind: 'ready', ready: true }));
    expectError(t.cmd(B, { kind: 'start' }), 'NOT_HOST');
    expectOk(t.cmd(A, { kind: 'start' }));
    expect(t.game.phase).toBe('SELF_RANK');
    expect(t.game.roundIndex).toBe(0);
    expect(t.game.rounds).toHaveLength(6);
    expect(new Set(t.game.rounds.map((r) => r.question.id)).size).toBe(6);
  });

  it('เปลี่ยนหมวดแล้วรีเซ็ตความพร้อมของทั้งคู่ และเฉพาะ host เปลี่ยนได้', () => {
    const t = new Table();
    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    expectOk(t.cmd(B, { kind: 'ready', ready: true }));
    expectError(t.cmd(B, { kind: 'settings', categories: ['food'] }), 'NOT_HOST');
    expectOk(t.cmd(A, { kind: 'settings', categories: ['food', 'gaming'] }));
    expect(t.room.members[A]!.lobbyReady).toBe(false);
    expect(t.room.members[B]!.lobbyReady).toBe(false);
    expect(t.room.settings.categories).toEqual(['food', 'gaming']);
  });

  it('หมวดที่เลือกมีคำถามไม่ถึง 6 ข้อ เริ่มไม่ได้', () => {
    const t = new Table();
    expectOk(t.cmd(A, { kind: 'settings', categories: ['food'] }));
    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    expectOk(t.cmd(B, { kind: 'ready', ready: true }));
    expectError(t.cmd(A, { kind: 'start' }), 'NOT_ENOUGH_QUESTIONS');
    expect(t.room.game).toBeNull();
  });

  it('คู่หู offline เริ่มไม่ได้ แต่ ready/settings ยังทำได้ (plan.md §11)', () => {
    const t = new Table();
    t.online.delete(B);
    expectOk(t.cmd(A, { kind: 'settings', categories: ['daily', 'food'] }));
    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    t.online.add(B);
    expectOk(t.cmd(B, { kind: 'ready', ready: true }));
    t.online.delete(B);
    expectError(t.cmd(A, { kind: 'start' }), 'PARTNER_OFFLINE');
  });

  it('ตั้ง ready เป็นค่าเดิมไม่เพิ่ม revision', () => {
    const t = new Table();
    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    const rev = t.room.revision;
    const ack = t.cmd(A, { kind: 'ready', ready: true });
    expectOk(ack);
    expect(t.room.revision).toBe(rev);
  });
});

describe('join (plan.md §10.2)', () => {
  it('คนที่สามเข้าไม่ได้ สมาชิกเดิมได้ที่นั่งเดิมไม่กินที่ใหม่', () => {
    const t = new Table();
    const third = joinRoom(t.room, { uid: C, displayName: 'แครอล', avatarId: 'fox' }, t.now);
    expect(third).toEqual({ ok: false, code: 'ROOM_FULL' });

    const again = joinRoom(t.room, { uid: B, displayName: 'บ็อบ', avatarId: 'dog' }, t.now);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.seat).toBe(1);
      expect(Object.keys(again.room.members)).toHaveLength(2);
    }
  });

  it('ห้องที่ปิดแล้วเข้าไม่ได้', () => {
    const t = new Table();
    expectOk(t.cmd(A, { kind: 'leave' }));
    expect(joinRoom(t.room, { uid: B, displayName: 'บ็อบ', avatarId: 'dog' }, t.now)).toEqual({
      ok: false,
      code: 'ROOM_CLOSED',
    });
  });
});

describe('round flow', () => {
  it('ส่งคนเดียวไม่เลื่อน phase; คนที่สองส่งแล้วเลื่อนครั้งเดียว (§13 ข้อ 6)', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();

    expectOk(t.scoped(A, 'self', ids));
    expect(t.game.phase).toBe('SELF_RANK');
    expectOk(t.scoped(B, 'self', [...ids].reverse()));
    expect(t.game.phase).toBe('GUESS_RANK');
    expect(t.game.roundIndex).toBe(0);

    expectOk(t.scoped(A, 'guess', ids));
    expect(t.game.phase).toBe('GUESS_RANK');
    expect(t.round.results).toBeNull();
    expectOk(t.scoped(B, 'guess', ids));
    expect(t.game.phase).toBe('REVEAL');
    expect(t.round.results).not.toBeNull();
  });

  it('ส่งซ้ำด้วย commandId ใหม่ได้ ALREADY_SUBMITTED และคำตอบเดิมไม่ถูกแก้', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    expectOk(t.scoped(A, 'self', ids));
    expectError(t.scoped(A, 'self', [...ids].reverse()), 'ALREADY_SUBMITTED');
    expect(t.round.self[A]).toEqual(ids);
  });

  it('ปฏิเสธ ranking ที่ไม่ใช่ permutation ของรอบนั้น', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    const other = t.game.rounds[1]!.question.options.map((o) => o.id);
    expectError(t.scoped(A, 'self', [ids[0]!, ids[0]!, ids[2]!, ids[3]!, ids[4]!]), 'INVALID_RANKING');
    expectError(t.scoped(A, 'self', other), 'INVALID_RANKING');
    expectError(t.scoped(A, 'self', ids.slice(0, 4)), 'INVALID_RANKING');
    expect(t.round.self[A]).toBeUndefined();
  });

  it('ส่งคำทายผิด phase ถูก reject', () => {
    const t = new Table();
    t.startGame();
    const g = t.game;
    const ack = t.cmd(A, {
      kind: 'guess',
      optionIds: t.optionIds(),
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'GUESS_RANK',
    });
    expectError(ack, 'WRONG_PHASE');
  });

  it('คู่หู offline ส่งคำตอบไม่ได้; กลับมาแล้วส่งต่อได้ (§11)', () => {
    const t = new Table();
    t.startGame();
    t.online.delete(B);
    expectError(t.scoped(A, 'self', t.optionIds()), 'PARTNER_OFFLINE');
    t.online.add(B);
    expectOk(t.scoped(A, 'self', t.optionIds()));
  });

  it('ส่งพร้อมกันจาก revision เดียวกันสำเร็จทั้งคู่ ไม่ reject เพราะ revision (§13 ข้อ 8)', () => {
    const t = new Table();
    t.startGame();
    const g = t.game;
    const ids = t.optionIds();
    const make = (): Command => ({
      commandId: randomUUID(),
      kind: 'self',
      optionIds: ids,
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'SELF_RANK',
    });
    const cmdA = make();
    const cmdB = make();
    // ทั้งสองสร้างจาก state เดียวกัน แล้วถูก apply ต่อกันตามลำดับที่ transaction ตัดสิน
    expectOk(t.send(A, cmdA));
    expectOk(t.send(B, cmdB));
    expect(t.game.phase).toBe('GUESS_RANK');
  });

  it('คำทายเริ่มจากลำดับสุ่มแยก ไม่ prefill จากคำตอบตัวเอง และ refresh ไม่สุ่มใหม่', () => {
    const t = new Table();
    t.startGame();
    const layoutsBefore = structuredClone(t.round.layouts);
    const ids = t.optionIds();
    expectOk(t.scoped(A, 'self', [...ids].reverse()));
    expectOk(t.scoped(B, 'self', ids));
    // layout ของช่วงทายถูกกำหนดตั้งแต่เริ่มเกม ไม่เปลี่ยนตามคำตอบที่ส่ง
    expect(t.round.layouts).toEqual(layoutsBefore);
    for (const uid of [A, B]) {
      expect([...t.round.layouts[uid]!.self].sort()).toEqual([...ids].sort());
      expect([...t.round.layouts[uid]!.guess].sort()).toEqual([...ids].sort());
    }
  });
});

describe('scoring direction (§13 ข้อ 3)', () => {
  it('คะแนน A มาจากคำทายของ A เทียบคำตอบจริงของ B และกลับกัน', () => {
    const t = new Table();
    t.startGame();
    // A ชอบ I, B ชอบ R; A ทาย B ถูกทั้งหมด (R), B ทาย A แบบกลับด้าน (R) → 2
    t.playRound({ aSelf: IDENTITY, bSelf: REVERSED, aGuess: REVERSED, bGuess: REVERSED });
    expect(t.round.results![A]!.score).toBe(10);
    expect(t.round.results![B]!.score).toBe(2);
    expect(t.game.totals).toEqual({ [A]: 10, [B]: 2 });
  });
});

describe('idempotency (§10.4, §13 ข้อ 9)', () => {
  it('retry commandId เดิมหลัง phase เปลี่ยนแล้ว ได้ ack เดิม คะแนนไม่บวกซ้ำ', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    const g = t.game;
    expectOk(t.scoped(A, 'self', ids));
    expectOk(t.scoped(B, 'self', ids));

    const guessA: Command = {
      commandId: randomUUID(),
      kind: 'guess',
      optionIds: ids,
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'GUESS_RANK',
    };
    const first = t.send(A, guessA);
    expectOk(first);
    expectOk(t.scoped(B, 'guess', ids));
    expect(t.game.phase).toBe('REVEAL');
    const totals = structuredClone(t.game.totals);
    const revision = t.room.revision;

    // เน็ตกระตุก client ส่งซ้ำ — ตอนนี้ server อยู่ REVEAL แล้ว
    const retry = t.send(A, guessA);
    expect(retry).toEqual(first);
    expect(t.game.totals).toEqual(totals);
    expect(t.room.revision).toBe(revision);
  });

  it('commandId เดิมแต่ payload ต่าง ถูก reject ไม่เขียนทับ', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    const g = t.game;
    const cmd: Command = {
      commandId: randomUUID(),
      kind: 'self',
      optionIds: ids,
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'SELF_RANK',
    };
    expectOk(t.send(A, cmd));
    expectError(t.send(A, { ...cmd, optionIds: [...ids].reverse() }), 'COMMAND_CONFLICT');
    expect(t.round.self[A]).toEqual(ids);
  });

  it('คำสั่งที่ล้มเหลวไม่ถูกบันทึก receipt จึง retry ได้เมื่อเงื่อนไขพร้อม', () => {
    const t = new Table();
    t.startGame();
    const g = t.game;
    const cmd: Command = {
      commandId: randomUUID(),
      kind: 'self',
      optionIds: t.optionIds(),
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'SELF_RANK',
    };
    t.online.delete(B);
    expectError(t.send(A, cmd), 'PARTNER_OFFLINE');
    t.online.add(B);
    expectOk(t.send(A, cmd));
  });
});

describe('stale commands (§13 ข้อ 13)', () => {
  it('continue จากรอบเก่าไม่ทำให้ข้ามรอบ', () => {
    const t = new Table();
    t.startGame();
    t.playRound({ aSelf: IDENTITY, bSelf: IDENTITY, aGuess: IDENTITY, bGuess: IDENTITY });
    const g = t.game;
    t.continueBoth();
    expect(t.game.roundIndex).toBe(1);
    expect(t.game.phase).toBe('SELF_RANK');

    const stale = t.cmd(A, { kind: 'continue', gameId: g.id, roundIndex: 0, expectedPhase: 'REVEAL' });
    expectError(stale, 'WRONG_PHASE');
    expect(t.game.roundIndex).toBe(1);
  });

  it('rematch จากเกมเก่าไม่รีเซ็ตเกมใหม่', () => {
    const t = new Table();
    t.startGame();
    for (let i = 0; i < 6; i++) {
      t.playRound({ aSelf: IDENTITY, bSelf: IDENTITY, aGuess: IDENTITY, bGuess: IDENTITY });
      t.continueBoth();
    }
    const oldGameId = t.game.id;
    expectOk(t.scoped(A, 'rematch'));
    expectOk(t.scoped(B, 'rematch'));
    t.startGame();
    const newGameId = t.game.id;
    expect(newGameId).not.toBe(oldGameId);

    const stale = t.cmd(B, { kind: 'rematch', gameId: oldGameId, roundIndex: 5, expectedPhase: 'RESULTS' });
    expectError(stale, 'WRONG_PHASE');
    expect(t.game.id).toBe(newGameId);
    expect(t.game.phase).toBe('SELF_RANK');
  });
});

describe('full game (§13 ข้อ 15, 16)', () => {
  const plan = [
    { aSelf: IDENTITY, bSelf: IDENTITY, aGuess: IDENTITY, bGuess: [2, 1, 0, 3, 4] }, // A10 B6
    { aSelf: IDENTITY, bSelf: REVERSED, aGuess: REVERSED, bGuess: REVERSED }, // A10 B2
    { aSelf: REVERSED, bSelf: IDENTITY, aGuess: [1, 0, 2, 3, 4], bGuess: REVERSED }, // A8 B10
    { aSelf: IDENTITY, bSelf: IDENTITY, aGuess: REVERSED, bGuess: IDENTITY }, // A2 B10
    { aSelf: IDENTITY, bSelf: IDENTITY, aGuess: [2, 1, 0, 3, 4], bGuess: [1, 0, 2, 3, 4] }, // A6 B8
    { aSelf: IDENTITY, bSelf: IDENTITY, aGuess: [0, 1, 2, 4, 3], bGuess: REVERSED }, // A8 B2
  ];
  const expectedA = [10, 10, 8, 2, 6, 8];
  const expectedB = [6, 2, 10, 10, 8, 2];

  it('เล่นครบ 6 รอบ คะแนนรายรอบและรวมตรงกับค่าที่คำนวณล่วงหน้า', () => {
    const t = new Table();
    t.startGame();
    plan.forEach((round, i) => {
      expect(t.game.roundIndex).toBe(i);
      t.playRound(round);
      expect(t.round.results![A]!.score).toBe(expectedA[i]);
      expect(t.round.results![B]!.score).toBe(expectedB[i]);
      // รอทั้งคู่กดไปต่อ
      expectOk(t.scoped(A, 'continue'));
      expect(t.game.phase).toBe('REVEAL');
      expectOk(t.scoped(B, 'continue'));
    });
    expect(t.game.phase).toBe('RESULTS');
    expect(t.game.finishedAt).not.toBeNull();
    expect(t.game.totals).toEqual({ [A]: 44, [B]: 38 });
  });

  it('คะแนนเท่ากันเป็นเสมอ; rematch ต้องยืนยันสองคนและเกมใหม่เริ่มศูนย์', () => {
    const t = new Table();
    t.startGame();
    for (let i = 0; i < 6; i++) {
      t.playRound({ aSelf: IDENTITY, bSelf: REVERSED, aGuess: REVERSED, bGuess: IDENTITY });
      t.continueBoth();
    }
    expect(t.game.totals[A]).toBe(60);
    expect(t.game.totals[B]).toBe(60);

    const firstQuestions = t.game.rounds.map((r) => r.question.id);
    expectOk(t.scoped(A, 'rematch'));
    expect(t.game.phase).toBe('RESULTS');
    expectOk(t.scoped(B, 'rematch'));
    expect(t.room.game).toBeNull();
    expect(t.room.members[A]!.lobbyReady).toBe(false);
    expect(t.room.members[B]!.lobbyReady).toBe(false);

    t.startGame();
    expect(t.game.totals).toEqual({ [A]: 0, [B]: 0 });
    expect(t.game.roundIndex).toBe(0);
    // เลี่ยงคำถามจากเกมที่เพิ่งจบ (คลังค่าตั้งต้นมี 25 ข้อ พอ)
    const overlap = t.game.rounds.filter((r) => firstQuestions.includes(r.question.id));
    expect(overlap).toHaveLength(0);
  });
});

describe('membership, leave, expiry (§13 ข้อ 12, 18)', () => {
  it('ผู้ที่ไม่ใช่สมาชิกส่งคำสั่งไม่ได้ ผู้กระทำมาจาก ctx.uid ไม่ใช่ body', () => {
    const t = new Table();
    expectError(t.cmd(C, { kind: 'ready', ready: true }), 'UNAUTHORIZED');
    expectError(t.cmd(C, { kind: 'leave' }), 'UNAUTHORIZED');
    expect(t.room.status).toBe('OPEN');
  });

  it('ออกจากห้องแล้วปิดทั้งห้อง คำสั่งใหม่ถูก reject แต่ retry leave เดิมได้ ack เดิม', () => {
    const t = new Table();
    const leave: Command = { commandId: randomUUID(), kind: 'leave' };
    const first = t.send(B, leave);
    expectOk(first);
    expect(t.room.status).toBe('CLOSED');
    expectError(t.cmd(A, { kind: 'ready', ready: true }), 'ROOM_CLOSED');
    expect(t.send(B, leave)).toEqual(first);
  });

  it('ห้องหมดอายุหลังไม่มี activity 24 ชม.; คำสั่งที่สำเร็จต่ออายุห้อง', () => {
    const t = new Table();
    t.now += ROOM_TTL_MS - 1000;
    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    expect(t.room.expiresAt).toBe(t.now + ROOM_TTL_MS);

    t.now += ROOM_TTL_MS;
    expectError(t.cmd(A, { kind: 'ready', ready: false }), 'ROOM_CLOSED');
  });
});
