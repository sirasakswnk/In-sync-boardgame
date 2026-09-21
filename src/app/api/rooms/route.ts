import { assertOrigin, clientIp, handle, json, requireUid } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rateLimit';
import { createRoom } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    assertOrigin(req);
    const uid = await requireUid(req);
    await enforceRateLimit('create', uid, clientIp(req));
    const room = await createRoom(uid);
    return json({ ok: true, ...room }, 201);
  });
}
