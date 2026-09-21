import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  countQuestionsIn,
  createRng,
  DEFAULT_CATEGORIES,
  getQuestionBank,
  loadQuestionBank,
  OPTIONS_PER_ROUND,
  pickQuestions,
  ROUNDS_PER_GAME,
} from '@/lib/game';

const bank = getQuestionBank();

describe('question bank (plan.md §7)', () => {
  it('มี 30 ข้อ ID q01..q30 ไม่ซ้ำ', () => {
    expect(bank).toHaveLength(30);
    expect(bank.map((q) => q.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('ทุกข้อมี 5 ตัวเลือก ID q01-o1.. ไม่ซ้ำ และข้อความไม่ว่าง', () => {
    const allOptionIds = new Set<string>();
    for (const q of bank) {
      expect(q.options).toHaveLength(OPTIONS_PER_ROUND);
      expect(q.prompt.trim()).not.toBe('');
      expect(q.topLabel.trim()).not.toBe('');
      expect(q.bottomLabel.trim()).not.toBe('');
      expect(q.topLabel).not.toBe(q.bottomLabel);
      q.options.forEach((o, i) => {
        expect(o.id).toBe(`${q.id}-o${i + 1}`);
        expect(o.label.trim()).not.toBe('');
        allOptionIds.add(o.id);
      });
    }
    expect(allOptionIds.size).toBe(30 * OPTIONS_PER_ROUND);
  });

  it('ทุกหมวดมีคำถาม และค่าตั้งต้น (ไม่รวม relationships) มีอย่างน้อย 6 ข้อ', () => {
    for (const c of CATEGORIES) expect(countQuestionsIn(bank, [c])).toBeGreaterThan(0);
    expect(DEFAULT_CATEGORIES).not.toContain('relationships');
    expect(countQuestionsIn(bank, DEFAULT_CATEGORIES)).toBeGreaterThanOrEqual(ROUNDS_PER_GAME);
  });

  it('validator ล้มเมื่อข้อมูลผิด', () => {
    const broken = structuredClone(bank);
    broken[0]!.options[1]!.id = broken[0]!.options[0]!.id;
    expect(() => loadQuestionBank(broken)).toThrow();

    const fourOptions = structuredClone(bank);
    fourOptions[0]!.options.pop();
    expect(() => loadQuestionBank(fourOptions)).toThrow();

    const dupId = structuredClone(bank);
    dupId[1]!.id = dupId[0]!.id;
    expect(() => loadQuestionBank(dupId)).toThrow();
  });
});

describe('pickQuestions', () => {
  it('ได้ 6 ข้อไม่ซ้ำ จากหมวดที่เลือกเท่านั้น', () => {
    const picked = pickQuestions(bank, ['food', 'gaming'], [], createRng('s1'))!;
    expect(picked).toHaveLength(ROUNDS_PER_GAME);
    expect(new Set(picked.map((q) => q.id)).size).toBe(ROUNDS_PER_GAME);
    expect(picked.every((q) => q.category === 'food' || q.category === 'gaming')).toBe(true);
  });

  it('คืน null เมื่อหมวดที่เลือกมีไม่ถึง 6 ข้อ', () => {
    expect(pickQuestions(bank, ['food'], [], createRng('s1'))).toBeNull();
  });

  it('เลี่ยงคำถามจากเกมก่อนเมื่อคลังพอ', () => {
    const first = pickQuestions(bank, DEFAULT_CATEGORIES, [], createRng('s1'))!;
    const second = pickQuestions(bank, DEFAULT_CATEGORIES, first.map((q) => q.id), createRng('s2'))!;
    const overlap = second.filter((q) => first.some((f) => f.id === q.id));
    expect(overlap).toHaveLength(0);
  });

  it('คลังไม่พอให้เติมจากข้อเดิม แต่ยังไม่ซ้ำในเกมเดียว', () => {
    const cats = ['food', 'gaming'] as const; // 10 ข้อ
    const first = pickQuestions(bank, cats, [], createRng('s1'))!;
    const second = pickQuestions(bank, cats, first.map((q) => q.id), createRng('s2'))!;
    expect(second).toHaveLength(ROUNDS_PER_GAME);
    expect(new Set(second.map((q) => q.id)).size).toBe(ROUNDS_PER_GAME);
    // ข้อใหม่ 4 ข้อต้องถูกใช้ก่อนทั้งหมด
    const fresh = second.filter((q) => !first.some((f) => f.id === q.id));
    expect(fresh).toHaveLength(4);
  });

  it('seed เดียวกันได้ผลเดียวกัน (retry ของ transaction ต้องไม่สุ่มใหม่)', () => {
    const a = pickQuestions(bank, DEFAULT_CATEGORIES, [], createRng('same'))!.map((q) => q.id);
    const b = pickQuestions(bank, DEFAULT_CATEGORIES, [], createRng('same'))!.map((q) => q.id);
    expect(a).toEqual(b);
  });
});
