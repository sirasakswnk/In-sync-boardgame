'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ProfileFields, type ProfileDraft } from '@/components/ProfileFields';
import { displayNameSchema, type AvatarId } from '@/lib/game';
import { api, ApiFailure } from '@/lib/client/api';
import styles from './room.module.css';

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
    <main className={styles.center}>
      <section className={styles.joinCard}>
        <p className={styles.eyebrow}>คุณได้รับคำเชิญ 💌</p>
        <h1 className={styles.joinTitle}>
          เข้าห้อง <span className={styles.bigCode}>{code}</span>
        </h1>
        <p className={styles.muted}>ตั้งชื่อเล่นและเลือกอวาตาร์ แล้วมาดูกันว่าใจตรงกันแค่ไหน</p>

        {error && (
          <Banner tone="error" live>
            {error}{' '}
            {activeCode && (
              <Link href={`/room/${activeCode}`}>ไปที่ห้อง {activeCode}</Link>
            )}
          </Banner>
        )}

        <ProfileFields value={profile} onChange={setProfile} error={nameError} disabled={busy} />
        <Button block onClick={join} loading={busy}>
          เข้าร่วมห้อง
        </Button>
        <Link href="/" className={styles.homeLinkPlain}>
          กลับหน้าหลัก
        </Link>
      </section>
    </main>
  );
}
