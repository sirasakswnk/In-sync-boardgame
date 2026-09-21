import { commandSchema, type Command } from '@/lib/game';
import { ApiError, assertOrigin, handle, json, readJson, requireUid, statusFor, parseRoomCode } from '@/lib/server/http';
import { runCommand } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ code: string }> };

/**
 * ทุกคำสั่งของเกมเข้าทางนี้ — ตอบกลับเป็น ack ตาม plan.md §10.3 พร้อมมุมมองล่าสุดของผู้ส่ง
 * เพื่อให้ client resync ได้ทันทีแม้ realtime listener ยังตามไม่ทัน
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    assertOrigin(req);
    const uid = await requireUid(req);
    const code = parseRoomCode((await params).code);
    const parsed = commandSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError('INVALID_PAYLOAD', 400);

    const { ack, view } = await runCommand(uid, code, parsed.data as Command);
    return json({ ...ack, view }, ack.ok ? 200 : statusFor(ack.code));
  });
}
