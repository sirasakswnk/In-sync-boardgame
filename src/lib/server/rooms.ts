import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Reference } from 'firebase-admin/database';
import {
  applyCommand,
  buildTurn,
  buildViews,
  createRoomState,
  currentPhase,
  DEFAULT_CATEGORIES,
  getQuestionBank,
  isExpired,
  joinRoom,
  normalizeRoomState,
  projectRoomForPlayer,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  unjoinRoom,
  type Ack,
  type AvatarId,
  type Command,
  type ErrorCode,
  type PlayerView,
  type ReducerResult,
  type RoomState,
} from '@/lib/game';
import { adminDb } from './admin';
import { ApiError, statusFor } from './http';

/**
 * RTDB layout
 *   /roomCodes/$CODE          → roomId
 *   /users/$uid               → { displayName, avatarId, activeRoomId, updatedAt }
 *   /rooms/$roomId/state      → RoomState (client อ่านไม่ได้)
 *   /rooms/$roomId/views/$uid → PlayerView (เจ้าของอ่านได้คนเดียว)
 *   /rooms/$roomId/turn       → { key, phase, guesserUid } ของรอบปัจจุบัน (client อ่านไม่ได้ ใช้ใน rules ของ /live)
 *   /rooms/$roomId/presence/$uid/$connId → true (สมาชิกอ่าน / เจ้าของเขียน)
 *   /live/$roomId/$uid        → คำทายระหว่างเรียงของคนทาย (สมาชิกอ่าน / คนทายเขียนได้เฉพาะช่วง GUESS_RANK)
 *                               อยู่นอกโหนดห้อง เพื่อไม่ให้การเขียนถี่ ๆ ชนกับ transaction ของห้อง
 *
 * ทุกการเปลี่ยนแปลงของห้องทำใน transaction บน /rooms/$roomId โหนดเดียว
 * จึงเขียน state + views ของทั้งคู่พร้อมกันแบบอะตอมมิก และอ่าน presence ในจังหวะเดียวกัน
 */

export type UserProfile = {
  displayName: string;
  avatarId: AvatarId;
  activeRoomId?: string | null;
  updatedAt?: number;
};

type RoomNode = {
  state?: unknown;
  views?: unknown;
  turn?: unknown;
  presence?: Record<string, Record<string, unknown> | null> | null;
};

const db = () => adminDb();
const roomRef = (roomId: string): Reference => db().ref(`rooms/${roomId}`);

/** RTDB ไม่รับ undefined — ตัดทิ้งก่อนเขียนทุกครั้ง */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function onlineFrom(node: RoomNode | null): string[] {
  const presence = node?.presence ?? {};
  return Object.entries(presence)
    .filter(([, conns]) => conns && Object.keys(conns).length > 0)
    .map(([uid]) => uid);
}

export function payloadHash(cmd: Command): string {
  const { commandId: _ignored, ...rest } = cmd;
  const stable = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash('sha256').update(stable).digest('hex');
}

/** seed ของการสุ่มต่อคำสั่ง — ใช้ HS_TEST_SEED ได้เฉพาะนอก production เพื่อให้เทสต์ทำซ้ำได้ */
function commandSeed(roomId: string, commandId: string): string {
  const testSeed = process.env.HS_TEST_SEED;
  if (testSeed && process.env.NODE_ENV !== 'production') return `${testSeed}:${roomId}:${commandId}`;
  return randomBytes(16).toString('hex');
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await db().ref(`users/${uid}`).get();
  const val = snap.val() as UserProfile | null;
  return val?.displayName ? val : null;
}

async function requireProfile(uid: string): Promise<UserProfile> {
  const profile = await getProfile(uid);
  if (!profile) throw new ApiError('INVALID_PAYLOAD', 400, { reason: 'PROFILE_REQUIRED' });
  return profile;
}

export async function loadRoomState(roomId: string): Promise<RoomState | null> {
  const snap = await roomRef(roomId).child('state').get();
  return normalizeRoomState(snap.val());
}

/** ห้องยังเล่นได้และ uid ยังเป็นสมาชิกอยู่ — เงื่อนไขของ "ห้องปัจจุบัน" */
function isLiveMembership(room: RoomState | null, uid: string, now: number): room is RoomState {
  return Boolean(room && room.status !== 'CLOSED' && !isExpired(room, now) && room.members[uid]);
}

/** ห้องที่ผู้ใช้ยังผูกอยู่และยังเล่นได้ — ห้องที่ปิดหรือหมดอายุไม่นับ */
export async function activeRoomOf(uid: string): Promise<RoomState | null> {
  const snap = await db().ref(`users/${uid}/activeRoomId`).get();
  const roomId = snap.val() as string | null;
  if (!roomId) return null;
  const room = await loadRoomState(roomId);
  return isLiveMembership(room, uid, Date.now()) ? room : null;
}

/**
 * จอง "ห้องปัจจุบัน" ของผู้ใช้แบบ compare-and-swap — จุดตัดสินเดียวของกติกาหนึ่งคนหนึ่งห้อง
 * ผู้เรียกต้องเขียนห้องให้มีอยู่จริงก่อน คำขออื่นที่แข่งกันจึงเห็นห้องที่ชนะเป็นห้องที่ยังเล่นได้เสมอ
 * - ค่าเดิมชี้ห้องที่ยังเล่นได้ → ALREADY_IN_ROOM
 * - ค่าเปลี่ยนระหว่างทาง (อีกคำขอจองไปก่อน) → transaction abort แล้วตรวจห้องที่ชนะจาก snapshot ของมัน
 *   (ห้ามอ่านซ้ำด้วย get(): ใน process เดียวกัน SDK คืนค่าเก่าจาก cache ทำให้วนไม่จบ)
 * - cur === null ครั้งแรกอาจมาจาก cache ของ SDK: เขียนไปก่อน ถ้า server มีค่าอื่นจะเรียกซ้ำด้วยค่าจริง
 */
async function claimActiveRoom(uid: string, roomId: string): Promise<void> {
  const ref = db().ref(`users/${uid}/activeRoomId`);
  let old = ((await ref.get()).val() as string | null) ?? null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (old && old !== roomId) {
      const room = await loadRoomState(old);
      if (isLiveMembership(room, uid, Date.now())) {
        throw new ApiError('ALREADY_IN_ROOM', 409, { activeCode: room.code });
      }
    }
    const expected = old;
    const res = await ref.transaction(
      (cur: string | null) => (cur === null || cur === expected || cur === roomId ? roomId : undefined),
      undefined,
      false,
    );
    const current = (res.snapshot.val() as string | null) ?? null;
    if (res.committed && current === roomId) return;
    old = current;
  }
  throw new ApiError('INTERNAL', 503);
}

/** คืนรหัสห้อง เฉพาะเมื่อรหัสยังชี้มาที่ห้องของเรา (null จาก cache → เขียน null ให้ server ตรวจค่าจริง) */
async function releaseCode(code: string, roomId: string): Promise<void> {
  await db()
    .ref(`roomCodes/${code}`)
    .transaction((cur: string | null) => (cur === null || cur === roomId ? null : undefined), undefined, false)
    .catch(() => undefined);
}

/** ทิ้งห้องที่เพิ่งสร้างแต่จองเป็นห้องปัจจุบันไม่สำเร็จ — รหัสยังไม่เคยส่งให้ใคร จึงไม่มีคนอื่นอยู่ในห้อง */
async function discardRoom(roomId: string, code: string): Promise<void> {
  await db().ref(`rooms/${roomId}`).remove().catch(() => undefined);
  await releaseCode(code, roomId);
}

export async function saveProfile(uid: string, profile: Pick<UserProfile, 'displayName' | 'avatarId'>) {
  const active = await activeRoomOf(uid);
  // ระหว่างเกมล็อกโปรไฟล์ ไม่ให้ชื่อเปลี่ยนกลางรอบ (plan.md §10.1)
  if (active && currentPhase(active) !== 'LOBBY') throw new ApiError('PROFILE_LOCKED', 409);

  await db()
    .ref(`users/${uid}`)
    .update({ displayName: profile.displayName, avatarId: profile.avatarId, updatedAt: Date.now() });

  // อยู่ใน lobby: อัปเดตชื่อ/อวาตาร์ในห้องด้วย เพื่อให้คู่หูเห็นทันที
  if (active) {
    await mutateRoom(active.id, (state) => {
      const res = joinRoom(state, { uid, ...profile }, Date.now());
      return res.ok ? { state: res.room, value: null } : { state: null, value: null };
    });
  }
}

// ---------------------------------------------------------------------------
// Room transactions
// ---------------------------------------------------------------------------

/**
 * transaction บนโหนดห้องทั้งก้อน
 * - `fn` ต้องบริสุทธิ์และทำซ้ำได้ เพราะ RTDB จะเรียกซ้ำเมื่อมีการเขียนชนกัน
 * - ครั้งแรก SDK อาจส่ง null มาจาก cache ภายใน: คืน null กลับไปเพื่อให้ server ตีกลับพร้อมค่าจริง
 * - ไม่ abort แม้ไม่มีการเปลี่ยนแปลง เพื่อให้ผลลัพธ์ถูกยืนยันกับค่าล่าสุดบน server เสมอ
 */
async function mutateRoom<T>(
  roomId: string,
  fn: (state: RoomState, node: RoomNode) => { state: RoomState | null; value: T },
): Promise<{ value: T; state: RoomState } | null> {
  let outcome: { value: T; state: RoomState } | null = null;

  const result = await roomRef(roomId).transaction(
    (current: RoomNode | null) => {
      outcome = null;
      if (current === null) return null;
      const state = normalizeRoomState(current.state);
      if (!state) return current;
      const { state: next, value } = fn(state, current);
      if (!next) {
        outcome = { value, state };
        return current;
      }
      outcome = { value, state: next };
      return clean({ ...current, state: next, views: buildViews(next), turn: buildTurn(next) });
    },
    undefined,
    false,
  );

  if (!result.committed || !result.snapshot.exists()) return null;
  return outcome;
}

async function resolveRoomId(code: string): Promise<string> {
  const snap = await db().ref(`roomCodes/${code}`).get();
  const roomId = snap.val() as string | null;
  if (!roomId) throw new ApiError('ROOM_NOT_FOUND', 404);
  return roomId;
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

/** จองรหัสห้องด้วย transaction + retry เมื่อชน (plan.md §10.2) */
async function claimCode(roomId: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode();
    const res = await db()
      .ref(`roomCodes/${code}`)
      .transaction((current) => (current === null ? roomId : undefined), undefined, false);
    if (res.committed && res.snapshot.val() === roomId) return code;
  }
  throw new ApiError('INTERNAL', 503);
}

export type RoomEntry = { code: string; roomId: string; view: PlayerView };

export async function createRoom(uid: string): Promise<RoomEntry> {
  const profile = await requireProfile(uid);
  // เช็คเร็วเพื่อตอบทันที — ตัวตัดสินจริงคือ claimActiveRoom ด้านล่าง
  const active = await activeRoomOf(uid);
  if (active) throw new ApiError('ALREADY_IN_ROOM', 409, { activeCode: active.code });

  const roomId = db().ref('rooms').push().key!;
  const code = await claimCode(roomId);
  const state = createRoomState({
    roomId,
    code,
    host: { uid, displayName: profile.displayName, avatarId: profile.avatarId },
    categories: DEFAULT_CATEGORIES,
    now: Date.now(),
  });

  // เขียนห้องให้มีอยู่จริงก่อนจอง: คำขอสร้าง/เข้าห้องที่แข่งกันจะเห็นห้องนี้เป็นห้องที่ยังเล่นได้
  try {
    await db()
      .ref()
      .update(clean({ [`rooms/${roomId}/state`]: state, [`rooms/${roomId}/views`]: buildViews(state) }));
  } catch (e) {
    await releaseCode(code, roomId);
    throw e;
  }

  try {
    await claimActiveRoom(uid, roomId);
  } catch (e) {
    await discardRoom(roomId, code);
    throw e;
  }

  return { code, roomId, view: projectRoomForPlayer(state, uid)! };
}

export async function joinRoomByCode(uid: string, code: string): Promise<RoomEntry> {
  const profile = await requireProfile(uid);
  const roomId = await resolveRoomId(code);

  // เช็คเร็วเพื่อตอบทันที — ตัวตัดสินจริงคือ claimActiveRoom ด้านล่าง
  const active = await activeRoomOf(uid);
  if (active && active.id !== roomId) throw new ApiError('ALREADY_IN_ROOM', 409, { activeCode: active.code });

  // ตรวจความจุและเพิ่มสมาชิกใน transaction เดียว — join พร้อมกันสองคนจะได้ที่นั่งสุดท้ายแค่คนเดียว
  const res = await mutateRoom<{ error: ErrorCode | null; wasMember: boolean }>(roomId, (state) => {
    const wasMember = Boolean(state.members[uid]);
    const joined = joinRoom(state, { uid, displayName: profile.displayName, avatarId: profile.avatarId }, Date.now());
    if (!joined.ok) return { state: null, value: { error: joined.code, wasMember } };
    return { state: joined.room, value: { error: null, wasMember } };
  });

  if (!res) throw new ApiError('ROOM_NOT_FOUND', 404);
  if (res.value.error) throw new ApiError(res.value.error, statusFor(res.value.error));

  try {
    await claimActiveRoom(uid, roomId);
  } catch (e) {
    // แพ้ให้อีกคำขอที่เข้าห้องอื่นไปก่อน: ถอนที่นั่งที่เพิ่งได้ คู่หูในห้องนี้จะไม่เห็นเราค้างอยู่
    if (!res.value.wasMember) {
      await mutateRoom(roomId, (state) => ({ state: unjoinRoom(state, uid, Date.now()), value: null })).catch(
        () => undefined,
      );
    }
    throw e;
  }

  return { code: res.state.code, roomId, view: projectRoomForPlayer(res.state, uid)! };
}

/** snapshot ตามสิทธิ์ — เส้นทาง resync เมื่อ listener หลุดหรือ ack หาย (plan.md §11) */
export async function snapshotFor(uid: string, code: string): Promise<RoomEntry> {
  const roomId = await resolveRoomId(code);
  const state = await loadRoomState(roomId);
  if (!state) throw new ApiError('ROOM_NOT_FOUND', 404);
  // รหัสห้องไม่ใช่ credential: คนนอกได้แค่รู้ว่ามีห้องนี้ ไม่ได้ข้อมูลเกม (plan.md §10.2)
  const view = projectRoomForPlayer(state, uid);
  if (!view) {
    if (state.status === 'CLOSED' || isExpired(state, Date.now())) throw new ApiError('ROOM_CLOSED', 410);
    const full = Object.keys(state.members).length >= 2;
    throw new ApiError(full ? 'ROOM_FULL' : 'UNAUTHORIZED', full ? 409 : 403, { canJoin: !full });
  }
  if (isExpired(state, Date.now()) && state.status === 'OPEN') {
    throw new ApiError('ROOM_CLOSED', 410);
  }
  return { code: state.code, roomId, view };
}

export async function runCommand(uid: string, code: string, cmd: Command): Promise<{ ack: Ack; view: PlayerView | null }> {
  const roomId = await resolveRoomId(code);
  const hash = payloadHash(cmd);
  // ค่าที่สุ่ม/เวลา สร้างครั้งเดียวนอก transaction เพื่อให้ retry ของ transaction ได้ผลเดียวกัน
  const now = Date.now();
  const seed = commandSeed(roomId, cmd.commandId);
  const newGameId = randomUUID();
  const bank = getQuestionBank();

  const res = await mutateRoom<ReducerResult>(roomId, (state, node) => {
    const result = applyCommand(state, cmd, {
      uid,
      now,
      onlineUids: onlineFrom(node),
      bank,
      seed,
      newGameId,
      payloadHash: hash,
    });
    return { state: result.changed ? result.room : null, value: result };
  });

  if (!res) throw new ApiError('ROOM_NOT_FOUND', 404);
  const { ack, room } = res.value;

  if (ack.ok && cmd.kind === 'leave') {
    await Promise.all(
      Object.keys(room.members).map((member) => db().ref(`users/${member}/activeRoomId`).set(null)),
    );
  }

  // คำทายสดใช้แค่ช่วง GUESS_RANK — ผ่านช่วงนั้นหรือปิดห้องแล้วลบทิ้ง (best-effort: rules กันเขียนค้างอยู่แล้ว)
  if (ack.ok && (cmd.kind === 'guess' || cmd.kind === 'leave') && currentPhase(room) !== 'GUESS_RANK') {
    await db().ref(`live/${roomId}`).remove().catch(() => undefined);
  }

  return { ack, view: projectRoomForPlayer(room, uid) };
}

// ---------------------------------------------------------------------------
// Cleanup (Vercel Cron)
// ---------------------------------------------------------------------------

export async function cleanupExpiredRooms(now = Date.now(), limit = 200): Promise<number> {
  const snap = await db().ref('rooms').orderByChild('state/expiresAt').endAt(now).limitToFirst(limit).get();
  const updates: Record<string, null> = {};
  let count = 0;
  snap.forEach((child) => {
    const state = normalizeRoomState(child.child('state').val());
    // ลบทั้งโหนดห้อง: คำตอบ คำทาย คะแนน receipts ไปพร้อมกัน (plan.md §11 retention)
    updates[`rooms/${child.key}`] = null;
    updates[`live/${child.key}`] = null;
    if (state?.code) updates[`roomCodes/${state.code}`] = null;
    count++;
  });
  if (count) await db().ref().update(updates);

  const staleLimits = await db()
    .ref('rateLimits')
    .orderByChild('windowStart')
    .endAt(now - 24 * 60 * 60 * 1000)
    .limitToFirst(500)
    .get();
  const limitUpdates: Record<string, null> = {};
  staleLimits.forEach((child) => {
    limitUpdates[`rateLimits/${child.key}`] = null;
  });
  if (Object.keys(limitUpdates).length) await db().ref().update(limitUpdates);

  return count;
}
