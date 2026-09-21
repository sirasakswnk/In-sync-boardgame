'use client';

import { useMemo } from 'react';
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
import type { useCommands } from '@/lib/client/useRoom';
import { GameHeader } from '@/features/room/GameHeader';
import { JoinPanel } from '@/features/room/JoinPanel';
import { RoomProblem } from '@/features/room/RoomStates';
import { LobbyView } from '@/features/room/LobbyView';
import { RankStage } from '@/features/room/RankStage';
import { ResultsView } from '@/features/room/ResultsView';
import { RevealView } from '@/features/room/RevealView';
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
  if (screen === 'self') return room;
  scoped(A, 'self', [2, 0, 4, 1, 3]);
  if (screen === 'waiting') return room;
  scoped(B, 'self', [1, 3, 0, 2, 4]);
  if (screen === 'guess') return room;
  scoped(B, 'guess', [2, 0, 1, 4, 3]);
  scoped(A, 'guess', [1, 0, 3, 2, 4]);
  if (screen === 'reveal') return room;

  const plans = [
    [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [4, 3, 2, 1, 0], [1, 0, 2, 3, 4]],
    [[1, 2, 0, 3, 4], [1, 2, 0, 4, 3], [2, 1, 0, 4, 3], [0, 1, 2, 3, 4]],
    [[3, 1, 0, 2, 4], [0, 1, 2, 3, 4], [0, 2, 1, 3, 4], [3, 1, 2, 0, 4]],
    [[0, 1, 2, 3, 4], [0, 4, 3, 2, 1], [0, 3, 4, 2, 1], [4, 3, 2, 1, 0]],
    [[2, 3, 4, 0, 1], [1, 0, 2, 3, 4], [1, 0, 3, 2, 4], [2, 3, 4, 1, 0]],
  ];
  scoped(A, 'continue');
  scoped(B, 'continue');
  for (const [aSelf, bSelf, aGuess, bGuess] of plans) {
    scoped(A, 'self', aSelf);
    scoped(B, 'self', bSelf);
    scoped(A, 'guess', aGuess);
    scoped(B, 'guess', bGuess);
    scoped(A, 'continue');
    scoped(B, 'continue');
  }
  return room;
}

const idleCommands: ReturnType<typeof useCommands> = {
  state: { kind: 'idle' },
  send: async () => false,
  pendingFor: () => null,
  clearError: () => undefined,
};

export function DevPreview({ screen, longNames }: { screen: string; longNames: boolean }) {
  if (screen === 'join') return <JoinPanel code="K7M4QX" onJoin={async () => undefined} />;
  if (screen === 'full') return <RoomProblem code="ROOM_FULL" />;
  return <PreviewRoom screen={screen} longNames={longNames} />;
}

function PreviewRoom({ screen, longNames }: { screen: string; longNames: boolean }) {
  const view = useMemo(() => projectRoomForPlayer(buildRoom(screen, longNames), A)!, [screen, longNames]);
  const stage =
    view.phase === 'GUESS_RANK' ? 'guess' : view.phase === 'REVEAL' || view.phase === 'RESULTS' ? 'reveal' : 'self';

  return (
    <div className={styles.shell} data-stage={stage}>
      <GameHeader view={view} partnerOnline onLeave={() => undefined} />
      <main className={styles.main}>
        {view.phase === 'LOBBY' && <LobbyView view={view} partnerOnline cmds={idleCommands} />}
        {(view.phase === 'SELF_RANK' || view.phase === 'GUESS_RANK') && (
          <RankStage view={view} uid={A} partnerOnline cmds={idleCommands} />
        )}
        {view.phase === 'REVEAL' && <RevealView view={view} partnerOnline cmds={idleCommands} />}
        {view.phase === 'RESULTS' && <ResultsView view={view} partnerOnline cmds={idleCommands} />}
      </main>
    </div>
  );
}
