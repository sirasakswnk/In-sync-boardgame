import { profileSchema } from '@/lib/game';
import { ApiError, assertOrigin, handle, json, readJson, requireUid } from '@/lib/server/http';
import { activeRoomOf, getProfile, saveProfile } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const uid = await requireUid(req);
    const [profile, active] = await Promise.all([getProfile(uid), activeRoomOf(uid)]);
    return json({
      ok: true,
      profile: profile ? { displayName: profile.displayName, avatarId: profile.avatarId } : null,
      activeRoomCode: active?.code ?? null,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertOrigin(req);
    const uid = await requireUid(req);
    const parsed = profileSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError('INVALID_PAYLOAD', 400, { reason: 'PROFILE_INVALID' });
    await saveProfile(uid, parsed.data);
    return json({ ok: true, profile: parsed.data });
  });
}
