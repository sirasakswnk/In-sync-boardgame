'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/Banner';
import { ProfileFields, type ProfileDraft } from '@/components/ProfileFields';
import { displayNameSchema, type AvatarId } from '@/lib/game';
import { api, ApiFailure } from '@/lib/client/api';
import styles from './screen.module.css';

type ProfileResponse = { ok: true; profile: { displayName: string; avatarId: AvatarId } | null };

/** เปิดลิงก์เชิญแต่ยังไม่ได้เป็นสมาชิก: ตั้งชื่อ/อวาตาร์แล้วเข้าที่นั่งที่ว่าง */
export function JoinPanel({ code, onJoin }: { code: string; onJoin: () => Promise<void> }) {
  const [profile, setProfile] = useState<ProfileDraft>({ displayName: '', avatarId: 'dog' });
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ProfileResponse>('/api/profile')
      .then((res) => res.profile && setProfile(res.profile))
      .catch(() => undefined);
  }, []);

  async function join() {
    const parsed = displayNameSchema.safeParse(profile.displayName);
    if (!parsed.success) {
      setNameError('ตั้งชื่อเล่น 1–20 ตัวอักษรก่อนนะ');
      return;
    }
    setNameError(null);
    setError(null);
    setBusy(true);
    try {
      await api('/api/profile', { method: 'POST', body: { displayName: parsed.data, avatarId: profile.avatarId } });
      await onJoin();
    } catch (e) {
      if (e instanceof ApiFailure && e.code === 'ALREADY_IN_ROOM' && typeof e.body.activeCode === 'string') {
        setActiveCode(e.body.activeCode);
      }
      setError(e instanceof Error ? e.message : 'เข้าห้องไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.wrap}>
        <p className={styles.brand}>
          <span aria-hidden="true">♥♥</span>IN SYNC
        </p>

        <section className={styles.board} aria-labelledby="join-title">
          <p className={styles.eyebrow}>คุณได้รับคำเชิญ 💌</p>
          <h1 id="join-title" className={styles.title}>
            มาร่วมโต๊ะด้วยกันไหม?
          </h1>

          <p className={styles.codeLabel}>รหัสห้อง</p>
          {/* รหัสเป็นตัวต่อไม้ทีละตัว — โปรแกรมอ่านหน้าจออ่านทีละตัวจากข้อความซ่อน */}
          <p className={styles.tiles}>
            <span className="visually-hidden">{code.split('').join(' ')}</span>
            {code.split('').map((ch, i) => (
              <span key={i} className={styles.tile} aria-hidden="true">
                {ch}
              </span>
            ))}
          </p>
          <p className={styles.sub}>ตั้งชื่อเล่นและเลือกอวาตาร์ แล้วมาดูกันว่าใจตรงกันแค่ไหน</p>

          {error && (
            <Banner tone="error" live>
              {error}{' '}
              {activeCode && (
                <Link href={`/room/${activeCode}`} className={styles.bannerLink}>
                  ไปที่ห้อง {activeCode}
                </Link>
              )}
            </Banner>
          )}

          <ProfileFields value={profile} onChange={setProfile} error={nameError} disabled={busy} look="table" />
          <button type="button" className={styles.primary} onClick={join} disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'กำลังเข้าห้อง…' : 'เข้าร่วมห้อง'}
          </button>
          <Link href="/" className={styles.back}>
            ← กลับหน้าหลัก
          </Link>
        </section>

        <p className={styles.footer}>
          MADE FOR TWO <span aria-hidden="true">♥</span>
        </p>
      </main>
    </div>
  );
}
