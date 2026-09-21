import { assertOrigin, clientIp, handle, json, requireUid, parseRoomCode } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rateLimit';
import { joinRoomByCode } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    assertOrigin(req);
    const uid = await requireUid(req);
    const code = parseRoomCode((await params).code);
    await enforceRateLimit('join', uid, clientIp(req));
    return json({ ok: true, ...(await joinRoomByCode(uid, code)) });
  });
}
