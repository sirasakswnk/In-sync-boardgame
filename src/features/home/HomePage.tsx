'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProfileFields, type ProfileDraft } from '@/components/ProfileFields';
import { displayNameSchema, roomCodeSchema, type AvatarId } from '@/lib/game';
import { api, ApiFailure } from '@/lib/client/api';
import { ensureUser, firebaseConfigured } from '@/lib/client/firebase';
import { uuidv4 } from '@/lib/client/uuid';
import { TableScene } from './TableScene';
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
  const [helpOpen, setHelpOpen] = useState(false);

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
    <div className={styles.page}>
      <main className={styles.home}>
        <div className={styles.topline}>
          <span>
            <span className={styles.tinyHeart} aria-hidden="true">
              ♥♥
            </span>
            IN SYNC
          </span>
          <button type="button" className={styles.helpButton} aria-label="วิธีเล่น" onClick={() => setHelpOpen(true)}>
            ?
          </button>
        </div>

        <header className={styles.brand}>
          <p className={styles.eyebrow}>โต๊ะนี้มีที่ให้เราสองคน</p>
          <h1>
            IN <span className={styles.accent}>SYNC</span>
            <span className={styles.miniHeart} aria-hidden="true">
              ♥
            </span>
          </h1>
          <p className={styles.tagline}>คิดว่ารู้ใจเพื่อนแค่ไหน? มาลองกัน</p>
          <span className={styles.star} aria-hidden="true">
            ✧
          </span>
        </header>

        <TableScene />

        <p className={styles.sceneCaption}>ลองแตะไพ่ดูสิ…คุณจะเลือกอะไรเป็นอันดับ 1?</p>
        <ol className={styles.steps} aria-label="วิธีเล่นสามขั้นตอน">
          <li className={styles.step}>
            <span className={styles.num}>1</span>จัดอันดับ
          </li>
          <li className={styles.arrow} aria-hidden="true">
            →
          </li>
          <li className={`${styles.step} ${styles.stepGuess}`}>
            <span className={styles.num}>2</span>ทายใจ
          </li>
          <li className={styles.arrow} aria-hidden="true">
            →
          </li>
          <li className={`${styles.step} ${styles.stepReveal}`}>
            <span className={styles.num}>3</span>เปิดเฉลย
          </li>
        </ol>

        <section className={styles.setup} aria-labelledby="setup-title">
          <h2 className={styles.setupTitle} id="setup-title">
            เตรียมตัวเข้าโต๊ะ
          </h2>
          <p className={styles.setupSub}>เลือกตัวคุณ แล้วชวนคนที่อยากรู้ใจมาเล่น</p>

          {!configured && (
            <Banner tone="warn">
              ยังไม่ได้ตั้งค่า Firebase ให้เว็บนี้ ดูขั้นตอนใน README หัวข้อ “ตั้งค่า Firebase” แล้วรีสตาร์ตเซิร์ฟเวอร์
            </Banner>
          )}

          {activeRoom && (
            // ห้องที่ค้างอยู่: ใบโน้ตบนโต๊ะ รหัสเป็นตัวต่อไม้ แล้วเลือกกลับเข้าห้องหรือออก
            <div className={styles.activeSlip} role="status">
              <p className={styles.activeTitle}>
                <span aria-hidden="true">🚪</span> มีโต๊ะที่คุณเล่นค้างไว้
              </p>
              <p className={styles.activeTiles} aria-label={`รหัสห้อง ${activeRoom.split('').join(' ')}`}>
                {activeRoom.split('').map((ch, i) => (
                  <span key={i} className={styles.activeTile} aria-hidden="true">
                    {ch}
                  </span>
                ))}
              </p>
              <div className={styles.activeActions}>
                <button
                  type="button"
                  className={styles.activeBack}
                  onClick={() => router.push(`/room/${activeRoom}`)}
                  disabled={busy !== null}
                >
                  กลับเข้าห้อง →
                </button>
                <button type="button" className={styles.activeLeave} onClick={() => setConfirmLeave(true)} disabled={busy !== null}>
                  ออกจากห้องเดิม
                </button>
              </div>
            </div>
          )}

          {error && (
            <Banner tone="error" live>
              {error}
            </Banner>
          )}

          <ProfileFields value={profile} onChange={setProfile} error={nameError} disabled={locked} look="table" />

          <button
            type="button"
            className={styles.primary}
            onClick={createRoom}
            disabled={locked || Boolean(activeRoom)}
            aria-busy={busy === 'create' || undefined}
          >
            <span className={styles.plus} aria-hidden="true">
              {busy === 'create' ? '…' : '＋'}
            </span>
            สร้างห้องใหม่
          </button>

          <div className={styles.divider}>หรือเข้าห้องของเพื่อน</div>

          <form className={styles.joinRow} onSubmit={joinRoom} noValidate>
            <input
              id="room-code"
              className={styles.joinInput}
              aria-label="รหัสห้องของเพื่อน"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ใส่รหัสห้อง"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={locked}
              aria-invalid={Boolean(codeError) || undefined}
              aria-describedby={codeError ? 'code-error' : undefined}
            />
            <button type="submit" className={styles.joinButton} disabled={locked} aria-busy={busy === 'join' || undefined}>
              {busy === 'join' ? '…' : 'เข้าห้อง'}
            </button>
          </form>
          {codeError && (
            <p id="code-error" className={styles.fieldError} role="alert">
              {codeError}
            </p>
          )}

          <p className={styles.footnote}>
            เล่นครั้งละ 2 คน · ผลัดกันวาง ผลัดกันทาย 6 รอบ
            <br />
            คุยกันต่อหน้าหรือโทรหากันระหว่างเล่นได้เลย
          </p>
        </section>

        <p className={styles.footerBrand}>
          MADE FOR TWO <span aria-hidden="true">♥</span>
        </p>
      </main>

      <ConfirmDialog
        open={helpOpen}
        title="เราจะรู้ใจกันแค่ไหน?"
        body="คนหนึ่งจัดอันดับตัวเลือก 5 ใบตามใจ อีกคนลองทายว่าเรียงอย่างไร แล้วเปิดเฉลยและสลับบทบาทกัน เล่นทั้งหมด 6 รอบ หรือเลือกกอง “ชุดพิเศษ” เพื่อเล่นครบทุกข้อในชุดตามลำดับ"
        confirmLabel="เข้าใจแล้ว"
        cancelLabel={null}
        confirmVariant="primary"
        onConfirm={() => setHelpOpen(false)}
        onCancel={() => setHelpOpen(false)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="ออกจากห้องเดิม?"
        body="การออกจากห้องจะปิดห้องนั้นสำหรับทั้งสองคน และความคืบหน้าของเกมในห้องนั้นจะจบลง"
        confirmLabel="ออกและปิดห้อง"
        busy={busy === 'leave'}
        onConfirm={leaveActive}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
