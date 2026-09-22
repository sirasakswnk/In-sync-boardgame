import rawBank from '@/data/questions.th.json';
import { ROUNDS_PER_GAME } from './constants';
import { shuffle } from './rng';
import { questionBankSchema } from './schemas';
import type { Category, Question } from './types';

/** ตรวจคลังคำถามตอนโหลด ถ้าผิด schema ให้ล้มทันที ไม่ปล่อยให้เกมเริ่มด้วยข้อมูลเสีย */
export function loadQuestionBank(input: unknown = rawBank): Question[] {
  const parsed = questionBankSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`คลังคำถามไม่ถูกต้อง: ${parsed.error.message}`);
  }
  return parsed.data;
}

let cached: Question[] | null = null;
export function getQuestionBank(): Question[] {
  cached ??= loadQuestionBank();
  return cached;
}

export function countQuestionsIn(bank: readonly Question[], categories: readonly Category[]): number {
  const wanted = new Set(categories);
  return bank.filter((q) => wanted.has(q.category)).length;
}

/**
 * เลือกคำถามสำหรับเกมใหม่ (plan.md §4.1 ข้อ 7 และ §4.5)
 * - ไม่ซ้ำภายในเกม
 * - เลี่ยงคำถามจากเกมที่เพิ่งจบก่อน ถ้าคลังไม่พอจึงเติมจากข้อเดิม
 * คืน null เมื่อหมวดที่เลือกมีไม่ถึง `count` ข้อ
 */
export function pickQuestions(
  bank: readonly Question[],
  categories: readonly Category[],
  avoidIds: readonly string[],
  rand: () => number,
  count: number = ROUNDS_PER_GAME,
): Question[] | null {
  const wanted = new Set(categories);
  const pool = bank.filter((q) => wanted.has(q.category));
  if (pool.length < count) return null;

  const avoid = new Set(avoidIds);
  const fresh = shuffle(pool.filter((q) => !avoid.has(q.id)), rand);
  const reused = shuffle(pool.filter((q) => avoid.has(q.id)), rand);
  return [...fresh, ...reused].slice(0, count);
}

export type PromptSubject = { you: true } | { name: string };

/**
 * ข้อความคำถามจากมุมของคนที่ถูกถาม
 * - { you: true }  → “ถ้าคุณได้ตั๋วเที่ยวฟรี คุณอยากไป…”
 * - { name: 'มะปราง' } → “ถ้ามะปรางได้ตั๋วเที่ยวฟรี มะปรางจะอยากไป…”
 * คำถามที่ไม่มี personal (เช่น snapshot จากห้องเก่า) ใช้ prompt เดิม
 */
export function promptFor(question: Pick<Question, 'prompt' | 'personal'>, subject: PromptSubject): string {
  const template = question.personal;
  if (!template) return question.prompt;
  const who = 'you' in subject ? 'คุณ' : subject.name;
  const will = 'you' in subject ? '' : 'จะ';
  // ใช้ฟังก์ชันแทนที่ ชื่อที่มี $ จะได้ไม่ถูกตีความเป็น pattern
  return template.replace(/\{who\}/g, () => who).replace(/\{will\}/g, () => will);
}
