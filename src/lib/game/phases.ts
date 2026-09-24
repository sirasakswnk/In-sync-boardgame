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

/**
 * จำนวนรอบของเกมนี้ = จำนวนคำถามที่หยิบไว้ตอนเริ่มเกม (ปกติ 6, ชุดพิเศษเท่ากับจำนวนข้อในกอง)
 * เกมที่ไม่มีรายการรอบ (ข้อมูลเก่าผิดรูป) ถือว่าเป็นเกม 6 รอบแบบเดิม
 */
export function roundCountOf(game: Pick<GameState, 'rounds'>): number {
  return game.rounds.length || ROUNDS_PER_GAME;
}

/** REVEAL → SELF_RANK รอบถัดไป หรือ RESULTS เมื่อจบรอบสุดท้าย (plan.md §9.1) */
export function phaseAfterReveal(game: Pick<GameState, 'roundIndex' | 'rounds'>): 'SELF_RANK' | 'RESULTS' {
  return isLastRound(game) ? 'RESULTS' : 'SELF_RANK';
}

export function isLastRound(game: Pick<GameState, 'roundIndex' | 'rounds'>): boolean {
  return game.roundIndex >= roundCountOf(game) - 1;
}
