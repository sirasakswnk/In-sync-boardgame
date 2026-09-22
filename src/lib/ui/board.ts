/**
 * กติกาการวางไพ่บนแท่นอันดับ (RankBoard) — ฟังก์ชันล้วน ไม่มี React
 *
 * slots[i] = id ของไพ่ที่อยู่อันดับ i+1 หรือ null ถ้ายังว่าง
 * ไพ่ในมือ = ไพ่ใน layout ที่ยังไม่อยู่บนแท่น โดยเรียงตาม layout (ลำดับสุ่มจาก server)
 */
export type Slots = readonly (string | null)[];

export function emptySlots(count: number): (string | null)[] {
  return Array.from({ length: count }, () => null);
}

export function handOf(layout: readonly string[], slots: Slots): string[] {
  const placed = new Set(slots.filter((s): s is string => s !== null));
  return layout.filter((id) => !placed.has(id));
}

export function isComplete(slots: Slots): slots is readonly string[] {
  return slots.length > 0 && slots.every((s) => s !== null);
}

export function placedCount(slots: Slots): number {
  return slots.filter((s) => s !== null).length;
}

/**
 * วางไพ่ `id` ที่ช่อง `index`
 * - ไพ่มาจากมือ: ไพ่เดิมในช่องนั้น (ถ้ามี) กลับเข้ามือ
 * - ไพ่มาจากช่องอื่น: สลับที่กับไพ่ในช่องปลายทาง
 */
export function place(slots: Slots, id: string, index: number): (string | null)[] {
  const next = [...slots];
  if (index < 0 || index >= next.length) return next;
  const from = next.indexOf(id);
  if (from === index) return next;
  const occupant = next[index] ?? null;
  if (from >= 0) next[from] = occupant;
  next[index] = id;
  return next;
}

export function returnToHand(slots: Slots, id: string): (string | null)[] {
  return slots.map((s) => (s === id ? null : s));
}

/** รับ draft/ข้อมูลสดที่เป็น string[] โดยช่องว่างเป็น "" — ผิดรูปแบบคืน null */
export function slotsFromStrings(raw: unknown, optionIds: readonly string[]): (string | null)[] | null {
  if (!Array.isArray(raw) || raw.length !== optionIds.length) return null;
  const known = new Set(optionIds);
  const seen = new Set<string>();
  const out: (string | null)[] = [];
  for (const v of raw) {
    if (v === '' || v === null) {
      out.push(null);
      continue;
    }
    if (typeof v !== 'string' || !known.has(v) || seen.has(v)) return null;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function slotsToStrings(slots: Slots): string[] {
  return slots.map((s) => s ?? '');
}
