'use client';

import { ERROR_MESSAGES, type ErrorCode } from '@/lib/game';
import { idToken } from './firebase';

/** รหัสที่เกิดฝั่ง client เท่านั้น: ส่งไปแล้วแต่ไม่รู้ผล */
export type ClientErrorCode = ErrorCode | 'TIMEOUT' | 'NETWORK';

const CLIENT_MESSAGES: Record<'TIMEOUT' | 'NETWORK', string> = {
  TIMEOUT: 'ยังไม่ทราบผล เซิร์ฟเวอร์ตอบช้า กำลังตรวจสถานะล่าสุด…',
  NETWORK: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง',
};

export function messageFor(code: ClientErrorCode): string {
  return code === 'TIMEOUT' || code === 'NETWORK' ? CLIENT_MESSAGES[code] : ERROR_MESSAGES[code];
}

export class ApiFailure extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    readonly body: Record<string, unknown> = {},
  ) {
    super(messageFor(code));
  }

  /** ผลลัพธ์ไม่แน่นอน: คำสั่งอาจถูกบันทึกไปแล้ว ต้อง resync ก่อน retry ด้วย commandId เดิม */
  get uncertain(): boolean {
    return this.code === 'TIMEOUT' || this.code === 'NETWORK';
  }
}

type Options = { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number };

export async function api<T extends Record<string, unknown>>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = 12_000 } = opts;
  const token = await idToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw new ApiFailure(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK', 0);
  } finally {
    clearTimeout(timer);
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    if (!res.ok) throw new ApiFailure('INTERNAL', res.status);
  }
  if (!res.ok || data.ok === false) {
    const code = (typeof data.code === 'string' ? data.code : 'INTERNAL') as ErrorCode;
    throw new ApiFailure(code, res.status, data);
  }
  return data as T;
}
