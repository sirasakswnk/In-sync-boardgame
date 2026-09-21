import type { ScoreEntry, ScoreResult } from './types';

/**
 * คะแนนต่อ option ID (plan.md §5)
 *   distance 0 → 2, distance 1 → 1, อื่น ๆ → 0
 *
 * `actual` คือคำตอบจริงของคนถูกทาย, `guess` คือคำทายของอีกคน
 * breakdown เรียงตามอันดับจริง (actualIndex) เพื่อให้ UI แสดงได้ตรง ๆ
 * สมมติว่า input ผ่าน validateRanking มาแล้ว
 */
export function pointsForDistance(distance: number): number {
  if (distance === 0) return 2;
  if (distance === 1) return 1;
  return 0;
}

export function scoreRanking(actual: readonly string[], guess: readonly string[]): ScoreResult {
  const guessIndex = new Map(guess.map((id, i) => [id, i]));
  const breakdown: ScoreEntry[] = actual.map((optionId, actualIndex) => {
    const guessedIndex = guessIndex.get(optionId);
    if (guessedIndex === undefined) {
      throw new Error('scoreRanking: guess ไม่ใช่ permutation ของ actual');
    }
    const distance = Math.abs(guessedIndex - actualIndex);
    return { optionId, guessedIndex, actualIndex, distance, points: pointsForDistance(distance) };
  });
  return { score: breakdown.reduce((sum, e) => sum + e.points, 0), breakdown };
}

/** ข้อมูลประกอบการคุย แยกจากคะแนนทายใจ */
export function sameTopPick(a: readonly string[], b: readonly string[]): boolean {
  return a.length > 0 && a[0] === b[0];
}
