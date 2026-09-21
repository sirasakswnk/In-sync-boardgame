import { describe, expect, it } from 'vitest';
import {
  buildViews,
  normalizePlayerView,
  normalizeRoomState,
  type RoomState,
} from '@/lib/game';
import { A, B, IDENTITY, REVERSED, Table, expectOk } from './helpers';

/** จำลองพฤติกรรม RTDB: ทิ้ง null / object ว่าง / array ว่าง และเก็บ array เป็น object key ตัวเลข */
function rtdbize(value: unknown, asObjects = false): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const items = value.map((v) => rtdbize(v, asObjects));
    if (items.length === 0) return undefined;
    if (!asObjects) return items;
    return Object.fromEntries(items.map((v, i) => [String(i), v]));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const r = rtdbize(v, asObjects);
      if (r !== undefined) out[k] = r;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

function snapshots(): Array<[string, RoomState]> {
  const out: Array<[string, RoomState]> = [];
  const t = new Table();
  out.push(['LOBBY', structuredClone(t.room)]);
  t.startGame();
  out.push(['SELF_RANK', structuredClone(t.room)]);
  expectOk(t.scoped(A, 'self', t.optionIds()));
  out.push(['GUESS_RANK', structuredClone(t.room)]);
  expectOk(t.scoped(B, 'guess', t.optionIds()));
  out.push(['REVEAL', structuredClone(t.room)]);
  t.advance();
  out.push(['SELF_RANK รอบ 2 (สลับบทบาท)', structuredClone(t.room)]);
  for (let i = 1; i < 6; i++) {
    t.playRound({ self: IDENTITY, guess: i % 2 ? REVERSED : IDENTITY });
    t.advance();
  }
  out.push(['RESULTS', structuredClone(t.room)]);
  return out;
}

describe('normalize — กู้รูปร่างหลังผ่าน RTDB', () => {
  for (const [label, room] of snapshots()) {
    for (const asObjects of [false, true]) {
      const mode = asObjects ? 'array→object' : 'array คงเดิม';
      it(`RoomState ${label} (${mode})`, () => {
        expect(normalizeRoomState(rtdbize(room, asObjects))).toEqual(room);
      });

      it(`PlayerView ${label} (${mode})`, () => {
        for (const view of Object.values(buildViews(room))) {
          expect(normalizePlayerView(rtdbize(view, asObjects))).toEqual(view);
        }
      });
    }
  }

  it('ห้องจากเวอร์ชันก่อนผลัดเทิร์น (ไม่มี setterUid/guesserUid) ได้บทบาทตามที่นั่ง', () => {
    const t = new Table();
    t.startGame();
    const legacy = structuredClone(t.room) as unknown as {
      game: { rounds: Array<Record<string, unknown>> };
    };
    for (const round of legacy.game.rounds) {
      delete round.setterUid;
      delete round.guesserUid;
    }
    const restored = normalizeRoomState(rtdbize(legacy))!;
    expect(restored.game!.rounds.map((r) => r.setterUid)).toEqual([A, B, A, B, A, B]);
    expect(restored.game!.rounds.map((r) => r.guesserUid)).toEqual([B, A, B, A, B, A]);
  });

  it('ข้อมูลว่าง/ผิดรูปได้ null', () => {
    expect(normalizeRoomState(null)).toBeNull();
    expect(normalizePlayerView(undefined)).toBeNull();
    expect(normalizePlayerView({ revision: 1 })).toBeNull();
  });
});
