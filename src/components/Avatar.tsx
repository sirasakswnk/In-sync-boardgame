import type { AvatarId } from '@/lib/game';
import { AVATARS } from '@/lib/ui/avatars';
import styles from './Avatar.module.css';

type Props = {
  id: AvatarId;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  label?: string;
};

export function Avatar({ id, size = 'md', online, label }: Props) {
  const avatar = AVATARS[id] ?? AVATARS.cat;
  return (
    <span
      className={`${styles.avatar} ${styles[size]}`}
      style={{ background: avatar.bg }}
      role="img"
      aria-label={label ?? avatar.label}
    >
      <span aria-hidden="true">{avatar.emoji}</span>
      {online !== undefined && (
        <span className={`${styles.dot} ${online ? styles.on : styles.off}`} aria-hidden="true" />
      )}
    </span>
  );
}
