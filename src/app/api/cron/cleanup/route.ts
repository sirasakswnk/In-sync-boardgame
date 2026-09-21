import { timingSafeEqual } from 'node:crypto';
import { errorJson, handle, json } from '@/lib/server/http';
import { cleanupExpiredRooms } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vercel Cron: ลบห้องที่หมดอายุพร้อมคำตอบ/คำทาย/receipts ทั้งหมดของห้องนั้น */
export async function GET(req: Request) {
  return handle(async () => {
    if (!authorized(req)) return errorJson('UNAUTHORIZED', 401);
    const removed = await cleanupExpiredRooms();
    return json({ ok: true, removed });
  });
}
