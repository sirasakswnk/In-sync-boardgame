'use client';

import { onDisconnect, onValue, push, ref, remove, set, type DatabaseReference } from 'firebase/database';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizePlayerView, type Command, type CommandBody, type PlayerView } from '@/lib/game';
import { api, ApiFailure, messageFor, type ClientErrorCode } from './api';
import { clientDb, ensureUser, firebaseConfigured } from './firebase';
import { uuidv4 } from './uuid';

export type RoomStatus =
  | { kind: 'booting' }
  | { kind: 'unconfigured' }
  | { kind: 'join' }
  | { kind: 'error'; code: ClientErrorCode; message: string }
  | { kind: 'ready' };

type SnapshotResponse = { ok: true; roomId: string; code: string; view: unknown };

/**
 * สถานะห้องจากมุมมองของผู้เล่นหนึ่งคน
 *
 * แหล่งความจริงมีสองทาง และใช้ revision ตัดสินว่าอันไหนใหม่กว่า:
 *   1) RTDB listener บน rooms/$roomId/views/$uid (realtime)
 *   2) HTTP snapshot / response ของคำสั่ง (resync เมื่อ listener หลุดหรือ ack หาย)
 * ไม่ใช้ event history ใน browser เป็นแหล่งความจริง (plan.md §11)
 */
export function useRoom(code: string) {
  const [status, setStatus] = useState<RoomStatus>(() =>
    firebaseConfigured() ? { kind: 'booting' } : { kind: 'unconfigured' },
  );
  const [uid, setUid] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [presence, setPresence] = useState<Record<string, Record<string, unknown> | null>>({});
  const [connected, setConnected] = useState(true);
  const viewRef = useRef<PlayerView | null>(null);

  const applyView = useCallback((raw: unknown) => {
    const next = normalizePlayerView(raw);
    if (!next) return;
    const cur = viewRef.current;
    // snapshot ที่เก่ากว่าห้ามทับของใหม่ (plan.md §10.4)
    if (cur && cur.roomId === next.roomId && next.revision < cur.revision) return;
    viewRef.current = next;
    setView(next);
  }, []);

  const refresh = useCallback(async () => {
    const res = await api<SnapshotResponse>(`/api/rooms/${code}`);
    applyView(res.view);
    setRoomId(res.roomId);
    setStatus({ kind: 'ready' });
  }, [code, applyView]);

  // bootstrap: ตัวตน → snapshot ตามสิทธิ์
  useEffect(() => {
    if (!firebaseConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureUser();
        if (cancelled) return;
        setUid(user.uid);
        await refresh();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiFailure && e.code === 'UNAUTHORIZED' && e.body.canJoin) {
          setStatus({ kind: 'join' });
        } else {
          const code: ClientErrorCode = e instanceof ApiFailure ? e.code : 'NETWORK';
          setStatus({ kind: 'error', code, message: messageFor(code) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // realtime: มุมมองของเรา + presence + การเชื่อมต่อของเราเอง
  useEffect(() => {
    if (!roomId || !uid) return;
    const db = clientDb();
    let myConn: DatabaseReference | null = null;
    let everConnected = false;

    const offView = onValue(
      ref(db, `rooms/${roomId}/views/${uid}`),
      (snap) => applyView(snap.val()),
      () => setStatus({ kind: 'error', code: 'ROOM_CLOSED', message: messageFor('ROOM_CLOSED') }),
    );

    const offPresence = onValue(
      ref(db, `rooms/${roomId}/presence`),
      (snap) => setPresence((snap.val() as typeof presence | null) ?? {}),
      () => setPresence({}),
    );

    const offConnected = onValue(ref(db, '.info/connected'), (snap) => {
      const isUp = snap.val() === true;
      setConnected(isUp);
      if (!isUp) return;
      // หนึ่ง connection ต่อแท็บ: ปิดแท็บเดียวไม่ทำให้ offline ถ้าอีกแท็บยังอยู่ (plan.md §13 ข้อ 14)
      myConn = push(ref(db, `rooms/${roomId}/presence/${uid}`));
      const conn = myConn;
      onDisconnect(conn)
        .remove()
        .then(() => set(conn, true))
        .catch(() => undefined);
      // เชื่อมต่อกลับมาหลังหลุด: resync ผ่าน HTTP อีกชั้นเผื่อพลาด event ช่วงหลุด
      if (everConnected) refresh().catch(() => undefined);
      everConnected = true;
    });

    return () => {
      offView();
      offPresence();
      offConnected();
      if (myConn) remove(myConn).catch(() => undefined);
    };
  }, [roomId, uid, applyView, refresh]);

  const partnerOnline = useMemo(() => {
    const partner = view?.partner?.uid;
    if (!partner) return false;
    const conns = presence[partner];
    return Boolean(conns && Object.keys(conns).length > 0);
  }, [presence, view?.partner?.uid]);

  const join = useCallback(async () => {
    const res = await api<SnapshotResponse>(`/api/rooms/${code}/join`, { method: 'POST' });
    applyView(res.view);
    setRoomId(res.roomId);
    setStatus({ kind: 'ready' });
  }, [code, applyView]);

  return { status, uid, view, connected, partnerOnline, refresh, applyView, join };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type CommandState =
  | { kind: 'idle' }
  | { kind: 'sending'; key: string }
  | { kind: 'uncertain'; key: string; message: string }
  | { kind: 'error'; key: string; code: ClientErrorCode; message: string };

/**
 * ส่งคำสั่งเกม
 * - หนึ่ง "เจตนา" (key) ใช้ commandId เดียว: กดซ้ำหรือ retry หลัง timeout จะส่ง commandId เดิม
 *   server จึงคืน ack เดิมโดยไม่คิดคะแนนซ้ำ (plan.md §10.4)
 * - timeout = ยังไม่ทราบผล: resync ก่อน แล้วให้ผู้เล่นกดส่งซ้ำด้วย command เดิม ห้ามสร้างคำตอบใหม่เอง
 */
export function useCommands(code: string, applyView: (raw: unknown) => void, refresh: () => Promise<void>) {
  const [state, setState] = useState<CommandState>({ kind: 'idle' });
  const pending = useRef(new Map<string, Command>());
  const inFlight = useRef(new Set<string>());

  const send = useCallback(
    async (key: string, body: CommandBody): Promise<boolean> => {
      if (inFlight.current.has(key)) return false;
      let cmd = pending.current.get(key);
      if (!cmd) {
        cmd = { ...body, commandId: uuidv4() } as Command;
        pending.current.set(key, cmd);
      }
      inFlight.current.add(key);
      setState({ kind: 'sending', key });
      try {
        const res = await api<{ ok: true; view: unknown }>(`/api/rooms/${code}/commands`, {
          method: 'POST',
          body: cmd,
        });
        pending.current.delete(key);
        applyView(res.view);
        setState({ kind: 'idle' });
        return true;
      } catch (e) {
        const failure = e instanceof ApiFailure ? e : new ApiFailure('NETWORK', 0);
        if (failure.uncertain) {
          setState({ kind: 'uncertain', key, message: failure.message });
          await refresh().catch(() => undefined);
          return false;
        }
        pending.current.delete(key);
        if (failure.body.view) applyView(failure.body.view);
        setState({ kind: 'error', key, code: failure.code, message: failure.message });
        return false;
      } finally {
        inFlight.current.delete(key);
      }
    },
    [code, applyView, refresh],
  );

  /** คำสั่งที่ค้างอยู่ของ key นี้ (เช่น ranking ที่ส่งไปแล้วแต่ยังไม่รู้ผล) */
  const pendingFor = useCallback((key: string) => pending.current.get(key) ?? null, []);
  const clearError = useCallback(() => setState({ kind: 'idle' }), []);

  return { state, send, pendingFor, clearError };
}
