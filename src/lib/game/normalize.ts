import type {
  GameState,
  PlayerGameView,
  PlayerView,
  Question,
  RevealRound,
  RoomState,
  RoundState,
  ScoreResult,
} from './types';

/**
 * Firebase RTDB ไม่เก็บ null, object ว่าง หรือ array ว่าง และอาจคืน array เป็น object ที่มี key เป็นเลข
 * ฟังก์ชันในไฟล์นี้คืนรูปร่างให้ตรง type ก่อนนำไปใช้ ไม่ใช่ validator ด้านความปลอดภัย
 * (ข้อมูลใน RTDB เขียนโดย server ผ่าน admin SDK เท่านั้น)
 */

type Loose = Record<string, unknown> | undefined | null;

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined && v !== null) as T[];
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (value as Record<string, T>)[k]!);
  }
  return [];
}

function asRecord<T>(value: unknown, map: (v: unknown) => T = (v) => v as T): Record<string, T> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(value)) out[k] = map(v);
  return out;
}

function normalizeQuestion(raw: unknown): Question {
  const q = raw as Question;
  return { ...q, options: asArray(q.options) };
}

function normalizeScore(raw: unknown): ScoreResult {
  const s = raw as ScoreResult;
  return { score: s.score, breakdown: asArray(s.breakdown) };
}

function normalizeRound(raw: unknown, seatUids: readonly string[]): RoundState {
  const r = raw as Loose & Partial<RoundState>;
  const index = Number(r?.index ?? 0);
  // ห้องที่เริ่มเกมก่อนเปลี่ยนเป็นผลัดเทิร์นไม่มี setter/guesser — เติมตามที่นั่งแบบเดียวกับ rolesFor
  const fallbackSetter = seatUids[index % 2] ?? '';
  const fallbackGuesser = seatUids[1 - (index % 2)] ?? '';
  return {
    index,
    question: normalizeQuestion(r?.question),
    setterUid: typeof r?.setterUid === 'string' ? r.setterUid : fallbackSetter,
    guesserUid: typeof r?.guesserUid === 'string' ? r.guesserUid : fallbackGuesser,
    layouts: asRecord(r?.layouts, (v) => {
      const l = (v ?? {}) as { self?: unknown; guess?: unknown };
      const out: { self?: string[]; guess?: string[] } = {};
      if (l.self) out.self = asArray<string>(l.self);
      if (l.guess) out.guess = asArray<string>(l.guess);
      return out;
    }),
    self: asRecord(r?.self, (v) => asArray<string>(v)),
    guess: asRecord(r?.guess, (v) => asArray<string>(v)),
    results: r?.results ? asRecord(r.results, normalizeScore) : null,
    continued: asRecord(r?.continued, Boolean),
  };
}

function normalizeGame(raw: unknown, seatUids: readonly string[]): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<GameState>;
  return {
    id: String(g.id),
    phase: g.phase!,
    roundIndex: Number(g.roundIndex ?? 0),
    rounds: asArray(g.rounds).map((round) => normalizeRound(round, seatUids)),
    totals: asRecord(g.totals, Number),
    rematch: asRecord(g.rematch, Boolean),
    createdAt: Number(g.createdAt ?? 0),
    finishedAt: g.finishedAt ?? null,
  };
}

export function normalizeRoomState(raw: unknown): RoomState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RoomState>;
  const members = asRecord(r.members) as RoomState['members'];
  const seatUids = Object.values(members)
    .sort((a, b) => a.seat - b.seat)
    .map((m) => m.uid);
  return {
    id: String(r.id),
    code: String(r.code),
    hostUid: String(r.hostUid),
    status: r.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    revision: Number(r.revision ?? 0),
    createdAt: Number(r.createdAt ?? 0),
    lastActivityAt: Number(r.lastActivityAt ?? 0),
    expiresAt: Number(r.expiresAt ?? 0),
    settings: { categories: asArray(r.settings?.categories) },
    members,
    game: normalizeGame(r.game, seatUids),
    previousQuestionIds: asArray(r.previousQuestionIds),
    receipts: asRecord(r.receipts, (v) => asRecord(v)) as RoomState['receipts'],
  };
}

// ---------------------------------------------------------------------------
// Client-side view
// ---------------------------------------------------------------------------

function normalizeReveal(raw: unknown): RevealRound {
  const r = raw as RevealRound;
  return {
    roundIndex: Number(r.roundIndex),
    question: normalizeQuestion(r.question),
    setter: r.setter === 'you' ? 'you' : 'partner',
    setterOrder: asArray(r.setterOrder),
    guessOrder: asArray(r.guessOrder),
    score: normalizeScore(r.score),
  };
}

function normalizeGameView(raw: unknown): PlayerGameView | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<PlayerGameView>;
  const pair = (p: unknown) => {
    const v = (p ?? {}) as { you?: unknown; partner?: unknown };
    return { you: Boolean(v.you), partner: Boolean(v.partner) };
  };
  const yourSelf = asArray<string>(g.yourSelf);
  const yourGuess = asArray<string>(g.yourGuess);
  return {
    id: String(g.id),
    phase: g.phase!,
    roundIndex: Number(g.roundIndex ?? 0),
    roundCount: Number(g.roundCount ?? 0),
    question: normalizeQuestion(g.question),
    role: g.role === 'setter' ? 'setter' : 'guesser',
    guesserUid: String(g.guesserUid ?? ''),
    liveKey: String(g.liveKey ?? ''),
    layout: asArray(g.layout),
    yourSelf: yourSelf.length ? yourSelf : null,
    yourGuess: yourGuess.length ? yourGuess : null,
    submitted: pair(g.submitted),
    continued: pair(g.continued),
    rematch: pair(g.rematch),
    totals: { you: Number(g.totals?.you ?? 0), partner: Number(g.totals?.partner ?? 0) },
    reveal: g.reveal ? normalizeReveal(g.reveal) : null,
    history: asArray(g.history).map(normalizeReveal),
  };
}

export function normalizePlayerView(raw: unknown): PlayerView | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Partial<PlayerView>;
  if (!v.you) return null;
  return {
    revision: Number(v.revision ?? 0),
    roomId: String(v.roomId),
    code: String(v.code),
    status: v.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    expiresAt: Number(v.expiresAt ?? 0),
    isHost: Boolean(v.isHost),
    hostUid: String(v.hostUid),
    settings: { categories: asArray(v.settings?.categories) },
    phase: v.phase ?? 'LOBBY',
    you: v.you,
    partner: v.partner ?? null,
    game: normalizeGameView(v.game),
  };
}
