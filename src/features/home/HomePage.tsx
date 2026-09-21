'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProfileFields, type ProfileDraft } from '@/components/ProfileFields';
import { displayNameSchema, roomCodeSchema, type AvatarId } from '@/lib/game';
import { api, ApiFailure } from '@/lib/client/api';
import { ensureUser, firebaseConfigured } from '@/lib/client/firebase';
import { uuidv4 } from '@/lib/client/uuid';
import styles from './HomePage.module.css';

type ProfileResponse = {
  ok: true;
  profile: { displayName: string; avatarId: AvatarId } | null;
  activeRoomCode: string | null;
};

type Busy = null | 'boot' | 'create' | 'join' | 'leave';

export function HomePage() {
  const router = useRouter();
  const [configured] = useState(firebaseConfigured);
  const [busy, setBusy] = useState<Busy>(configured ? 'boot' : null);
  const [profile, setProfile] = useState<ProfileDraft>({ displayName: '', avatarId: 'cat' });
  const [nameError, setNameError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureUser();
        const res = await api<ProfileResponse>('/api/profile');
        if (cancelled) return;
        if (res.profile) setProfile(res.profile);
        setActiveRoom(res.activeRoomCode);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'เชื่อมต่อไม่สำเร็จ');
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function saveProfile(): Promise<boolean> {
    const parsed = displayNameSchema.safeParse(profile.displayName);
    if (!parsed.success) {
      setNameError('ตั้งชื่อเล่น 1–20 ตัวอักษรก่อนนะ');
      return false;
    }
    setNameError(null);
    try {
      await api('/api/profile', { method: 'POST', body: { displayName: parsed.data, avatarId: profile.avatarId } });
      return true;
    } catch (e) {
      handleFailure(e);
      return false;
    }
  }

  function handleFailure(e: unknown) {
    if (e instanceof ApiFailure && e.code === 'ALREADY_IN_ROOM' && typeof e.body.activeCode === 'string') {
      setActiveRoom(e.body.activeCode);
      setError(e.message);
      return;
    }
    setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองอีกครั้ง');
  }

  async function createRoom() {
    setError(null);
    setBusy('create');
    try {
      if (!(await saveProfile())) return;
      const res = await api<{ ok: true; code: string }>('/api/rooms', { method: 'POST' });
      router.push(`/room/${res.code}`);
    } catch (e) {
      handleFailure(e);
    } finally {
      setBusy(null);
    }
  }

  async function joinRoom(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError('รหัสห้องมี 6 ตัว (ตัวอักษรภาษาอังกฤษและตัวเลข)');
      return;
    }
    setCodeError(null);
    setBusy('join');
    try {
      if (!(await saveProfile())) return;
      await api(`/api/rooms/${parsed.data}/join`, { method: 'POST' });
      router.push(`/room/${parsed.data}`);
    } catch (err) {
      handleFailure(err);
    } finally {
      setBusy(null);
    }
  }

  async function leaveActive() {
    if (!activeRoom) return;
    setBusy('leave');
    try {
      await api(`/api/rooms/${activeRoom}/commands`, {
        method: 'POST',
        body: { commandId: uuidv4(), kind: 'leave' },
      });
      setActiveRoom(null);
      setError(null);
    } catch (e) {
      // ห้องปิด/หมดอายุไปแล้วก็ถือว่าออกได้
      if (e instanceof ApiFailure && (e.code === 'ROOM_CLOSED' || e.code === 'ROOM_NOT_FOUND')) setActiveRoom(null);
      else handleFailure(e);
    } finally {
      setBusy(null);
      setConfirmLeave(false);
    }
  }

  const locked = busy !== null || !configured;

  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.logo} aria-hidden="true">
          <span className={`${styles.miniCard} ${styles.cardA}`}>🍜</span>
          <span className={`${styles.miniCard} ${styles.cardB}`}>🎮</span>
          <span className={`${styles.miniCard} ${styles.cardC}`}>🌅</span>
          <span className={styles.heart}>💞</span>
        </div>
        <h1 className={styles.title}>ใจตรงกันแค่ไหน</h1>
        <p className={styles.tagline}>เกมจัดอันดับสำหรับสองคน เรียงสิ่งที่คุณชอบ ทายใจอีกคน แล้วเปิดเฉลยพร้อมกัน</p>

        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <span>
              <strong>จัดอันดับของคุณ</strong>
              <small>เรียงการ์ด 5 ใบตามใจตัวเอง</small>
            </span>
          </li>
          <li>
            <span className={`${styles.stepNum} ${styles.stepGuess}`}>2</span>
            <span>
              <strong>ทายใจคู่หู</strong>
              <small>คิดว่าอีกคนเรียงแบบไหน</small>
            </span>
          </li>
          <li>
            <span className={`${styles.stepNum} ${styles.stepReveal}`}>3</span>
            <span>
              <strong>เปิดเฉลยพร้อมกัน</strong>
              <small>ดูว่ารู้ใจกันแค่ไหน แล้วคุยกันต่อ</small>
            </span>
          </li>
        </ol>
      </section>

      <section className={styles.panel} aria-label="เริ่มเล่น">
        {!configured && (
          <Banner tone="warn">
            ยังไม่ได้ตั้งค่า Firebase ให้เว็บนี้ ดูขั้นตอนใน README หัวข้อ “ตั้งค่า Firebase” แล้วรีสตาร์ตเซิร์ฟเวอร์
          </Banner>
        )}

        {activeRoom && (
          <Banner
            tone="info"
            icon="🚪"
            action={
              <div className={styles.activeActions}>
                <Button variant="primary" onClick={() => router.push(`/room/${activeRoom}`)} disabled={busy !== null}>
                  กลับเข้าห้อง
                </Button>
                <Button variant="ghost" onClick={() => setConfirmLeave(true)} disabled={busy !== null}>
                  ออกจากห้องเดิม
                </Button>
              </div>
            }
          >
            คุณมีห้องที่ค้างอยู่ รหัส <strong className={styles.code}>{activeRoom}</strong>
          </Banner>
        )}

        {error && (
          <Banner tone="error" live>
            {error}
          </Banner>
        )}

        <ProfileFields value={profile} onChange={setProfile} error={nameError} disabled={locked} />

        <Button block onClick={createRoom} loading={busy === 'create'} disabled={locked || Boolean(activeRoom)}>
          สร้างห้องใหม่
        </Button>

        <div className={styles.divider}>
          <span>หรือเข้าห้องของเพื่อน</span>
        </div>

        <form className={styles.joinForm} onSubmit={joinRoom} noValidate>
          <label htmlFor="room-code" className="visually-hidden">
            รหัสห้อง 6 ตัว
          </label>
          <input
            id="room-code"
            className={styles.codeInput}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="รหัสห้อง"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            disabled={locked}
            aria-invalid={Boolean(codeError) || undefined}
            aria-describedby={codeError ? 'code-error' : undefined}
          />
          <Button type="submit" variant="secondary" loading={busy === 'join'} disabled={locked}>
            เข้าห้อง
          </Button>
        </form>
        {codeError && (
          <p id="code-error" className={styles.fieldError} role="alert">
            {codeError}
          </p>
        )}

        <p className={styles.note}>
          เกมนี้ไม่มีแชตหรือเสียงในตัว คุยกันต่อหน้าหรือโทรหากันระหว่างเล่นได้เลย · เล่นได้ครั้งละสองคนต่อห้อง
        </p>
      </section>

      <ConfirmDialog
        open={confirmLeave}
        title="ออกจากห้องเดิม?"
        body="การออกจากห้องจะปิดห้องนั้นสำหรับทั้งสองคน และความคืบหน้าของเกมในห้องนั้นจะจบลง"
        confirmLabel="ออกและปิดห้อง"
        busy={busy === 'leave'}
        onConfirm={leaveActive}
        onCancel={() => setConfirmLeave(false)}
      />
    </main>
  );
}
