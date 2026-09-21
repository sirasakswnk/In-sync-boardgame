import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { commandSchema, displayNameSchema, isValidRanking, profileSchema, roomCodeSchema } from '@/lib/game';

const ids = ['q01-o1', 'q01-o2', 'q01-o3', 'q01-o4', 'q01-o5'];

describe('isValidRanking — ต้องเป็น permutation ครบ 5 ID ของรอบนั้น (plan.md §10.3)', () => {
  it('รับ permutation ที่ถูกต้อง', () => {
    expect(isValidRanking([...ids].reverse(), ids)).toBe(true);
    expect(isValidRanking(ids, ids)).toBe(true);
  });

  it.each([
    ['ID ซ้ำ', ['q01-o1', 'q01-o1', 'q01-o3', 'q01-o4', 'q01-o5']],
    ['ID ที่ไม่รู้จัก (foreign)', ['q01-o1', 'q01-o2', 'q01-o3', 'q01-o4', 'q02-o5']],
    ['ขาดไปหนึ่งตัว', ['q01-o1', 'q01-o2', 'q01-o3', 'q01-o4']],
    ['เกินมาหนึ่งตัว', [...ids, 'q01-o1']],
    ['array ว่าง', []],
  ])('ปฏิเสธ: %s', (_label, candidate) => {
    expect(isValidRanking(candidate, ids)).toBe(false);
  });

  it.each([
    ['null', null],
    ['string', 'q01-o1,q01-o2'],
    ['object', { 0: 'q01-o1' }],
    ['array ของตัวเลข', [1, 2, 3, 4, 5]],
    ['array ที่มี null', ['q01-o1', null, 'q01-o3', 'q01-o4', 'q01-o5']],
  ])('ปฏิเสธ payload ผิดรูป: %s', (_label, candidate) => {
    expect(isValidRanking(candidate, ids)).toBe(false);
  });
});

describe('commandSchema', () => {
  const base = { commandId: randomUUID() };
  const scoped = { gameId: 'g1', roundIndex: 0, expectedPhase: 'SELF_RANK' };

  it('รับคำสั่งที่ถูกต้องทุกชนิด', () => {
    const good = [
      { ...base, kind: 'settings', categories: ['food'] },
      { ...base, kind: 'ready', ready: true },
      { ...base, kind: 'start' },
      { ...base, kind: 'self', optionIds: ids, ...scoped },
      { ...base, kind: 'guess', optionIds: ids, ...scoped },
      { ...base, kind: 'continue', ...scoped },
      { ...base, kind: 'rematch', ...scoped },
      { ...base, kind: 'leave' },
    ];
    for (const cmd of good) expect(commandSchema.safeParse(cmd).success).toBe(true);
  });

  it('ปฏิเสธ commandId ที่ไม่ใช่ UUID, kind แปลก, หมวดว่าง และ game command ที่ไม่มี scope', () => {
    const bad = [
      { commandId: 'abc', kind: 'start' },
      { ...base, kind: 'teleport' },
      { ...base, kind: 'settings', categories: [] },
      { ...base, kind: 'settings', categories: ['nsfw'] },
      { ...base, kind: 'self', optionIds: ids },
      { ...base, kind: 'continue', gameId: 'g1', roundIndex: -1, expectedPhase: 'REVEAL' },
      { ...base, kind: 'ready', ready: 'yes' },
    ];
    for (const cmd of bad) expect(commandSchema.safeParse(cmd).success).toBe(false);
  });

  it('ไม่มีช่องให้ client ส่ง score หรือ playerId เข้ามาเป็นหลักฐาน', () => {
    const parsed = commandSchema.parse({ ...base, kind: 'start', score: 60, playerId: 'someone-else' });
    expect(parsed).not.toHaveProperty('score');
    expect(parsed).not.toHaveProperty('playerId');
  });
});

describe('displayNameSchema — 1–20 ตัวอักษรที่มองเห็น', () => {
  it('นับสระ/วรรณยุกต์ไทยรวมกับพยัญชนะเป็นหนึ่งตัว', () => {
    // "น้ำ" = 3 code points แต่เป็น 2 grapheme (น้ + ำ)
    const name = 'น้ำ'.repeat(10);
    expect(displayNameSchema.safeParse(name).success).toBe(true);
  });

  it('ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้ำ และลบอักขระควบคุม/zero-width', () => {
    expect(displayNameSchema.parse('  มะลิ   จ๋า ​ ')).toBe('มะลิ จ๋า');
  });

  it.each([
    ['ว่าง', ''],
    ['ช่องว่างล้วน', '    '],
    ['zero-width ล้วน', '​​'],
    ['ยาวเกิน 20', 'a'.repeat(21)],
  ])('ปฏิเสธ: %s', (_label, value) => {
    expect(displayNameSchema.safeParse(value).success).toBe(false);
  });

  it('รับชื่อยาวพอดี 20 ตัว', () => {
    expect(displayNameSchema.safeParse('a'.repeat(20)).success).toBe(true);
  });
});

describe('profileSchema / roomCodeSchema', () => {
  it('avatar ต้องอยู่ใน allowlist', () => {
    expect(profileSchema.safeParse({ displayName: 'บี', avatarId: 'cat' }).success).toBe(true);
    expect(profileSchema.safeParse({ displayName: 'บี', avatarId: 'https://evil/x.png' }).success).toBe(false);
  });

  it('รหัสห้อง 6 ตัวจากชุดที่ไม่กำกวม และยอมรับตัวพิมพ์เล็ก', () => {
    expect(roomCodeSchema.parse(' abc234 ')).toBe('ABC234');
    for (const bad of ['ABCDE', 'ABCDEFG', 'ABCDE0', 'ABCDEI', 'ABCDEO', 'ABCDE1', 'ABC-23']) {
      expect(roomCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});
