'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useCommands, useRoom } from '@/lib/client/useRoom';
import { GameHeader } from './GameHeader';
import { JoinPanel } from './JoinPanel';
import { LobbyView } from './LobbyView';
import { RankStage } from './RankStage';
import { ResultsView } from './ResultsView';
import { RevealView } from './RevealView';
import { RoomLoading, RoomProblem } from './RoomStates';
import { WaitingTurn } from './WaitingTurn';
import { WatchGuess } from './WatchGuess';
import styles from './room.module.css';

/**
 * หน้าห้อง: render ตาม phase ที่ server ส่งมาเท่านั้น
 * ไม่เชื่อ URL หรือ storage ว่าอนุญาตให้เห็นหน้าเฉลยแล้ว (plan.md §6.2)
 */
export function RoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const room = useRoom(code);
  const cmds = useCommands(code, room.applyView, room.refresh);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { status, view, uid } = room;

  if (status.kind === 'booting') return <RoomLoading />;
  if (status.kind === 'unconfigured') {
    return (
      <RoomProblem
        emoji="🛠️"
        title="ยังไม่ได้ตั้งค่า Firebase"
        message="ผู้ดูแลต้องตั้งค่า Firebase ตาม README ก่อนจึงจะเล่นได้"
      />
    );
  }
  if (status.kind === 'join') return <JoinPanel code={code} onJoin={room.join} />;
  if (status.kind === 'error') return <RoomProblem code={status.code} message={status.message} />;
  if (!view || !uid) return <RoomLoading />;
  if (view.status === 'CLOSED') return <RoomProblem code="ROOM_CLOSED" />;

  async function leave() {
    setLeaving(true);
    const ok = await cmds.send('leave', { kind: 'leave' });
    setLeaving(false);
    if (ok) router.push('/');
    else setConfirmLeave(false);
  }

  const partnerName = view.partner?.displayName ?? 'คู่หู';
  const inGame = view.phase !== 'LOBBY';
  const stage =
    view.phase === 'GUESS_RANK' ? 'guess' : view.phase === 'REVEAL' || view.phase === 'RESULTS' ? 'reveal' : 'self';
  // ผลัดเทิร์น: SELF_RANK เป็นตาคนวาง, GUESS_RANK เป็นตาคนทาย — อีกคนเห็นหน้ารอ/หน้าดูสด
  const myTurnToRank =
    (view.phase === 'SELF_RANK' && view.game?.role === 'setter') ||
    (view.phase === 'GUESS_RANK' && view.game?.role === 'guesser');

  return (
    // ธีมโต๊ะบอร์ดเกม: ผ้าสักหลาด ขอบไม้ ไพ่ขอบขาว (ดู globals.css [data-skin='table'])
    <div className={styles.shell} data-stage={stage} data-skin="table">
      <GameHeader view={view} partnerOnline={room.partnerOnline} onLeave={() => setConfirmLeave(true)} />

      <main className={styles.main}>
        <div className={styles.banners}>
          {!room.connected && (
            <Banner tone="warn" icon="📡" live>
              การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่… สิ่งที่ส่งสำเร็จแล้วยังอยู่ครบ
            </Banner>
          )}
          {view.partner && !room.partnerOnline && inGame && view.phase !== 'RESULTS' && (
            <Banner tone="warn" icon="💤" live>
              {partnerName} หลุดการเชื่อมต่ออยู่ — เกมจะเดินต่อได้เมื่อ {partnerName} กลับมา
            </Banner>
          )}
          {cmds.state.kind === 'error' && cmds.state.code !== 'WRONG_PHASE' && (
            <Banner
              tone="error"
              live
              action={
                <Button variant="ghost" onClick={cmds.clearError}>
                  ปิด
                </Button>
              }
            >
              {cmds.state.message}
            </Banner>
          )}
        </div>

        {view.phase === 'LOBBY' && <LobbyView view={view} partnerOnline={room.partnerOnline} cmds={cmds} />}
        {myTurnToRank && (
          <RankStage key={`${view.game!.id}:${view.game!.roundIndex}:${view.phase}`} view={view} uid={uid} partnerOnline={room.partnerOnline} cmds={cmds} variant="board" />
        )}
        {view.phase === 'SELF_RANK' && view.game!.role === 'guesser' && (
          <WaitingTurn view={view} partnerOnline={room.partnerOnline} />
        )}
        {view.phase === 'GUESS_RANK' && view.game!.role === 'setter' && (
          <WatchGuess key={view.game!.liveKey} view={view} partnerOnline={room.partnerOnline} variant="board" />
        )}
        {view.phase === 'REVEAL' && (
          <RevealView key={`${view.game!.id}:${view.game!.roundIndex}`} view={view} partnerOnline={room.partnerOnline} cmds={cmds} />
        )}
        {view.phase === 'RESULTS' && <ResultsView view={view} partnerOnline={room.partnerOnline} cmds={cmds} />}
      </main>

      <footer className={styles.footer}>
        <Link href="/">หน้าหลัก</Link>
        <span aria-hidden="true">·</span>
        <span>คุยกันต่อหน้าหรือโทรหากันระหว่างเล่นได้เลย</span>
      </footer>

      <ConfirmDialog
        open={confirmLeave}
        title="ออกจากห้อง?"
        body={`การออกจะปิดห้องนี้สำหรับทั้งคุณและ${view.partner ? partnerName : 'ผู้ที่จะเข้ามา'} และเกมที่เล่นอยู่จะจบลงทันที`}
        confirmLabel="ออกและปิดห้อง"
        busy={leaving}
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
