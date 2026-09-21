'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** ใช้ <dialog> ของเบราว์เซอร์: จัดการ focus trap และปุ่ม Escape ให้ */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = 'ยกเลิก', busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="confirm-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.body}>{body}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
