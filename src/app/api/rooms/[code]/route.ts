import { handle, json, parseRoomCode, requireUid } from '@/lib/server/http';
import { snapshotFor } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ code: string }> };

/** snapshot เฉพาะสมาชิก — คนนอกได้แค่สถานะว่าเข้าได้หรือไม่ ไม่ได้ข้อมูลเกม */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const uid = await requireUid(req);
    const code = parseRoomCode((await params).code);
    return json({ ok: true, ...(await snapshotFor(uid, code)) });
  });
}
