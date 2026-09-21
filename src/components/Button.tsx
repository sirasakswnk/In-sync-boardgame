import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
};

/** ปุ่มกลาง: loading = disabled เสมอ เพื่อกันส่งซ้ำ (plan.md §6.3) */
export function Button({ variant = 'primary', loading, block, disabled, className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[styles.button, styles[variant], block ? styles.block : '', className ?? ''].join(' ')}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}
