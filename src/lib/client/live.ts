'use client';

import { onValue, ref, set } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { asArray } from '@/lib/game';
import { clientDb, firebaseConfigured } from './firebase';

/**
 * คำทายระหว่างเรียงของคนทาย ส่งตรงผ่าน RTDB ที่ /live/$roomId/$uid
 *
 * - ใช้แค่ให้คนวางดูสด ไม่มีผลกับคะแนน: คะแนนมาจากคำสั่ง `guess` ที่ server ตรวจเท่านั้น
 * - rules อนุญาตให้เขียนเฉพาะคนทายของรอบ ในช่วง GUESS_RANK และ key ต้องตรงรอบปัจจุบัน
 */

/** `receivedAt` เป็นเวลาในเครื่องนี้ตอนได้รับ — ไม่พึ่งนาฬิกาของอีกเครื่อง */
export type LiveOrder = { order: string[]; receivedAt: number };

const THROTTLE_MS = 120;

/** ฝั่งคนทาย: ส่งลำดับล่าสุดแบบ throttle — ค่าสุดท้ายถูกส่งเสมอ */
export function useLivePublisher(roomId: string | null, uid: string | null, liveKey: string, enabled: boolean) {
  const lastSent = useRef(0);
  const pending = useRef<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (order: string[]) => {
    if (!enabled || !roomId || !uid || !firebaseConfigured()) return;
    pending.current = order;
    const flush = () => {
      timer.current = null;
      const next = pending.current;
      if (!next) return;
      pending.current = null;
      lastSent.current = Date.now();
      // ส่งไม่ผ่าน (เช่นเพิ่งล็อกคำทาย/phase เปลี่ยน) ไม่ใช่ปัญหา — เป็นแค่ภาพสด
      set(ref(clientDb(), `live/${roomId}/${uid}`), { key: liveKey, order: next, at: Date.now() }).catch(
        () => undefined,
      );
    };
    const wait = THROTTLE_MS - (Date.now() - lastSent.current);
    if (wait <= 0) flush();
    else timer.current ??= setTimeout(flush, wait);
  };
}

/** ฝั่งคนวาง: ฟังคำทายสดของรอบปัจจุบัน ค่าที่ key ไม่ตรงรอบถูกทิ้ง */
export function useLiveOrder(roomId: string | null, guesserUid: string, liveKey: string): LiveOrder | null {
  const [live, setLive] = useState<{ key: string; value: LiveOrder } | null>(null);

  useEffect(() => {
    if (!roomId || !guesserUid || !firebaseConfigured()) return;
    return onValue(
      ref(clientDb(), `live/${roomId}/${guesserUid}`),
      (snap) => {
        const raw = snap.val() as { key?: unknown; order?: unknown } | null;
        if (!raw || typeof raw.key !== 'string') return setLive(null);
        setLive({ key: raw.key, value: { order: asArray<string>(raw.order), receivedAt: Date.now() } });
      },
      () => setLive(null),
    );
  }, [roomId, guesserUid]);

  return live && live.key === liveKey ? live.value : null;
}
