import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  countQuestionsIn,
  createRng,
  DEFAULT_CATEGORIES,
  getQuestionBank,
  ICON_PATH,
  loadQuestionBank,
  OPTIONS_PER_ROUND,
  pickQuestions,
  promptFor,
  ROUNDS_PER_GAME,
  roundsFor,
  SPECIAL_CATEGORY,
} from '@/lib/game';

const bank = getQuestionBank();

describe('question bank (plan.md §7)', () => {
  // ไม่ล็อกจำนวนข้อ: เพิ่ม/ลดคำถามได้ ขอแค่ ID เรียงต่อกัน q01, q02, … ไม่ข้าม ไม่ซ้ำ
  it('ID เรียงต่อกัน q01..qN ไม่ซ้ำ', () => {
    expect(bank.length).toBeGreaterThanOrEqual(30);
    expect(bank.map((q) => q.id)).toEqual(
      Array.from({ length: bank.length }, (_, i) => `q${String(i + 1).padStart(2, '0')}`),
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
    expect(allOptionIds.size).toBe(bank.length * OPTIONS_PER_ROUND);
  });

  it('ทุกหมวดมีคำถาม และค่าตั้งต้น (ไม่รวม relationships และชุดพิเศษ) มีอย่างน้อย 6 ข้อ', () => {
    for (const c of CATEGORIES) expect(countQuestionsIn(bank, [c])).toBeGreaterThan(0);
    expect(DEFAULT_CATEGORIES).not.toContain('relationships');
    expect(DEFAULT_CATEGORIES).not.toContain(SPECIAL_CATEGORY);
    expect(countQuestionsIn(bank, DEFAULT_CATEGORIES)).toBeGreaterThanOrEqual(ROUNDS_PER_GAME);
  });

  it('ไอคอนเป็นอีโมจิ หรือรูปใน /icons/ ที่มีไฟล์อยู่จริงใน public/', () => {
    for (const o of bank.flatMap((q) => q.options)) {
      if (!o.icon?.startsWith('/')) continue;
      expect(o.icon).toMatch(ICON_PATH);
      expect(existsSync(join('public', o.icon)), `${o.id}: ไม่พบไฟล์ public${o.icon}`).toBe(true);
    }
  });

  it('validator ปฏิเสธ path รูปไอคอนที่ผิดรูป', () => {
    for (const bad of ['/q01.svg', '/icons/รูป.svg', '/icons/a.jpg', '/icons/../x.svg', '/icons/a b.png']) {
      const broken = structuredClone(bank);
      broken[0]!.options[0]!.icon = bad;
      expect(() => loadQuestionBank(broken), bad).toThrow();
    }
    const ok = structuredClone(bank);
    ok[0]!.options[0]!.icon = '/icons/q01-o1.svg';
    expect(() => loadQuestionBank(ok)).not.toThrow();
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

describe('ชุดพิเศษ', () => {
  const special = bank.filter((q) => q.category === SPECIAL_CATEGORY);

  it('จำนวนข้อเป็นเลขคู่ ทั้งสองคนได้ทายเท่ากัน', () => {
    expect(special.length % 2).toBe(0);
    expect(roundsFor(bank, [SPECIAL_CATEGORY])).toBe(special.length);
  });

  it('เลือกกองเดียว: ได้ครบทุกข้อ เรียงตามไฟล์ ไม่ขึ้นกับ seed หรือคำถามเกมก่อน', () => {
    const ids = special.map((q) => q.id);
    expect(pickQuestions(bank, [SPECIAL_CATEGORY], [], createRng('a'))!.map((q) => q.id)).toEqual(ids);
    expect(pickQuestions(bank, [SPECIAL_CATEGORY], ids, createRng('b'))!.map((q) => q.id)).toEqual(ids);
  });

  it('ปนกับกองอื่น: กลับเป็นเกม 6 ข้อแบบสุ่ม', () => {
    const cats = ['food', SPECIAL_CATEGORY] as const;
    expect(roundsFor(bank, cats)).toBe(ROUNDS_PER_GAME);
    expect(pickQuestions(bank, cats, [], createRng('s1'))).toHaveLength(ROUNDS_PER_GAME);
  });

  it('จำนวนข้อเป็นเลขคี่: เริ่มเกมไม่ได้', () => {
    const odd = bank.filter((q) => q.id !== special[0]!.id);
    expect(roundsFor(odd, [SPECIAL_CATEGORY])).toBe(0);
    expect(pickQuestions(odd, [SPECIAL_CATEGORY], [], createRng('s1'))).toBeNull();
  });

  it('รอบปกติยังเป็น 6 รอบ', () => {
    expect(roundsFor(bank, DEFAULT_CATEGORIES)).toBe(ROUNDS_PER_GAME);
    expect(roundsFor(bank, ['food'])).toBe(0);
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

describe('promptFor — คำถามระบุคนตอบ', () => {
  const q17 = getQuestionBank().find((q) => q.id === 'q17')!;

  it('ฝั่งจัดอันดับเป็น “คุณ” และไม่มีคำว่า “จะ”', () => {
    expect(promptFor(q17, { you: true })).toBe('ถ้าคุณได้ตั๋วเที่ยวฟรี คุณอยากไปแบบไหนมากที่สุด?');
  });

  it('ฝั่งทายใส่ชื่อคู่หูและ “จะ”', () => {
    expect(promptFor(q17, { name: 'มะปราง' })).toBe('ถ้ามะปรางได้ตั๋วเที่ยวฟรี มะปรางจะอยากไปแบบไหนมากที่สุด?');
  });

  it('ชื่อที่มีอักขระพิเศษของ replace ไม่ถูกตีความ', () => {
    expect(promptFor(q17, { name: 'A$&B' })).toContain('ถ้าA$&Bได้ตั๋ว');
  });

  it('คำถามจากห้องเก่าที่ไม่มี personal ใช้ prompt เดิม', () => {
    expect(promptFor({ prompt: 'เดิม?' }, { name: 'มะปราง' })).toBe('เดิม?');
  });

  it('คลังจริงทุกข้อมี personal และแทนค่าแล้วไม่เหลือ token', () => {
    for (const q of getQuestionBank()) {
      expect(q.personal, q.id).toBeTruthy();
      for (const subject of [{ you: true } as const, { name: 'มะปราง' }]) {
        const text = promptFor(q, subject);
        expect(text, q.id).not.toMatch(/[{}]/);
        expect(text, q.id).toContain('you' in subject ? 'คุณ' : 'มะปราง');
      }
    }
  });

  it('schema ปฏิเสธ personal ที่ไม่มี {who}', () => {
    const bad = structuredClone(getQuestionBank().slice(0, 1));
    bad[0]!.personal = 'ไม่มีคนในคำถาม';
    expect(() => loadQuestionBank(bad)).toThrow();
  });
});
