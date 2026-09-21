import { ROUNDS_PER_GAME } from './constants';
import { currentPhase, memberUids, partnerOf } from './phases';
import { sameTopPick } from './scoring';
import type {
  MemberState,
  Pair,
  PlayerGameView,
  PlayerView,
  PublicMember,
  RevealRound,
  RoomState,
  RoundState,
  ScoreResult,
  Uid,
} from './types';

/**
 * projectRoomForPlayer — สร้างมุมมองของผู้เล่นหนึ่งคนแบบ allowlist (plan.md §9.3)
 *
 * ทุก field ใน object ที่คืนถูกเลือกใส่ทีละตัว ไม่มีการ spread state เต็มแล้วลบบาง field
 * คำตอบ/คำทาย/คะแนนของคู่หูในรอบปัจจุบันจะออกมาได้ทางเดียวคือ `revealRound`
 * ซึ่งเรียกเฉพาะรอบที่มี results แล้ว (results ถูกตั้งตอนเข้า REVEAL เท่านั้น)
 */
export function projectRoomForPlayer(room: RoomState, uid: Uid): PlayerView | null {
  const me = room.members[uid];
  if (!me) return null;
  const partnerUid = partnerOf(room, uid);
  const partner = partnerUid ? room.members[partnerUid] : undefined;

  return {
    revision: room.revision,
    roomId: room.id,
    code: room.code,
    status: room.status,
    expiresAt: room.expiresAt,
    isHost: room.hostUid === uid,
    hostUid: room.hostUid,
    settings: { categories: [...room.settings.categories] },
    phase: currentPhase(room),
    you: publicMember(me),
    partner: partner ? publicMember(partner) : null,
    game: projectGame(room, uid, partnerUid),
  };
}

/** มุมมองของสมาชิกทุกคน ใช้เขียนลง `views/$uid` ในทรานแซกชันเดียวกับ state */
export function buildViews(room: RoomState): Record<Uid, PlayerView> {
  const views: Record<Uid, PlayerView> = {};
  for (const uid of memberUids(room)) {
    const view = projectRoomForPlayer(room, uid);
    if (view) views[uid] = view;
  }
  return views;
}

function publicMember(m: MemberState): PublicMember {
  return {
    uid: m.uid,
    seat: m.seat,
    displayName: m.displayName,
    avatarId: m.avatarId,
    lobbyReady: m.lobbyReady,
  };
}

function projectGame(room: RoomState, uid: Uid, partnerUid: Uid | null): PlayerGameView | null {
  const game = room.game;
  if (!game) return null;
  const round = game.rounds[game.roundIndex];
  if (!round) return null;

  const stage = game.phase === 'GUESS_RANK' ? 'guess' : 'self';
  const revealedHere = game.phase === 'REVEAL' || game.phase === 'RESULTS';
  const p = partnerUid ?? '';

  const submitted: Pair<boolean> =
    game.phase === 'SELF_RANK'
      ? { you: Boolean(round.self[uid]), partner: Boolean(round.self[p]) }
      : game.phase === 'GUESS_RANK'
        ? { you: Boolean(round.guess[uid]), partner: Boolean(round.guess[p]) }
        : { you: true, partner: true };

  return {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    roundCount: ROUNDS_PER_GAME,
    question: structuredClone(round.question),
    layout: [...(round.layouts[uid]?.[stage] ?? round.question.options.map((o) => o.id))],
    yourSelf: round.self[uid] ? [...round.self[uid]] : null,
    yourGuess: round.guess[uid] ? [...round.guess[uid]] : null,
    submitted,
    continued: { you: Boolean(round.continued[uid]), partner: Boolean(round.continued[p]) },
    rematch: { you: Boolean(game.rematch[uid]), partner: Boolean(game.rematch[p]) },
    // totals บวกเฉพาะตอนเข้า REVEAL จึงมีแต่คะแนนรอบที่เฉลยแล้วเสมอ
    totals: { you: game.totals[uid] ?? 0, partner: game.totals[p] ?? 0 },
    reveal: revealedHere ? revealRound(round, uid, p) : null,
    history: game.rounds
      .filter((r) => r.index < game.roundIndex || (revealedHere && r.index === game.roundIndex))
      .map((r) => revealRound(r, uid, p))
      .filter((r): r is RevealRound => r !== null),
  };
}

function revealRound(round: RoundState, uid: Uid, partnerUid: Uid): RevealRound | null {
  const results = round.results;
  if (!results) return null;
  const yourSelf = round.self[uid];
  const partnerSelf = round.self[partnerUid];
  const yourGuess = round.guess[uid];
  const partnerGuess = round.guess[partnerUid];
  const yourScore = results[uid];
  const partnerScore = results[partnerUid];
  if (!yourSelf || !partnerSelf || !yourGuess || !partnerGuess || !yourScore || !partnerScore) {
    return null;
  }
  return {
    roundIndex: round.index,
    question: structuredClone(round.question),
    yourSelf: [...yourSelf],
    partnerSelf: [...partnerSelf],
    yourGuess: [...yourGuess],
    partnerGuess: [...partnerGuess],
    yourGuessScore: copyScore(yourScore),
    partnerGuessScore: copyScore(partnerScore),
    sameTopPick: sameTopPick(yourSelf, partnerSelf),
  };
}

function copyScore(s: ScoreResult): ScoreResult {
  return { score: s.score, breakdown: s.breakdown.map((e) => ({ ...e })) };
}
