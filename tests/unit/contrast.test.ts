import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** อ่าน design tokens จาก globals.css จริง แล้วตรวจ contrast ของคู่สีที่ UI ใช้กับข้อความ */
const css = readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const tokens = Object.fromEntries(
  [...rootBlock.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]),
);

function luminance(hex: string): number {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [ข้อความ, พื้น] ที่ปรากฏจริงในคอมโพเนนต์
const TEXT_PAIRS: Array<[string, string]> = [
  ['ink', 'cream'],
  ['ink', 'paper'],
  ['ink-muted', 'cream'],
  ['ink-muted', 'paper'],
  ['ink', 'coral'], // ปุ่มหลัก
  ['ink', 'coral-soft'],
  ['ink', 'lavender'], // ปุ่มหลักช่วงทาย
  ['ink', 'lavender-soft'],
  ['coral-ink', 'cream'],
  ['coral-ink', 'paper'],
  ['coral-ink', 'coral-soft'],
  ['lavender-ink', 'cream'],
  ['lavender-ink', 'paper'],
  ['lavender-ink', 'lavender-soft'],
  ['teal-ink', 'cream'],
  ['teal-ink', 'paper'],
  ['teal-ink', 'teal-soft'],
  ['paper', 'teal'],
  ['amber-ink', 'amber-soft'],
  // ธีมโต๊ะบอร์ดเกม (data-skin="table")
  ['felt-ink', 'felt'], // ข้อความบนผ้าสักหลาด
  ['felt-ink', 'felt-deep'],
  ['felt-muted', 'felt'], // คำใบ้ใต้ปุ่ม, footer
  ['felt-muted', 'felt-deep'],
  ['felt-ink', 'wood'], // ชื่อผู้เล่นบนขอบโต๊ะ
  ['felt-ink', 'wood-deep'],
  ['wood-muted', 'wood'],
  ['wood-muted', 'wood-deep'],
  ['wood-accent', 'wood'], // ปุ่มออกจากห้อง
  ['wood-accent', 'wood-deep'],
  ['gold', 'wood'], // ป้าย “คุณ”
  ['ink', 'gold'], // ตัวเลขบนเหรียญคะแนน
  ['ink', 'board'], // ไพ่และกระดาน
  ['ink-muted', 'board'],
  ['coral-ink', 'board'],
  ['lavender-ink', 'board'],
];

describe('design tokens contrast (WCAG AA ≥ 4.5:1 สำหรับข้อความปกติ)', () => {
  it('อ่าน token จาก globals.css ได้ครบ', () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect(tokens[fg], `ไม่มี --${fg}`).toBeDefined();
      expect(tokens[bg], `ไม่มี --${bg}`).toBeDefined();
    }
  });

  it.each(TEXT_PAIRS)('--%s บน --%s', (fg, bg) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('สีสดดิบจาก plan.md ไม่ผ่านเมื่อใช้เป็นตัวอักษร จึงต้องใช้เฉด -ink แทน', () => {
    expect(contrast(tokens.coral!, tokens.cream!)).toBeLessThan(4.5);
    expect(contrast(tokens.lavender!, tokens.cream!)).toBeLessThan(4.5);
  });
});

/**
 * ปุ่มหลักใช้ตัวอักษร --stage-on บนพื้น --stage และค่าทั้งสองเปลี่ยนตามช่วงเกม (data-stage)
 * อ่านค่าจริงของแต่ละช่วงจาก CSS แล้วตรวจทุกคู่ — เคยพลาดตัวอักษรเข้มบนพื้น teal (~3.4:1)
 */
describe('ปุ่มหลักทุกช่วงเกม (--stage-on บน --stage)', () => {
  function block(selector: string): string {
    const start = css.indexOf(selector);
    return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
  }
  function varsIn(text: string): Record<string, string> {
    return Object.fromEntries([...text.matchAll(/--(stage[a-z-]*):\s*var\(--([a-z-]+)\)/g)].map((m) => [m[1]!, m[2]!]));
  }

  const base = varsIn(rootBlock);
  const stages: Array<[string, Record<string, string>]> = [
    ['self (ค่าเริ่มต้น)', base],
    ['guess', { ...base, ...varsIn(block("[data-stage='guess']")) }],
    ['reveal', { ...base, ...varsIn(block("[data-stage='reveal']")) }],
  ];

  it.each(stages)('ช่วง %s', (_name, vars) => {
    const bg = tokens[vars.stage!];
    const fg = tokens[vars['stage-on']!];
    expect(bg, 'ไม่พบ --stage').toBeDefined();
    expect(fg, 'ไม่พบ --stage-on').toBeDefined();
    expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });

  it('ตัวอักษรเข้มบนพื้น teal ไม่ผ่าน จึงต้องใช้ตัวขาวในช่วงเฉลย', () => {
    expect(contrast(tokens.ink!, tokens.teal!)).toBeLessThan(4.5);
  });
});
