'use client';

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  applyCommand,
  createRoomState,
  DEFAULT_CATEGORIES,
  getQuestionBank,
  joinRoom,
  projectRoomForPlayer,
  type CommandBody,
  type RoomState,
} from '@/lib/game';
import type { CommandState, useCommands } from '@/lib/client/useRoom';
import { GameHeader } from '@/features/room/GameHeader';
import { JoinPanel } from '@/features/room/JoinPanel';
import { RoomProblem } from '@/features/room/RoomStates';
import { LobbyView } from '@/features/room/LobbyView';
import { RankStage } from '@/features/room/RankStage';
import { ResultsView } from '@/features/room/ResultsView';
import { RevealView } from '@/features/room/RevealView';
import { WaitingTurn } from '@/features/room/WaitingTurn';
import { WatchGuess } from '@/features/room/WatchGuess';
import styles from '@/features/room/room.module.css';

const A = 'preview-you';
const B = 'preview-partner';
const NOW = Date.UTC(2026, 8, 21, 12);

/** เดินเกมด้วย reducer จริงจนถึงหน้าที่ต้องการ แล้วฉายมุมมองของ "คุณ" ด้วย projection จริง */
function buildRoom(screen: string, longNames: boolean): RoomState {
  let room = createRoomState({
    roomId: 'preview',
    code: 'K7M4QX',
    host: { uid: A, displayName: longNames ? 'พรรณนภาสุขสวัสดิ์ดีมาก' : 'มะปราง', avatarId: 'bunny' },
    categories: DEFAULT_CATEGORIES,
    now: NOW,
  });
  if (screen === 'lobby-empty') return room;
  const joined = joinRoom(room, { uid: B, displayName: longNames ? 'ธนกฤตวรวิทย์เจริญสุข' : 'ต้นกล้า', avatarId: 'fox' }, NOW);
  if (!joined.ok) throw new Error(joined.code);
  room = joined.room;

  let n = 0;
  const run = (uid: string, body: CommandBody) => {
    const res = applyCommand(room, { ...body, commandId: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` } as never, {
      uid,
      now: NOW,
      onlineUids: [A, B],
      bank: getQuestionBank(),
      seed: 'preview',
      newGameId: 'preview-game',
      payloadHash: String(n),
    });
    if (!res.ack.ok) throw new Error(`${body.kind}: ${res.ack.code}`);
    room = res.room;
  };
  const scoped = (uid: string, kind: 'self' | 'guess' | 'continue', idx?: number[]) => {
    const g = room.game!;
    const ids = g.rounds[g.roundIndex]!.question.options.map((o) => o.id);
    run(uid, {
      kind,
      gameId: g.id,
      roundIndex: g.roundIndex,
      expectedPhase: g.phase,
      ...(idx ? { optionIds: idx.map((i) => ids[i]!) } : {}),
    } as CommandBody);
  };

  run(A, { kind: 'ready', ready: true });
  if (screen === 'lobby') return room;
  run(B, { kind: 'ready', ready: true });
  run(A, { kind: 'start' });
  // รอบ 1: A (host) วาง, B ทาย
  if (screen === 'self' || screen === 'waiting') return room;
  scoped(A, 'self', [2, 0, 4, 1, 3]);
  if (screen === 'guess' || screen === 'watch') return room;
  scoped(B, 'guess', [2, 0, 1, 4, 3]);
  if (screen === 'reveal' || screen === 'reveal-guesser') return room;

  // [ลำดับของคนวาง, คำทาย] รอบ 2–6 — คนวางสลับ B, A, B, A, B
  const plans = [
    [[4, 3, 2, 1, 0], [1, 0, 2, 3, 4]],
    [[1, 2, 0, 3, 4], [2, 1, 0, 4, 3]],
    [[0, 1, 2, 3, 4], [3, 1, 2, 0, 4]],
    [[0, 4, 3, 2, 1], [0, 3, 4, 2, 1]],
    [[2, 3, 4, 0, 1], [2, 3, 4, 1, 0]],
  ];
  scoped(A, 'continue');
  for (const [setterOrder, guessOrder] of plans) {
    const { setterUid, guesserUid } = room.game!.rounds[room.game!.roundIndex]!;
    scoped(setterUid, 'self', setterOrder);
    scoped(guesserUid, 'guess', guessOrder);
    scoped(setterUid, 'continue');
  }
  return room;
}

/** หน้าที่ดูจากมุมของคนทาย (B) — ที่เหลือดูจากมุมของ A */
const GUESSER_SCREENS = new Set(['waiting', 'guess', 'reveal-guesser']);

const idleCommands: ReturnType<typeof useCommands> = {
  state: { kind: 'idle' },
  send: async () => false,
  pendingFor: () => null,
  clearError: () => undefined,
};

/**
 * จำลองการส่งคำสั่งสำหรับ /dev/preview (?submit=fail|slow)
 * กำลังส่ง 1.5 วินาที แล้ว fail = error แบบเดียวกับ useCommands จริง (ล้าง pending) · slow = ค้างสถานะส่ง
 */
function usePreviewCommands(mode: string | undefined): ReturnType<typeof useCommands> {
  const [state, setState] = useState<CommandState>({ kind: 'idle' });
  const pending = useRef(new Map<string, CommandBody>());
  const sent = useRef(0);
  const send = useCallback(
    async (key: string, body: CommandBody) => {
      if (pending.current.has(key)) return false;
      pending.current.set(key, body);
      sent.current += 1;
      document.documentElement.dataset.previewSends = String(sent.current);
      setState({ kind: 'sending', key });
      if (mode === 'slow') return false;
      await new Promise((r) => setTimeout(r, 1500));
      pending.current.delete(key);
      setState({ kind: 'error', key, code: 'NETWORK', message: 'ส่งไม่สำเร็จ (จำลอง) ลองอีกครั้ง' });
      return false;
    },
    [mode],
  );
  const pendingFor = useCallback((key: string) => (pending.current.get(key) as never) ?? null, []);
  const clearError = useCallback(() => setState({ kind: 'idle' }), []);
  return { state, send, pendingFor, clearError };
}

/** `skin` = ธีมทดลอง (เช่น 'table' = โต๊ะบอร์ดเกม) ใส่เป็น data-skin บน shell */
export function DevPreview({
  screen,
  longNames,
  skin,
  submit,
}: {
  screen: string;
  longNames: boolean;
  skin?: string;
  submit?: string;
}) {
  if (screen === 'join') return <JoinPanel code="K7M4QX" onJoin={async () => undefined} />;
  if (screen === 'full') return <RoomProblem code="ROOM_FULL" />;
  return <PreviewRoom screen={screen} longNames={longNames} skin={skin} submit={submit} />;
}

const noSubscribe = () => () => undefined;

function PreviewRoom(props: { screen: string; longNames: boolean; skin?: string; submit?: string }) {
  // หน้าจริงเรนเดอร์หน้าห้องฝั่ง browser เท่านั้น (ต้องมีตัวตนก่อน) — preview ทำแบบเดียวกัน
  // เพื่อให้ draft ใน sessionStorage อ่านได้ตั้งแต่ render แรกโดยไม่ hydration mismatch
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  return mounted ? <PreviewRoomInner {...props} /> : null;
}

function PreviewRoomInner({
  screen,
  longNames,
  skin,
  submit,
}: {
  screen: string;
  longNames: boolean;
  skin?: string;
  submit?: string;
}) {
  const simulated = usePreviewCommands(submit);
  const cmds = submit ? simulated : idleCommands;
  const viewer = GUESSER_SCREENS.has(screen) ? B : A;
  const view = useMemo(
    () => projectRoomForPlayer(buildRoom(screen, longNames), viewer)!,
    [screen, longNames, viewer],
  );
  const stage =
    view.phase === 'GUESS_RANK' ? 'guess' : view.phase === 'REVEAL' || view.phase === 'RESULTS' ? 'reveal' : 'self';
  const role = view.game?.role;
  const ranking =
    (view.phase === 'SELF_RANK' && role === 'setter') || (view.phase === 'GUESS_RANK' && role === 'guesser');
  const ids = view.game?.question.options.map((o) => o.id) ?? [];
  // ธีมโต๊ะบอร์ดเกมใช้ช่องเรียงแบบไพ่ในมือ + แท่นอันดับ
  const variant = skin === 'table' ? 'board' : 'list';

  return (
    <div className={styles.shell} data-stage={stage} data-skin={skin}>
      <GameHeader view={view} partnerOnline onLeave={() => undefined} />
      <main className={styles.main}>
        {view.phase === 'LOBBY' && <LobbyView view={view} partnerOnline cmds={idleCommands} />}
        {ranking && <RankStage view={view} uid={viewer} partnerOnline cmds={cmds} variant={variant} />}
        {view.phase === 'SELF_RANK' && role === 'guesser' && <WaitingTurn view={view} partnerOnline />}
        {view.phase === 'GUESS_RANK' && role === 'setter' && (
          <WatchGuess
            view={view}
            partnerOnline
            variant={variant}
            // แบบแท่นแสดงสถานะกำลังวาง (ว่าง 2 ช่อง)
            demoOrder={variant === 'board' ? [ids[1]!, '', ids[3]!, ids[2]!, ''] : [ids[1]!, ids[0]!, ids[3]!, ids[2]!, ids[4]!]}
          />
        )}
        {view.phase === 'REVEAL' && <RevealView view={view} partnerOnline cmds={idleCommands} />}
        {view.phase === 'RESULTS' && <ResultsView view={view} partnerOnline cmds={idleCommands} />}
      </main>
    </div>
  );
}
