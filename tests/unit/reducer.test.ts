import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { joinRoom, MAX_GAME_SCORE, ROOM_TTL_MS, unjoinRoom, type Command } from '@/lib/game';
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

  it('ถอนคนที่เพิ่งเข้าได้เฉพาะใน lobby และที่นั่งว่างให้คนอื่นเข้าต่อได้', () => {
    const t = new Table();
    const rev = t.room.revision;
    const next = unjoinRoom(t.room, B, t.now);
    expect(next).not.toBeNull();
    expect(next!.members[B]).toBeUndefined();
    expect(next!.revision).toBe(rev + 1);
    // ฟังก์ชันบริสุทธิ์: ห้องเดิมไม่ถูกแก้
    expect(t.room.members[B]).toBeDefined();

    const third = joinRoom(next!, { uid: C, displayName: 'แครอล', avatarId: 'fox' }, t.now);
    expect(third.ok).toBe(true);
  });

  it('ถอน host, คนนอกห้อง หรือถอนระหว่างเกมไม่ได้', () => {
    const t = new Table();
    expect(unjoinRoom(t.room, A, t.now)).toBeNull();
    expect(unjoinRoom(t.room, C, t.now)).toBeNull();

    expectOk(t.cmd(A, { kind: 'ready', ready: true }));
    expectOk(t.cmd(B, { kind: 'ready', ready: true }));
    expectOk(t.cmd(A, { kind: 'start' }));
    expect(unjoinRoom(t.room, B, t.now)).toBeNull();
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

describe('turns', () => {
  it('บทบาทสลับทุกรอบ: รอบแรก host วาง และแต่ละคนได้ทาย 3 รอบ', () => {
    const t = new Table();
    t.startGame();
    const setters = t.game.rounds.map((r) => r.setterUid);
    const guessers = t.game.rounds.map((r) => r.guesserUid);
    expect(setters).toEqual([A, B, A, B, A, B]);
    expect(guessers).toEqual([B, A, B, A, B, A]);
  });

  it('layout สุ่มเฉพาะของคนที่ต้องเรียง: คนวางมี self, คนทายมี guess', () => {
    const t = new Table();
    t.startGame();
    const ids = [...t.optionIds()].sort();
    expect([...t.round.layouts[A]!.self!].sort()).toEqual(ids);
    expect(t.round.layouts[A]!.guess).toBeUndefined();
    expect([...t.round.layouts[B]!.guess!].sort()).toEqual(ids);
    expect(t.round.layouts[B]!.self).toBeUndefined();
  });

  it('คนผิดบทบาทส่งไม่ได้ (NOT_YOUR_TURN) และไม่ถูกบันทึก', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    expectError(t.scoped(B, 'self', ids), 'NOT_YOUR_TURN');
    expect(t.round.self[B]).toBeUndefined();
    expectOk(t.scoped(A, 'self', ids));
    expectError(t.scoped(A, 'guess', ids), 'NOT_YOUR_TURN');
    expect(t.round.guess[A]).toBeUndefined();
    expectOk(t.scoped(B, 'guess', ids));
    expectError(t.scoped(B, 'continue'), 'NOT_YOUR_TURN');
    expect(t.game.phase).toBe('REVEAL');
  });
});

describe('round flow', () => {
  it('คนวางส่งแล้วไปช่วงทายทันที คนทายส่งแล้วเปิดเฉลยทันที', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();

    expectOk(t.scoped(A, 'self', ids));
    expect(t.game.phase).toBe('GUESS_RANK');
    expect(t.game.roundIndex).toBe(0);
    expect(t.round.results).toBeNull();

    expectOk(t.scoped(B, 'guess', ids));
    expect(t.game.phase).toBe('REVEAL');
    expect(Object.keys(t.round.results!)).toEqual([B]);
  });

  it('คนวางกดไปต่อครั้งเดียวก็ไปรอบถัดไป และบทบาทสลับ', () => {
    const t = new Table();
    t.startGame();
    t.playRound({ self: IDENTITY, guess: IDENTITY });
    expectOk(t.scoped(A, 'continue'));
    expect(t.game.roundIndex).toBe(1);
    expect(t.game.phase).toBe('SELF_RANK');
    expect(t.setter).toBe(B);
    expect(t.guesser).toBe(A);
  });

  it('ส่งซ้ำด้วย commandId ใหม่หลังส่งแล้วถูก reject และคำตอบเดิมไม่ถูกแก้', () => {
    const t = new Table();
    t.startGame();
    const ids = t.optionIds();
    const g = t.game;
    expectOk(t.scoped(A, 'self', ids));
    // ส่งครั้งเดียวก็เลื่อน phase แล้ว คำสั่งที่ยังอ้าง SELF_RANK จึงตกรอบ
    const again = t.cmd(A, {
      kind: 'self',
      optionIds: [...ids].reverse(),
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'SELF_RANK',
    });
    expectError(again, 'WRONG_PHASE');
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

  it('คำสั่งที่สร้างจาก revision เก่าแต่ยังอยู่ช่วงเดิม ไม่ถูก reject เพราะ revision (§13 ข้อ 8)', () => {
    const t = new Table();
    t.startGame();
    const g = t.game;
    const ids = t.optionIds();
    const cmd: Command = {
      commandId: randomUUID(),
      kind: 'self',
      optionIds: ids,
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'SELF_RANK',
    };
    // มีคำสั่งอื่นเปลี่ยน revision ระหว่างนั้น (คนทายถูกปฏิเสธก็ไม่เปลี่ยน state) — คำสั่งยังผ่าน
    expectError(t.scoped(B, 'self', ids), 'NOT_YOUR_TURN');
    expectOk(t.send(A, cmd));
    expect(t.game.phase).toBe('GUESS_RANK');
  });

  it('คำทายเริ่มจากลำดับสุ่ม ไม่ prefill จากคำตอบของคนวาง และ refresh ไม่สุ่มใหม่', () => {
    const t = new Table();
    t.startGame();
    const layoutsBefore = structuredClone(t.round.layouts);
    const ids = t.optionIds();
    expectOk(t.scoped(A, 'self', [...ids].reverse()));
    // layout ของช่วงทายถูกกำหนดตั้งแต่เริ่มเกม ไม่เปลี่ยนตามคำตอบที่ส่ง
    expect(t.round.layouts).toEqual(layoutsBefore);
    expect([...t.round.layouts[B]!.guess!].sort()).toEqual([...ids].sort());
  });
});

describe('scoring direction (§13 ข้อ 3)', () => {
  it('คะแนนเข้าคนทายเท่านั้น: คำทายของคนทายเทียบคำตอบจริงของคนวาง', () => {
    const t = new Table();
    t.startGame();
    // รอบ 1: A วาง I, B ทาย R → B ได้ 2, A ไม่ได้อะไร
    t.playRound({ self: IDENTITY, guess: REVERSED });
    expect(t.round.results![B]!.score).toBe(2);
    expect(t.round.results![A]).toBeUndefined();
    expect(t.game.totals).toEqual({ [A]: 0, [B]: 2 });
    t.advance();
    // รอบ 2: B วาง R, A ทาย R → A ได้ 10
    t.playRound({ self: REVERSED, guess: REVERSED });
    expect(t.round.results![A]!.score).toBe(10);
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

    const guessB: Command = {
      commandId: randomUUID(),
      kind: 'guess',
      optionIds: ids,
      gameId: g.id,
      roundIndex: 0,
      expectedPhase: 'GUESS_RANK',
    };
    const first = t.send(B, guessB);
    expectOk(first);
    expect(t.game.phase).toBe('REVEAL');
    const totals = structuredClone(t.game.totals);
    const revision = t.room.revision;

    // เน็ตกระตุก client ส่งซ้ำ — ตอนนี้ server อยู่ REVEAL แล้ว
    const retry = t.send(B, guessB);
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
    t.playRound({ self: IDENTITY, guess: IDENTITY });
    const g = t.game;
    t.advance();
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
      t.playRound({ self: IDENTITY, guess: IDENTITY });
      t.advance();
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
  // คนวางสลับ A, B, A, B, A, B → คนทาย B, A, B, A, B, A
  const plan = [
    { self: IDENTITY, guess: [2, 1, 0, 3, 4] }, // B6
    { self: REVERSED, guess: REVERSED }, // A10
    { self: IDENTITY, guess: REVERSED }, // B2
    { self: REVERSED, guess: [3, 4, 2, 1, 0] }, // A8
    { self: IDENTITY, guess: [1, 0, 2, 3, 4] }, // B8
    { self: IDENTITY, guess: [2, 1, 0, 3, 4] }, // A6
  ];
  const expected = [6, 10, 2, 8, 8, 6];

  it('เล่นครบ 6 รอบ คะแนนรายรอบเข้าคนทาย และรวมตรงกับค่าที่คำนวณล่วงหน้า', () => {
    const t = new Table();
    t.startGame();
    plan.forEach((round, i) => {
      expect(t.game.roundIndex).toBe(i);
      const guesser = t.guesser;
      t.playRound(round);
      expect(t.round.results![guesser]!.score).toBe(expected[i]);
      t.advance();
    });
    expect(t.game.phase).toBe('RESULTS');
    expect(t.game.finishedAt).not.toBeNull();
    expect(t.game.totals).toEqual({ [A]: 24, [B]: 16 });
  });

  it('คะแนนเต็มคนละ 30 เท่ากันเป็นเสมอ; rematch ต้องยืนยันสองคนและเกมใหม่เริ่มศูนย์', () => {
    const t = new Table();
    t.startGame();
    for (let i = 0; i < 6; i++) {
      t.playRound({ self: REVERSED, guess: REVERSED });
      t.advance();
    }
    expect(t.game.totals[A]).toBe(MAX_GAME_SCORE);
    expect(t.game.totals[B]).toBe(MAX_GAME_SCORE);
    expect(MAX_GAME_SCORE).toBe(30);

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
