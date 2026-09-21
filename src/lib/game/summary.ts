import type { RevealRound } from './types';

export type Outcome = 'you' | 'partner' | 'tie';

export function outcomeOf(totals: { you: number; partner: number }): Outcome {
  if (totals.you === totals.partner) return 'tie';
  return totals.you > totals.partner ? 'you' : 'partner';
}

/** รอบที่ทายได้คะแนนสูงที่สุด ถ้าเท่ากันเลือกข้อแรกตามลำดับเกม (plan.md §4.5) */
export function bestRound(
  history: readonly RevealRound[],
  pick: (r: RevealRound) => number,
): RevealRound | null {
  let best: RevealRound | null = null;
  for (const r of [...history].sort((a, b) => a.roundIndex - b.roundIndex)) {
    if (!best || pick(r) > pick(best)) best = r;
  }
  return best;
}

/** จำนวนการ์ดที่ทายตรงเป๊ะตลอดเกมของคนที่ทายในรอบเหล่านั้น — ข้อมูลชวนคุย ไม่ใช่คะแนนเพิ่ม */
export function exactHits(history: readonly RevealRound[]): number {
  return history.reduce((n, r) => n + r.score.breakdown.filter((e) => e.distance === 0).length, 0);
}
