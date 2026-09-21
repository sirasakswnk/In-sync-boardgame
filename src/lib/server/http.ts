import { ERROR_MESSAGES, roomCodeSchema, type ErrorCode } from '@/lib/game';
import { adminAuth, ConfigError } from './admin';

/** ข้อผิดพลาดที่ตั้งใจส่งกลับให้ผู้ใช้ — ข้อความเป็นภาษาไทยจาก ERROR_MESSAGES เสมอ */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

const STATUS: Partial<Record<ErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_CLOSED: 410,
  UNAUTHORIZED: 401,
  INVALID_PAYLOAD: 400,
  RATE_LIMITED: 429,
  ALREADY_IN_ROOM: 409,
  PROFILE_LOCKED: 409,
  INTERNAL: 500,
};

export function statusFor(code: ErrorCode): number {
  return STATUS[code] ?? 409;
}

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', 'Content-Type': 'application/json; charset=utf-8' };

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: NO_STORE });
}

export function errorJson(code: ErrorCode, status = statusFor(code), extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, code, message: ERROR_MESSAGES[code], ...extra }, status);
}

/**
 * ห่อ route handler: แปลง ApiError เป็น JSON ภาษาไทย และซ่อนรายละเอียดข้อผิดพลาดภายใน
 * ห้าม log request body — อาจมีคำตอบของผู้เล่น (plan.md §9.2)
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return errorJson(e.code, e.status, e.extra);
    if (e instanceof ConfigError) {
      console.error('[config]', e.message);
      return errorJson('INTERNAL', 503);
    }
    // ข้อความจาก firebase-admin ไม่มี credential ปน จึง log ได้ — ใช้ไล่ปัญหาใน Vercel Logs
    const code = (e as { code?: unknown } | null)?.code;
    console.error('[api] unexpected error:', e instanceof Error ? `${e.name}: ${e.message}` : typeof e, code ?? '');
    return errorJson('INTERNAL', 500);
  }
}

// ---------------------------------------------------------------------------
// Origin / body / auth
// ---------------------------------------------------------------------------

function allowedOrigins(req: Request): string[] {
  const configured = (process.env.APP_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (configured.length) return configured;
  // ไม่ได้ตั้ง APP_ORIGIN (เช่น dev ครั้งแรก): ยอมรับเฉพาะ origin เดียวกับที่ request เข้ามา
  return [new URL(req.url).origin];
}

/** ทุก mutation ต้องมาจาก origin ที่อนุญาต ไม่เปิด CORS แบบ wildcard (plan.md §10.1) */
export function assertOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin || !allowedOrigins(req).includes(origin.replace(/\/$/, ''))) {
    throw new ApiError('UNAUTHORIZED', 403);
  }
}

const MAX_BODY_BYTES = 16 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) throw new ApiError('INVALID_PAYLOAD', 413);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError('INVALID_PAYLOAD', 413);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('INVALID_PAYLOAD', 400);
  }
}

/** ตัวตนมาจาก Firebase ID token เท่านั้น ไม่รับ uid/playerId จาก body (plan.md §10.1) */
export async function requireUid(req: Request): Promise<string> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new ApiError('UNAUTHORIZED', 401);
  try {
    const decoded = await adminAuth().verifyIdToken(match[1]!);
    return decoded.uid;
  } catch (e) {
    if (e instanceof ConfigError) throw e;
    throw new ApiError('UNAUTHORIZED', 401);
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function parseRoomCode(raw: string): string {
  const parsed = roomCodeSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError('ROOM_NOT_FOUND', 404);
  return parsed.data;
}
