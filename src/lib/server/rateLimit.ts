import { createHash } from 'node:crypto';
import { adminDb } from './admin';
import { ApiError } from './http';

type Bucket = { limit: number; windowMs: number };

/** จำกัดเฉพาะการสร้าง/เข้าห้อง แยกจากคำสั่งระหว่างเล่นปกติ (plan.md §10.2) */
export const BUCKETS = {
  create: { limit: 10, windowMs: 10 * 60 * 1000 },
  join: { limit: 30, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, Bucket>;

function keyFor(kind: string, subject: string): string {
  // เก็บเป็น hash ไม่เก็บ uid/IP ดิบ
  return createHash('sha256').update(`${kind}:${subject}`).digest('hex').slice(0, 32);
}

async function hit(kind: keyof typeof BUCKETS, subject: string, now: number): Promise<boolean> {
  const { limit, windowMs } = BUCKETS[kind];
  const ref = adminDb().ref(`rateLimits/${keyFor(kind, subject)}`);
  let allowed = false;
  await ref.transaction(
    (current: { windowStart: number; count: number } | null) => {
      if (!current || now - current.windowStart >= windowMs) {
        allowed = true;
        return { windowStart: now, count: 1 };
      }
      allowed = current.count < limit;
      return allowed ? { windowStart: current.windowStart, count: current.count + 1 } : current;
    },
    undefined,
    false,
  );
  return allowed;
}

/**
 * บัญชี anonymous สร้างใหม่ได้ง่าย จึงจำกัดทั้งต่อ uid และต่อ IP
 * ข้ามการจำกัดเมื่อรันกับ emulator/integration test ที่ตั้ง HS_TEST_SEED
 */
export async function enforceRateLimit(kind: keyof typeof BUCKETS, uid: string, ip: string): Promise<void> {
  if (process.env.HS_TEST_SEED && process.env.NODE_ENV !== 'production') return;
  const now = Date.now();
  const [byUser, byIp] = await Promise.all([hit(kind, `uid:${uid}`, now), hit(kind, `ip:${ip}`, now)]);
  if (!byUser || !byIp) throw new ApiError('RATE_LIMITED', 429);
}
