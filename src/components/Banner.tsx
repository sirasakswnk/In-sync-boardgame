import type { ReactNode } from 'react';
import styles from './Banner.module.css';

type Props = {
  tone?: 'info' | 'warn' | 'error' | 'success';
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
  live?: boolean;
};

/** ข้อความสถานะ: สีเป็นแค่ส่วนเสริม มีไอคอนและข้อความกำกับเสมอ (plan.md §6.3) */
export function Banner({ tone = 'info', icon, children, action, live }: Props) {
  const defaultIcon = { info: 'ℹ️', warn: '⚠️', error: '⛔', success: '✅' }[tone];
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}>
      <span className={styles.icon} aria-hidden="true">
        {icon ?? defaultIcon}
      </span>
      <div className={styles.body}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
