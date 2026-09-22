'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

const noSubscribe = () => () => undefined;

/** คัดลอกข้อความ — clipboard API ใช้ไม่ได้นอก secure context (เช่นเล่นผ่าน LAN ด้วย http) จึงมีวิธีเก่าสำรอง */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }
}

/** ลิงก์เชิญของห้อง — origin มีเฉพาะในเบราว์เซอร์ จึงใช้ server snapshot ว่างตอน hydrate */
export function useInviteUrl(code: string): string {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => '');
  return `${origin}/room/${code}`;
}

/** สถานะ “คัดลอกแล้ว” ที่หายเองใน 2 วินาที */
export function useCopied<K extends string>() {
  const [copied, setCopied] = useState<K | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const copy = useCallback(async (text: string, what: K) => {
    await copyText(text);
    setCopied(what);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  }, []);
  return { copied, copy };
}
