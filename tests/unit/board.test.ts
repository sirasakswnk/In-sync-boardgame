import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSlots, saveSlots } from '@/lib/client/drafts';
import {
  emptySlots,
  handOf,
  isComplete,
  place,
  placedCount,
  returnToHand,
  slotsFromStrings,
  slotsToStrings,
} from '@/lib/ui/board';

const IDS = ['a', 'b', 'c', 'd', 'e'];
const LAYOUT = ['c', 'a', 'e', 'b', 'd'];

/** ไม่มีไพ่หายหรือซ้ำ: ไพ่บนแท่น + ไพ่ในมือ = ครบทุกใบพอดี */
function conserved(slots: (string | null)[]) {
  const onBoard = slots.filter((s): s is string => s !== null);
  expect(new Set(onBoard).size).toBe(onBoard.length);
  expect([...onBoard, ...handOf(LAYOUT, slots)].sort()).toEqual([...IDS].sort());
}

describe('แท่นอันดับ: วาง / สลับ / เก็บคืนมือ', () => {
  it('เริ่มต้นไพ่อยู่ในมือทั้งหมด เรียงตาม layout จาก server', () => {
    const s = emptySlots(5);
    expect(handOf(LAYOUT, s)).toEqual(LAYOUT);
    expect(isComplete(s)).toBe(false);
    expect(placedCount(s)).toBe(0);
  });

  it('วางจากมือลงช่องว่าง แล้วไพ่หายจากมือโดยลำดับที่เหลือคงเดิม', () => {
    const s = place(emptySlots(5), 'e', 0);
    expect(s).toEqual(['e', null, null, null, null]);
    expect(handOf(LAYOUT, s)).toEqual(['c', 'a', 'b', 'd']);
    conserved(s);
  });

  it('วางจากมือทับช่องที่มีไพ่: ไพ่เดิมกลับเข้ามือ', () => {
    let s = place(emptySlots(5), 'a', 2);
    s = place(s, 'b', 2);
    expect(s[2]).toBe('b');
    expect(handOf(LAYOUT, s)).toContain('a');
    conserved(s);
  });

  it('ย้ายไพ่บนแท่นไปช่องที่มีไพ่: สลับที่กัน', () => {
    let s = place(emptySlots(5), 'a', 0);
    s = place(s, 'b', 4);
    s = place(s, 'a', 4);
    expect(s).toEqual(['b', null, null, null, 'a']);
    conserved(s);
  });

  it('ย้ายไพ่บนแท่นไปช่องว่าง: ช่องเดิมว่าง', () => {
    let s = place(emptySlots(5), 'a', 0);
    s = place(s, 'a', 3);
    expect(s).toEqual([null, null, null, 'a', null]);
    conserved(s);
  });

  it('วางที่ช่องเดิม หรือ index นอกช่วง ไม่เปลี่ยนอะไร', () => {
    const s = place(emptySlots(5), 'a', 1);
    expect(place(s, 'a', 1)).toEqual(s);
    expect(place(s, 'b', 9)).toEqual(s);
    expect(place(s, 'b', -1)).toEqual(s);
  });

  it('เก็บคืนมือ แล้วไพ่กลับไปอยู่ตำแหน่งตาม layout', () => {
    let s = place(emptySlots(5), 'c', 0);
    s = place(s, 'a', 1);
    s = returnToHand(s, 'c');
    expect(s).toEqual([null, 'a', null, null, null]);
    expect(handOf(LAYOUT, s)).toEqual(['c', 'e', 'b', 'd']);
    conserved(s);
  });

  it('วางครบ 5 ช่องแล้วถือว่าครบ และได้ลำดับที่ส่ง server ได้', () => {
    let s = emptySlots(5);
    for (const [i, id] of ['d', 'b', 'e', 'a', 'c'].entries()) s = place(s, id, i);
    expect(isComplete(s)).toBe(true);
    expect(handOf(LAYOUT, s)).toEqual([]);
    expect(s).toEqual(['d', 'b', 'e', 'a', 'c']);
  });

  it('สุ่มวาง/สลับ/เก็บ 500 ครั้ง ไพ่ไม่หายไม่ซ้ำ', () => {
    let s = emptySlots(5);
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % n);
    for (let k = 0; k < 500; k++) {
      const id = IDS[rnd(5)]!;
      s = rnd(4) === 0 ? returnToHand(s, id) : place(s, id, rnd(5));
      conserved(s);
    }
  });
});

describe('แปลงเป็น/จาก string (draft และคำทายสด)', () => {
  it('ช่องว่างเป็น "" ไปกลับได้', () => {
    const s = ['a', null, 'c', null, 'e'];
    expect(slotsToStrings(s)).toEqual(['a', '', 'c', '', 'e']);
    expect(slotsFromStrings(slotsToStrings(s), IDS)).toEqual(s);
  });

  it.each([
    ['ไม่ใช่ array', 'abc'],
    ['สั้นไป', ['a', 'b']],
    ['id ซ้ำ', ['a', 'a', '', '', '']],
    ['id ไม่รู้จัก', ['z', '', '', '', '']],
    ['ไม่ใช่ string', [1, '', '', '', '']],
  ])('รูปแบบผิด (%s) ได้ null', (_label, raw) => {
    expect(slotsFromStrings(raw, IDS)).toBeNull();
  });
});

describe('draft ของแท่น (sessionStorage)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    return store;
  }

  it('บันทึกแบบวางไม่ครบ แล้วโหลดกลับมาได้เหมือนเดิม', () => {
    stubStorage();
    const s = ['b', null, null, 'a', null];
    saveSlots('k', s);
    expect(loadSlots('k', IDS)).toEqual(s);
  });

  it('draft ที่ผิดรูปหรือไม่มี ได้ null', () => {
    const store = stubStorage();
    expect(loadSlots('none', IDS)).toBeNull();
    store.set('bad', '["a","a","","",""]');
    expect(loadSlots('bad', IDS)).toBeNull();
    store.set('junk', '{not json');
    expect(loadSlots('junk', IDS)).toBeNull();
  });
});
