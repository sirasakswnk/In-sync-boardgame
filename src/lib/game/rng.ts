/**
 * Randomness ที่กำหนดผลได้จาก seed
 *
 * reducer ทำงานใน RTDB transaction ซึ่งอาจถูกเรียกซ้ำเมื่อชนกัน จึงห้ามใช้ Math.random
 * ข้างใน: ทุกค่าที่สุ่มได้มาจาก seed ใน ctx ที่คงที่ตลอดการ retry ของ command เดียว
 */

/** FNV-1a 32-bit */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — PRNG เล็ก เร็ว และกระจายตัวพอสำหรับสลับการ์ด */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): () => number {
  return mulberry32(hashString(seed));
}

/** Fisher–Yates ที่คืน array ใหม่ ไม่แก้ของเดิม */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
