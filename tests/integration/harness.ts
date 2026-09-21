import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  goOffline,
  goOnline,
  onDisconnect,
  push,
  ref,
  set,
  type Database,
  type DatabaseReference,
} from 'firebase/database';
import { normalizePlayerView, type AvatarId, type CommandBody, type PlayerView } from '@/lib/game';

/**
 * Harness สำหรับ integration test: ผู้เล่นแต่ละคนเป็น Firebase app แยกกัน (uid/token/การเชื่อมต่อ RTDB ของตัวเอง)
 * คุยกับ Next.js server จริงผ่าน HTTP และคุยกับ RTDB จริงผ่าน client SDK ภายใต้ security rules
 *
 * ใช้ได้ทั้ง project จริง (.env.local) และ Firebase Local Emulator (.env.emulator)
 */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL && existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

export const usingEmulator = Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST);

export function firebaseReady(): boolean {
  const hasClient = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  );
  const hasAdmin = usingEmulator || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  return hasClient && hasAdmin;
}

if (!firebaseReady()) {
  console.warn(
    '\n[integration] ข้าม: ยังไม่ได้ตั้งค่า Firebase — ใส่ค่าใน .env.local (project จริง) หรือรัน npm run test:e2e:emulator\n',
  );
}

function clientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(fn: () => Promise<T | false | null | undefined>, label: string, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < until) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(150);
  }
  throw new Error(`หมดเวลารอ: ${label}${last ? ` (${String(last)})` : ''}`);
}

// ---------------------------------------------------------------------------
// Next.js server
// ---------------------------------------------------------------------------

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port'))));
    });
  });
}

export class TestServer {
  private proc: ChildProcess | null = null;
  private log: string[] = [];
  port = 0;
  origin = '';

  async start(port?: number): Promise<void> {
    this.port = port ?? (await freePort());
    this.origin = `http://localhost:${this.port}`;
    this.log = [];
    this.proc = spawn(`npx next dev -p ${this.port}`, {
      shell: true,
      env: {
        ...process.env,
        APP_ORIGIN: this.origin,
        HS_TEST_SEED: 'integration',
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'development',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const collect = (b: Buffer) => this.log.push(b.toString());
    this.proc.stdout?.on('data', collect);
    this.proc.stderr?.on('data', collect);

    await waitFor(
      async () => {
        const res = await fetch(`${this.origin}/api/health`);
        return res.ok;
      },
      `server ${this.origin} พร้อม\n${this.log.join('').slice(-2000)}`,
      120_000,
    );
  }

  async stop(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    if (!proc?.pid) return;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
    // รอจนพอร์ตว่างจริง
    await waitFor(
      async () => {
        try {
          await fetch(`${this.origin}/api/health`);
          return false;
        } catch {
          return true;
        }
      },
      'server หยุด',
      30_000,
    );
  }

  output(): string {
    return this.log.join('');
  }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export type ApiResult = { status: number; body: Record<string, unknown> };

export class Player {
  private conn: DatabaseReference | null = null;

  private constructor(
    readonly label: string,
    private readonly app: FirebaseApp,
    private readonly auth: Auth,
    readonly db: Database,
    readonly uid: string,
    private readonly server: TestServer,
  ) {}

  static async create(label: string, server: TestServer): Promise<Player> {
    const app = initializeApp(clientConfig(), `${label}-${randomUUID()}`);
    const auth = getAuth(app);
    const db = getDatabase(app);
    if (usingEmulator) {
      connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, {
        disableWarnings: true,
      });
      const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000').split(':');
      connectDatabaseEmulator(db, host!, Number(port));
    }
    const cred = await signInAnonymously(auth);
    return new Player(label, app, auth, db, cred.user.uid, server);
  }

  async call(method: 'GET' | 'POST', path: string, body?: unknown, opts: { origin?: string | null } = {}): Promise<ApiResult> {
    const token = await this.auth.currentUser!.getIdToken();
    const origin = opts.origin === undefined ? this.server.origin : opts.origin;
    const res = await fetch(`${this.server.origin}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(origin ? { Origin: origin } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      // ignore
    }
    return { status: res.status, body: json };
  }

  profile(displayName: string, avatarId: AvatarId = 'cat') {
    return this.call('POST', '/api/profile', { displayName, avatarId });
  }

  async createRoom(): Promise<{ code: string; roomId: string; view: PlayerView }> {
    const res = await this.call('POST', '/api/rooms');
    if (res.status !== 201) throw new Error(`createRoom ${res.status} ${JSON.stringify(res.body)}`);
    return { code: String(res.body.code), roomId: String(res.body.roomId), view: normalizePlayerView(res.body.view)! };
  }

  join(code: string) {
    return this.call('POST', `/api/rooms/${code}/join`);
  }

  snapshot(code: string) {
    return this.call('GET', `/api/rooms/${code}`);
  }

  command(code: string, body: CommandBody, commandId: string = randomUUID()) {
    return this.call('POST', `/api/rooms/${code}/commands`, { ...body, commandId });
  }

  /** ประกาศว่าออนไลน์แบบเดียวกับ browser: หนึ่ง connection + onDisconnect */
  async online(roomId: string): Promise<void> {
    goOnline(this.db);
    this.conn = push(ref(this.db, `rooms/${roomId}/presence/${this.uid}`));
    await onDisconnect(this.conn).remove();
    await set(this.conn, true);
  }

  /** ตัดการเชื่อมต่อ RTDB จริง — server จะลบ presence ผ่าน onDisconnect เอง */
  offline(): void {
    goOffline(this.db);
    this.conn = null;
  }

  async readView(roomId: string): Promise<PlayerView | null> {
    const snap = await get(ref(this.db, `rooms/${roomId}/views/${this.uid}`));
    return normalizePlayerView(snap.val());
  }

  async canRead(path: string): Promise<boolean> {
    try {
      await get(ref(this.db, path));
      return true;
    } catch {
      return false;
    }
  }

  async readValue(path: string): Promise<unknown> {
    return (await get(ref(this.db, path))).val();
  }

  async canWrite(path: string, value: unknown): Promise<boolean> {
    try {
      await set(ref(this.db, path), value);
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    try {
      goOffline(this.db);
    } catch {
      // ignore
    }
    await deleteApp(this.app);
  }
}

// ---------------------------------------------------------------------------
// Cleanup — ลบทุกอย่างที่เทสต์สร้างไว้ ไม่ทิ้งข้อมูลทดสอบใน project จริง
// ---------------------------------------------------------------------------

export class Janitor {
  private rooms = new Map<string, string>();
  private players: Player[] = [];

  trackRoom(roomId: string, code: string) {
    this.rooms.set(roomId, code);
  }

  trackPlayer(p: Player) {
    this.players.push(p);
    return p;
  }

  async cleanup(): Promise<void> {
    const { adminAuth, adminDb } = await import('@/lib/server/admin');
    const updates: Record<string, null> = {};
    for (const [roomId, code] of this.rooms) {
      updates[`rooms/${roomId}`] = null;
      updates[`live/${roomId}`] = null;
      updates[`roomCodes/${code}`] = null;
    }
    for (const p of this.players) updates[`users/${p.uid}`] = null;
    if (Object.keys(updates).length) await adminDb().ref().update(updates);
    await Promise.all(this.players.map((p) => p.dispose().catch(() => undefined)));
    await Promise.all(this.players.map((p) => adminAuth().deleteUser(p.uid).catch(() => undefined)));
    this.rooms.clear();
    this.players = [];
  }
}

// ---------------------------------------------------------------------------
// Game helpers
// ---------------------------------------------------------------------------

export function ack(res: ApiResult) {
  return res.body as { ok: boolean; code?: string; revision?: number; commandId?: string; view?: unknown };
}

export function viewOf(res: ApiResult): PlayerView {
  const v = normalizePlayerView(res.body.view);
  if (!v) throw new Error(`ไม่มี view ใน response: ${JSON.stringify(res.body).slice(0, 300)}`);
  return v;
}

export function scopedBody(
  view: PlayerView,
  kind: 'self' | 'guess' | 'continue' | 'rematch',
  optionIds?: string[],
): CommandBody {
  const g = view.game!;
  return {
    kind,
    gameId: g.id,
    roundIndex: g.roundIndex,
    expectedPhase: g.phase,
    ...(optionIds ? { optionIds } : {}),
  } as CommandBody;
}

/** แปลง index (อิงลำดับตัวเลือกในคำถาม) เป็น option IDs — คะแนนจึงคำนวณล่วงหน้าได้ไม่ว่าจะสุ่มได้คำถามไหน */
export function pick(view: PlayerView, indices: number[]): string[] {
  const ids = view.game!.question.options.map((o) => o.id);
  return indices.map((i) => ids[i]!);
}
