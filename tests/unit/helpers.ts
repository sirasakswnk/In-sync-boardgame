import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  applyCommand,
  createRoomState,
  DEFAULT_CATEGORIES,
  getQuestionBank,
  joinRoom,
  type Ack,
  type Command,
  type CommandBody,
  type ReducerCtx,
  type RoomState,
} from '@/lib/game';

export const A = 'uid-alice';
export const B = 'uid-bob';
export const C = 'uid-carol';

export const T0 = Date.UTC(2026, 8, 21, 12, 0, 0);

/** ห่อ reducer ให้ทดสอบง่าย: เก็บ room ล่าสุด และจำลอง presence */
export class Table {
  room: RoomState;
  now = T0;
  online = new Set<string>([A, B]);
  private gameCounter = 0;

  constructor(seed = 'test-seed') {
    this.seed = seed;
    this.room = createRoomState({
      roomId: 'room-1',
      code: 'ABCDEF',
      host: { uid: A, displayName: 'อลิซ', avatarId: 'cat' },
      categories: DEFAULT_CATEGORIES,
      now: this.now,
    });
    const joined = joinRoom(this.room, { uid: B, displayName: 'บ็อบ', avatarId: 'dog' }, this.now);
    if (!joined.ok) throw new Error('join failed');
    this.room = joined.room;
  }

  readonly seed: string;

  ctx(uid: string, payloadHash: string): ReducerCtx {
    return {
      uid,
      now: this.now,
      onlineUids: [...this.online],
      bank: getQuestionBank(),
      seed: this.seed,
      newGameId: `game-${this.gameCounter + 1}`,
      payloadHash,
    };
  }

  /** ส่งคำสั่งแบบ raw — ใช้ทดสอบ commandId ซ้ำ/payload ต่าง */
  send(uid: string, cmd: Command): Ack {
    const hash = JSON.stringify({ ...cmd, commandId: undefined });
    const before = this.room.game?.id;
    const res = applyCommand(this.room, cmd, this.ctx(uid, hash));
    this.room = res.room;
    if (this.room.game && this.room.game.id !== before) this.gameCounter++;
    return res.ack;
  }

  cmd(uid: string, body: CommandBody): Ack {
    return this.send(uid, { ...body, commandId: randomUUID() } as Command);
  }

  /** คำสั่งที่ผูกกับเกม/รอบปัจจุบันอัตโนมัติ */
  scoped(uid: string, kind: 'self' | 'guess' | 'continue' | 'rematch', optionIds?: string[]): Ack {
    const g = this.room.game!;
    const body = {
      kind,
      gameId: g.id,
      roundIndex: g.roundIndex,
      expectedPhase: g.phase,
      ...(optionIds ? { optionIds } : {}),
    } as CommandBody;
    return this.cmd(uid, body);
  }

  get game() {
    return this.room.game!;
  }

  get round() {
    return this.game.rounds[this.game.roundIndex]!;
  }

  optionIds(): string[] {
    return this.round.question.options.map((o) => o.id);
  }

  startGame(): void {
    expectOk(this.cmd(A, { kind: 'ready', ready: true }));
    expectOk(this.cmd(B, { kind: 'ready', ready: true }));
    expectOk(this.cmd(A, { kind: 'start' }));
  }

  get setter(): string {
    return this.round.setterUid;
  }

  get guesser(): string {
    return this.round.guesserUid;
  }

  /** เล่นหนึ่งเทิร์นจนถึง REVEAL: คนวางส่งลำดับตัวเอง แล้วคนทายส่งคำทาย (index ของ option) */
  playRound(order: { self: number[]; guess: number[] }): void {
    const ids = this.optionIds();
    const pick = (idx: number[]) => idx.map((i) => ids[i]!);
    expectOk(this.scoped(this.setter, 'self', pick(order.self)));
    expectOk(this.scoped(this.guesser, 'guess', pick(order.guess)));
  }

  /** คนวางของรอบนี้กดไปต่อ */
  advance(): void {
    expectOk(this.scoped(this.setter, 'continue'));
  }
}

export function expectOk(ack: Ack): asserts ack is Extract<Ack, { ok: true }> {
  if (!ack.ok) throw new Error(`คาดว่าสำเร็จ แต่ได้ ${ack.code}: ${ack.message}`);
  expect(ack.ok).toBe(true);
}

export function expectError(ack: Ack, code: string): void {
  expect(ack.ok).toBe(false);
  if (!ack.ok) expect(ack.code).toBe(code);
}

export const IDENTITY = [0, 1, 2, 3, 4];
export const REVERSED = [4, 3, 2, 1, 0];
