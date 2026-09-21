import { ERROR_MESSAGES, MAX_SEATS, ROOM_TTL_MS } from './constants';
import { bothTrue, currentPhase, isLastRound, memberUids, partnerOf, rolesFor } from './phases';
import { pickQuestions } from './questions';
import { createRng, shuffle } from './rng';
import { isValidRanking } from './schemas';
import { scoreRanking } from './scoring';
import type {
  Ack,
  AvatarId,
  Category,
  Command,
  ErrorCode,
  GameState,
  Phase,
  Question,
  RoomState,
  RoundState,
  Stage,
  Uid,
} from './types';

/**
 * ทุกอย่างที่ reducer ต้องรู้จากภายนอก ต้องคงที่ตลอดการ retry ของ RTDB transaction
 * (ห้ามใช้ Date.now / Math.random ภายใน reducer)
 */
export type ReducerCtx = {
  uid: Uid;
  now: number;
  onlineUids: readonly Uid[];
  bank: readonly Question[];
  seed: string;
  newGameId: string;
  payloadHash: string;
};

export type ReducerResult = { room: RoomState; ack: Ack; changed: boolean };

export type Profile = { displayName: string; avatarId: AvatarId };

// ---------------------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------------------

export function createRoomState(args: {
  roomId: string;
  code: string;
  host: Profile & { uid: Uid };
  categories: readonly Category[];
  now: number;
}): RoomState {
  const { roomId, code, host, categories, now } = args;
  return {
    id: roomId,
    code,
    hostUid: host.uid,
    status: 'OPEN',
    revision: 1,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + ROOM_TTL_MS,
    settings: { categories: [...categories] },
    members: {
      [host.uid]: {
        uid: host.uid,
        seat: 0,
        displayName: host.displayName,
        avatarId: host.avatarId,
        lobbyReady: false,
        joinedAt: now,
      },
    },
    game: null,
    previousQuestionIds: [],
    receipts: {},
  };
}

export function isExpired(room: RoomState, now: number): boolean {
  return now >= room.expiresAt;
}

export type JoinResult =
  | { ok: true; room: RoomState; seat: 0 | 1; changed: boolean }
  | { ok: false; code: ErrorCode };

/** เข้าห้อง: สมาชิกเดิมได้ที่นั่งเดิม, คนที่สามถูกปฏิเสธ */
export function joinRoom(room: RoomState, who: Profile & { uid: Uid }, now: number): JoinResult {
  if (room.status === 'CLOSED' || isExpired(room, now)) return { ok: false, code: 'ROOM_CLOSED' };

  const existing = room.members[who.uid];
  if (existing) {
    const inLobby = currentPhase(room) === 'LOBBY';
    const profileChanged =
      inLobby && (existing.displayName !== who.displayName || existing.avatarId !== who.avatarId);
    const next = structuredClone(room);
    if (profileChanged) {
      next.members[who.uid] = { ...existing, displayName: who.displayName, avatarId: who.avatarId };
      next.revision += 1;
    }
    touch(next, now);
    return { ok: true, room: next, seat: existing.seat, changed: profileChanged };
  }

  const taken = new Set(Object.values(room.members).map((m) => m.seat));
  if (taken.size >= MAX_SEATS) return { ok: false, code: 'ROOM_FULL' };
  const seat: 0 | 1 = taken.has(0) ? 1 : 0;

  const next = structuredClone(room);
  next.members[who.uid] = {
    uid: who.uid,
    seat,
    displayName: who.displayName,
    avatarId: who.avatarId,
    lobbyReady: false,
    joinedAt: now,
  };
  // มีคนใหม่เข้ามา ความพร้อมเดิมตั้งไว้ก่อนเห็นคู่หู — รีเซ็ตให้ยืนยันกันใหม่
  for (const m of Object.values(next.members)) m.lobbyReady = false;
  next.revision += 1;
  touch(next, now);
  return { ok: true, room: next, seat, changed: true };
}

function touch(room: RoomState, now: number): void {
  room.lastActivityAt = now;
  room.expiresAt = now + ROOM_TTL_MS;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

type HandlerOutcome = { error: ErrorCode } | { changed: boolean };
const ok = (changed = true): HandlerOutcome => ({ changed });
const err = (error: ErrorCode): HandlerOutcome => ({ error });

export function applyCommand(room: RoomState, cmd: Command, ctx: ReducerCtx): ReducerResult {
  const fail = (code: ErrorCode): ReducerResult => ({
    room,
    changed: false,
    ack: { ok: false, commandId: cmd.commandId, code, message: ERROR_MESSAGES[code] },
  });

  if (!room.members[ctx.uid]) return fail('UNAUTHORIZED');

  // ตรวจ receipt ก่อน phase เสมอ: retry หลัง server เลื่อน phase แล้วต้องได้ ack เดิม (plan.md §10.4)
  const receipt = room.receipts[ctx.uid]?.[cmd.commandId];
  if (receipt) {
    if (receipt.payloadHash !== ctx.payloadHash) return fail('COMMAND_CONFLICT');
    return { room, changed: false, ack: receipt.ack };
  }

  if (room.status === 'CLOSED' || isExpired(room, ctx.now)) return fail('ROOM_CLOSED');

  const draft = structuredClone(room);
  const outcome = dispatch(draft, cmd, ctx);
  if ('error' in outcome) return fail(outcome.error);

  // revision เพิ่มเฉพาะเมื่อ state ของเกมเปลี่ยนจริง (plan.md §10.4)
  if (outcome.changed) draft.revision += 1;
  touch(draft, ctx.now);

  const ack: Ack = { ok: true, commandId: cmd.commandId, revision: draft.revision };
  draft.receipts[ctx.uid] ??= {};
  draft.receipts[ctx.uid]![cmd.commandId] = { payloadHash: ctx.payloadHash, ack, at: ctx.now };
  return { room: draft, ack, changed: true };
}

function dispatch(room: RoomState, cmd: Command, ctx: ReducerCtx): HandlerOutcome {
  switch (cmd.kind) {
    case 'settings':
      return onSettings(room, ctx, cmd.categories);
    case 'ready':
      return onReady(room, ctx, cmd.ready);
    case 'start':
      return onStart(room, ctx);
    case 'self':
    case 'guess':
      return onSubmit(room, ctx, cmd);
    case 'continue':
      return onContinue(room, ctx, cmd);
    case 'rematch':
      return onRematch(room, ctx, cmd);
    case 'leave':
      room.status = 'CLOSED';
      return ok();
  }
}

function partnerOnline(room: RoomState, ctx: ReducerCtx): boolean {
  const partner = partnerOf(room, ctx.uid);
  return partner !== null && ctx.onlineUids.includes(partner);
}

function onSettings(room: RoomState, ctx: ReducerCtx, categories: Category[]): HandlerOutcome {
  if (currentPhase(room) !== 'LOBBY') return err('WRONG_PHASE');
  if (room.hostUid !== ctx.uid) return err('NOT_HOST');
  room.settings.categories = [...new Set(categories)];
  // เปลี่ยนหมวดแล้วต้องให้ทั้งคู่เห็นการตั้งค่าใหม่ก่อนเริ่ม (plan.md §4.1 ข้อ 6)
  for (const m of Object.values(room.members)) m.lobbyReady = false;
  return ok();
}

function onReady(room: RoomState, ctx: ReducerCtx, ready: boolean): HandlerOutcome {
  if (currentPhase(room) !== 'LOBBY') return err('WRONG_PHASE');
  const me = room.members[ctx.uid]!;
  if (me.lobbyReady === ready) return ok(false);
  me.lobbyReady = ready;
  return ok();
}

function onStart(room: RoomState, ctx: ReducerCtx): HandlerOutcome {
  if (currentPhase(room) !== 'LOBBY') return err('WRONG_PHASE');
  if (room.hostUid !== ctx.uid) return err('NOT_HOST');
  const uids = memberUids(room);
  if (uids.length !== MAX_SEATS) return err('NOT_READY');
  if (!uids.every((u) => room.members[u]!.lobbyReady)) return err('NOT_READY');
  if (!partnerOnline(room, ctx)) return err('PARTNER_OFFLINE');

  const questions = pickQuestions(
    ctx.bank,
    room.settings.categories,
    room.previousQuestionIds,
    createRng(`${ctx.seed}:questions`),
  );
  if (!questions) return err('NOT_ENOUGH_QUESTIONS');

  const gameId = ctx.newGameId;
  const rounds: RoundState[] = questions.map((question, index) => {
    const { setterUid, guesserUid } = rolesFor(uids, index);
    return {
      index,
      question: structuredClone(question),
      setterUid,
      guesserUid,
      layouts: {
        [setterUid]: { self: initialLayout(question, `${ctx.seed}:${gameId}:${index}:${setterUid}:self`) },
        [guesserUid]: { guess: initialLayout(question, `${ctx.seed}:${gameId}:${index}:${guesserUid}:guess`) },
      },
      self: {},
      guess: {},
      results: null,
      continued: {},
    };
  });

  room.game = {
    id: gameId,
    phase: 'SELF_RANK',
    roundIndex: 0,
    rounds,
    totals: Object.fromEntries(uids.map((u) => [u, 0])),
    rematch: {},
    createdAt: ctx.now,
    finishedAt: null,
  };
  for (const m of Object.values(room.members)) m.lobbyReady = false;
  return ok();
}

/** ลำดับตั้งต้นเป็นการสุ่ม ไม่ใช่คำตอบของใคร และไม่ prefill คำทายจากคำตอบตัวเอง (plan.md §4.2, §4.3) */
function initialLayout(question: Question, seed: string): string[] {
  return shuffle(
    question.options.map((o) => o.id),
    createRng(seed),
  );
}

type Scoped = Extract<Command, { gameId: string }>;

/** ตรวจว่า command ยังอ้างถึงเกม/รอบ/ช่วงปัจจุบัน — กันคำสั่งค้างจากรอบหรือเกมเก่า */
function checkScope(room: RoomState, cmd: Scoped, phase: Phase): GameState | null {
  const game = room.game;
  if (!game) return null;
  if (game.id !== cmd.gameId) return null;
  if (game.roundIndex !== cmd.roundIndex) return null;
  if (game.phase !== phase || cmd.expectedPhase !== phase) return null;
  return game;
}

function onSubmit(
  room: RoomState,
  ctx: ReducerCtx,
  cmd: Extract<Command, { kind: 'self' | 'guess' }>,
): HandlerOutcome {
  const stage: Stage = cmd.kind;
  const game = checkScope(room, cmd, stage === 'self' ? 'SELF_RANK' : 'GUESS_RANK');
  if (!game) return err('WRONG_PHASE');
  const round = game.rounds[game.roundIndex]!;
  // ผลัดเทิร์น: setter ส่ง self, guesser ส่ง guess — อีกคนรอ
  const actor = stage === 'self' ? round.setterUid : round.guesserUid;
  if (ctx.uid !== actor) return err('NOT_YOUR_TURN');
  const bucket = stage === 'self' ? round.self : round.guess;

  if (bucket[ctx.uid]) return err('ALREADY_SUBMITTED');
  const optionIds = round.question.options.map((o) => o.id);
  if (!isValidRanking(cmd.optionIds, optionIds)) return err('INVALID_RANKING');
  if (!partnerOnline(room, ctx)) return err('PARTNER_OFFLINE');

  bucket[ctx.uid] = [...cmd.optionIds];

  if (stage === 'self') {
    game.phase = 'GUESS_RANK';
    return ok();
  }

  // คำทายมาถึงแล้ว: คิดคะแนนและเปิดเฉลยในก้าวเดียว คะแนนเข้าคนทายเท่านั้น
  const guesser: Uid = round.guesserUid;
  const result = scoreRanking(round.self[round.setterUid]!, round.guess[guesser]!);
  round.results = { [guesser]: result };
  game.totals[guesser] = (game.totals[guesser] ?? 0) + result.score;
  game.phase = 'REVEAL';
  return ok();
}

function onContinue(
  room: RoomState,
  ctx: ReducerCtx,
  cmd: Extract<Command, { kind: 'continue' }>,
): HandlerOutcome {
  const game = checkScope(room, cmd, 'REVEAL');
  if (!game) return err('WRONG_PHASE');
  const round = game.rounds[game.roundIndex]!;
  // คนวางของรอบนี้เป็นคนพาไปต่อ — คนทายรอ
  if (ctx.uid !== round.setterUid) return err('NOT_YOUR_TURN');
  if (!partnerOnline(room, ctx)) return err('PARTNER_OFFLINE');

  round.continued[ctx.uid] = true;

  if (isLastRound(game.roundIndex)) {
    game.phase = 'RESULTS';
    game.finishedAt = ctx.now;
  } else {
    game.roundIndex += 1;
    game.phase = 'SELF_RANK';
  }
  return ok();
}

function onRematch(
  room: RoomState,
  ctx: ReducerCtx,
  cmd: Extract<Command, { kind: 'rematch' }>,
): HandlerOutcome {
  const game = checkScope(room, cmd, 'RESULTS');
  if (!game) return err('WRONG_PHASE');
  if (game.rematch[ctx.uid]) return ok(false);
  if (!partnerOnline(room, ctx)) return err('PARTNER_OFFLINE');

  game.rematch[ctx.uid] = true;
  if (!bothTrue(game.rematch, memberUids(room))) return ok();

  // ทั้งคู่ตกลงเล่นใหม่: กลับ lobby ในห้องเดิม เกมใหม่จะได้ game ID ใหม่ตอนกดเริ่ม
  room.previousQuestionIds = game.rounds.map((r) => r.question.id);
  room.game = null;
  for (const m of Object.values(room.members)) m.lobbyReady = false;
  return ok();
}
