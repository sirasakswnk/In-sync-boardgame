import { describe, expect, it } from 'vitest';
import { MAX_ROUND_SCORE, pointsForDistance, sameTopPick, scoreRanking } from '@/lib/game';

const actual = ['a', 'b', 'c', 'd', 'e'];

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]),
  );
}

describe('scoreRanking (plan.md §5)', () => {
  it('ทายตรงทั้งหมดได้ 10', () => {
    expect(scoreRanking(actual, actual).score).toBe(10);
  });

  it('ตัวอย่าง [c,b,a,d,e] ได้ 0+2+0+2+2 = 6', () => {
    const r = scoreRanking(actual, ['c', 'b', 'a', 'd', 'e']);
    expect(r.score).toBe(6);
    expect(r.breakdown.map((e) => e.points)).toEqual([0, 2, 0, 2, 2]);
  });

  it('สลับคู่ติดกันหนึ่งคู่ [b,a,c,d,e] ได้ 1+1+2+2+2 = 8', () => {
    const r = scoreRanking(actual, ['b', 'a', 'c', 'd', 'e']);
    expect(r.score).toBe(8);
    expect(r.breakdown.map((e) => e.points)).toEqual([1, 1, 2, 2, 2]);
  });

  it('กลับด้าน [e,d,c,b,a] ได้ 2 ไม่ใช่ 0 เพราะ c ยังอยู่ตรงกลาง', () => {
    const r = scoreRanking(actual, ['e', 'd', 'c', 'b', 'a']);
    expect(r.score).toBe(2);
    expect(r.breakdown.find((e) => e.optionId === 'c')).toMatchObject({ distance: 0, points: 2 });
  });

  it('breakdown บอกตำแหน่งทาย/จริงรายการ์ด เรียงตามอันดับจริง', () => {
    const r = scoreRanking(actual, ['b', 'c', 'a', 'd', 'e']);
    expect(r.breakdown[0]).toEqual({ optionId: 'a', guessedIndex: 2, actualIndex: 0, distance: 2, points: 0 });
    expect(r.breakdown[1]).toEqual({ optionId: 'b', guessedIndex: 0, actualIndex: 1, distance: 1, points: 1 });
    expect(r.breakdown.map((e) => e.actualIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('ทุก permutation (120 แบบ) ได้คะแนนใน 0..10 และเท่ากับผลรวม breakdown', () => {
    const all = permutations(actual);
    expect(all).toHaveLength(120);
    const seen = new Set<number>();
    for (const guess of all) {
      const r = scoreRanking(actual, guess);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(MAX_ROUND_SCORE);
      expect(r.score).toBe(r.breakdown.reduce((s, e) => s + e.points, 0));
      seen.add(r.score);
    }
    // 9 เป็นไปไม่ได้: ถ้าผิดตำแหน่ง ต้องผิดอย่างน้อยสองการ์ด
    expect(seen.has(9)).toBe(false);
    expect(seen.has(10)).toBe(true);
  });

  it('ไม่ใช่การนับคู่ที่ชอบตรงกัน: คะแนนขึ้นกับระยะห่าง ไม่ใช่จำนวนตำแหน่งที่ตรง', () => {
    // ตรงตำแหน่งแค่ e ตัวเดียว แต่ตัวที่ขยับห่างแค่ 1 จึงยังได้ 1 คะแนนต่อการ์ด
    expect(scoreRanking(actual, ['b', 'a', 'd', 'c', 'e']).score).toBe(1 + 1 + 1 + 1 + 2);
  });

  it('ทิศทางสำคัญ: score(A) = guess(A) เทียบ selfRank(B) ไม่สมมาตรโดยทั่วไป', () => {
    const selfB = ['a', 'b', 'c', 'd', 'e'];
    const guessA = ['c', 'b', 'a', 'd', 'e'];
    const selfA = ['e', 'd', 'c', 'b', 'a'];
    const guessB = ['e', 'd', 'c', 'b', 'a'];
    expect(scoreRanking(selfB, guessA).score).toBe(6);
    expect(scoreRanking(selfA, guessB).score).toBe(10);
    // ถ้าสลับทิศผิด คะแนนจะไม่ตรง
    expect(scoreRanking(selfA, guessA).score).not.toBe(6);
  });

  it('โยน error เมื่อ guess ไม่ใช่ permutation (ต้องผ่าน validator ก่อนเสมอ)', () => {
    expect(() => scoreRanking(actual, ['a', 'a', 'c', 'd', 'e'])).toThrow();
  });
});

describe('pointsForDistance', () => {
  it.each([
    [0, 2],
    [1, 1],
    [2, 0],
    [4, 0],
  ])('distance %i → %i คะแนน', (d, p) => {
    expect(pointsForDistance(d)).toBe(p);
  });
});

describe('sameTopPick', () => {
  it('เทียบเฉพาะอันดับหนึ่ง', () => {
    expect(sameTopPick(['a', 'b'], ['a', 'c'])).toBe(true);
    expect(sameTopPick(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
