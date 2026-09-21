'use client';

import { useId } from 'react';
import { AVATAR_IDS, DISPLAY_NAME_MAX, visibleLength, type AvatarId } from '@/lib/game';
import { AVATARS } from '@/lib/ui/avatars';
import styles from './ProfileFields.module.css';

export type ProfileDraft = { displayName: string; avatarId: AvatarId };

type Props = {
  value: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  error?: string | null;
  disabled?: boolean;
};

export function ProfileFields({ value, onChange, error, disabled }: Props) {
  const nameId = useId();
  const errId = useId();
  const count = visibleLength(value.displayName.trim());

  return (
    <div className={styles.fields}>
      <div className={styles.nameRow}>
        <label htmlFor={nameId} className={styles.label}>
          ชื่อเล่นของคุณ
        </label>
        <span className={`${styles.count} ${count > DISPLAY_NAME_MAX ? styles.over : ''}`} aria-hidden="true">
          {count}/{DISPLAY_NAME_MAX}
        </span>
      </div>
      <input
        id={nameId}
        className={styles.input}
        value={value.displayName}
        onChange={(e) => onChange({ ...value, displayName: e.target.value })}
        placeholder="เช่น มะปราง"
        autoComplete="nickname"
        enterKeyHint="done"
        maxLength={60}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errId : undefined}
      />
      {error && (
        <p id={errId} className={styles.error} role="alert">
          {error}
        </p>
      )}

      <fieldset className={styles.avatars} disabled={disabled}>
        <legend className={styles.label}>เลือกอวาตาร์</legend>
        <div className={styles.grid}>
          {AVATAR_IDS.map((id) => {
            const a = AVATARS[id];
            const checked = value.avatarId === id;
            return (
              <label key={id} className={`${styles.option} ${checked ? styles.checked : ''}`} style={{ background: a.bg }}>
                <input
                  type="radio"
                  name="avatar"
                  value={id}
                  checked={checked}
                  onChange={() => onChange({ ...value, avatarId: id })}
                  className="visually-hidden"
                />
                <span aria-hidden="true">{a.emoji}</span>
                <span className="visually-hidden">{a.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
