import { z } from 'zod';
import { AVATAR_IDS, CATEGORIES, DISPLAY_NAME_MAX, OPTIONS_PER_ROUND, PHASES } from './constants';

// ---------------------------------------------------------------------------
// Ranking — ต้องเป็น permutation ของ option IDs ทั้ง 5 ของรอบนั้นพอดี
// ---------------------------------------------------------------------------

export function isValidRanking(candidate: unknown, optionIds: readonly string[]): candidate is string[] {
  if (!Array.isArray(candidate)) return false;
  if (candidate.length !== optionIds.length || candidate.length !== OPTIONS_PER_ROUND) return false;
  if (!candidate.every((id) => typeof id === 'string')) return false;
  const allowed = new Set(optionIds);
  const seen = new Set<string>();
  for (const id of candidate as string[]) {
    if (!allowed.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Display name — 1–20 ตัวอักษรที่มองเห็น (นับเป็น grapheme เพื่อให้สระ/วรรณยุกต์ไทยไม่ถูกนับแยก)
// ---------------------------------------------------------------------------

const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;

export function normalizeDisplayName(raw: string): string {
  return raw.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
}

export function visibleLength(value: string): number {
  let count = 0;
  for (const _ of segmenter.segment(value)) count++;
  return count;
}

export const displayNameSchema = z
  .string()
  .max(200)
  .transform(normalizeDisplayName)
  .refine((v) => visibleLength(v) >= 1 && visibleLength(v) <= DISPLAY_NAME_MAX);

export const avatarIdSchema = z.enum(AVATAR_IDS);
export const categorySchema = z.enum(CATEGORIES);
export const phaseSchema = z.enum(PHASES);

export const profileSchema = z.object({
  displayName: displayNameSchema,
  avatarId: avatarIdSchema,
});

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/);

// ---------------------------------------------------------------------------
// Commands — ตรวจรูปร่างเท่านั้น; การตรวจ permutation กับรอบจริงทำใน reducer
// ---------------------------------------------------------------------------

const commandId = z.uuid();
const gameScoped = {
  gameId: z.string().min(1).max(64),
  roundIndex: z.number().int().min(0).max(99),
  expectedPhase: phaseSchema,
};
const ranking = z.array(z.string().min(1).max(64)).max(20);

export const commandSchema = z.discriminatedUnion('kind', [
  z.object({
    commandId,
    kind: z.literal('settings'),
    categories: z.array(categorySchema).min(1).max(CATEGORIES.length),
  }),
  z.object({ commandId, kind: z.literal('ready'), ready: z.boolean() }),
  z.object({ commandId, kind: z.literal('start') }),
  z.object({ commandId, kind: z.literal('self'), optionIds: ranking, ...gameScoped }),
  z.object({ commandId, kind: z.literal('guess'), optionIds: ranking, ...gameScoped }),
  z.object({ commandId, kind: z.literal('continue'), ...gameScoped }),
  z.object({ commandId, kind: z.literal('rematch'), ...gameScoped }),
  z.object({ commandId, kind: z.literal('leave') }),
]);

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

export const questionSchema = z
  .object({
    id: z.string().regex(/^q\d{2,}$/),
    version: z.number().int().min(1),
    category: categorySchema,
    prompt: z.string().trim().min(1),
    topLabel: z.string().trim().min(1),
    bottomLabel: z.string().trim().min(1),
    options: z
      .array(
        z.object({
          id: z.string().regex(/^q\d{2,}-o\d+$/),
          label: z.string().trim().min(1),
          icon: z.string().min(1).optional(),
        }),
      )
      .length(OPTIONS_PER_ROUND),
  })
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    const labels = q.options.map((o) => o.label.trim());
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: `${q.id}: option id ซ้ำ` });
    if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: `${q.id}: option label ซ้ำ` });
    if (!ids.every((id) => id.startsWith(`${q.id}-`))) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: option id ต้องขึ้นต้นด้วย ${q.id}-` });
    }
  });

export const questionBankSchema = z.array(questionSchema).superRefine((bank, ctx) => {
  const ids = bank.map((q) => q.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'question id ซ้ำ' });
});
