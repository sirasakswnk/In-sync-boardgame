import { ROUNDS_PER_GAME } from './constants';
import type { GameState, Phase, RoomState, Uid } from './types';

export function currentPhase(room: RoomState): Phase {
  return room.game?.phase ?? 'LOBBY';
}

export function memberUids(room: RoomState): Uid[] {
  return Object.values(room.members)
    .sort((a, b) => a.seat - b.seat)
    .map((m) => m.uid);
}

export function partnerOf(room: RoomState, uid: Uid): Uid | null {
  return memberUids(room).find((u) => u !== uid) ?? null;
}

/** บทบาทของรอบ: ที่นั่ง `roundIndex % 2` เป็นคนวาง อีกคนเป็นคนทาย — รอบแรก host (ที่นั่ง 0) วาง */
export function rolesFor(uids: readonly Uid[], roundIndex: number): { setterUid: Uid; guesserUid: Uid } {
  const setter = roundIndex % 2;
  return { setterUid: uids[setter]!, guesserUid: uids[1 - setter]! };
}

export function bothTrue(record: Record<Uid, boolean | unknown> | undefined, uids: readonly Uid[]): boolean {
  return uids.length === 2 && uids.every((u) => Boolean(record?.[u]));
}

/** REVEAL → SELF_RANK รอบถัดไป หรือ RESULTS เมื่อจบรอบสุดท้าย (plan.md §9.1) */
export function phaseAfterReveal(game: Pick<GameState, 'roundIndex'>): 'SELF_RANK' | 'RESULTS' {
  return game.roundIndex >= ROUNDS_PER_GAME - 1 ? 'RESULTS' : 'SELF_RANK';
}

export function isLastRound(roundIndex: number): boolean {
  return roundIndex >= ROUNDS_PER_GAME - 1;
}
