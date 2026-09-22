'use client';

import { isValidRanking } from '@/lib/game';
import { slotsFromStrings, slotsToStrings } from '@/lib/ui/board';

/**
 * Draft ที่ยังไม่ส่ง เก็บใน sessionStorage แยกตาม ผู้เล่น/เกม/รอบ/ช่วง (plan.md §11)
 * - ไม่ส่งไป server และไม่มีทางถึงคู่หู
 * - ข้อมูลที่ server ยืนยันแล้วชนะ draft เสมอ: เรียก loadDraft เฉพาะตอนยังไม่ได้ส่ง
 */
const PREFIX = 'hs:draft:';

export function draftKey(uid: string, gameId: string, roundIndex: number, phase: string): string {
  return `${PREFIX}${uid}:${gameId}:${roundIndex}:${phase}`;
}

export function loadDraft(key: string, optionIds: readonly string[]): string[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidRanking(parsed, optionIds) ? parsed : null;
  } catch {
    return null;
  }
}

/** draft ของแท่นอันดับ (RankBoard) — วางไม่ครบได้ ช่องว่างเก็บเป็น "" */
export function loadSlots(key: string, optionIds: readonly string[]): (string | null)[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? slotsFromStrings(JSON.parse(raw), optionIds) : null;
  } catch {
    return null;
  }
}

export function saveSlots(key: string, slots: readonly (string | null)[]): void {
  saveDraft(key, slotsToStrings(slots));
}

export function saveDraft(key: string, order: readonly string[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(order));
  } catch {
    // storage เต็ม/ถูกปิด: draft เป็นแค่ความสะดวก ไม่กระทบการเล่น
  }
}

/** ล้าง draft ของผู้เล่นคนนี้ทั้งหมด ยกเว้น key ที่ยังใช้อยู่ */
export function clearDrafts(uid: string, keep?: string): void {
  try {
    const mine = `${PREFIX}${uid}:`;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(mine) && k !== keep) sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
