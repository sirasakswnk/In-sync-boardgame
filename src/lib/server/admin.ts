import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';

/**
 * Firebase Admin — ใช้เฉพาะฝั่ง server (route handlers) ห้าม import จาก client component
 *
 * สร้าง app ครั้งเดียวต่อ process เพราะ serverless function ที่ยัง warm อยู่จะถูกเรียกซ้ำ
 */

export class ConfigError extends Error {}

let cached: App | null = null;

function readServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  const unquoted = raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1) : raw;
  try {
    return JSON.parse(unquoted) as Record<string, string>;
  } catch {
    throw new ConfigError('FIREBASE_SERVICE_ACCOUNT ไม่ใช่ JSON ที่ถูกต้อง');
  }
}

export function adminApp(): App {
  if (cached) return cached;
  const existing = getApps()[0];
  if (existing) return (cached = existing);

  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new ConfigError('ยังไม่ได้ตั้ง NEXT_PUBLIC_FIREBASE_DATABASE_URL');

  const serviceAccount = readServiceAccount();
  const usingEmulator = Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST);

  if (!serviceAccount && !usingEmulator) {
    throw new ConfigError('ยังไม่ได้ตั้ง FIREBASE_SERVICE_ACCOUNT');
  }

  cached = initializeApp(
    serviceAccount
      ? { credential: cert(serviceAccount), databaseURL }
      : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-heart-sync', databaseURL },
  );
  return cached;
}

export function adminDb(): Database {
  return getDatabase(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
