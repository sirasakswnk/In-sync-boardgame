'use client';

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';

/**
 * Firebase ฝั่ง browser
 * - ผู้เล่นเป็น guest ผ่าน Anonymous Auth: uid ถูกเก็บใน IndexedDB ของ browser profile นั้น
 *   สองแท็บใน profile เดียวจึงเป็นผู้เล่นคนเดียวกัน ส่วน incognito/profile อื่นเป็นคนใหม่
 * - ต้องอ้าง process.env.NEXT_PUBLIC_* ตรง ๆ เพื่อให้ Next.js ฝังค่าตอน build
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.databaseURL && config.appId);
}

/** ใช้ Firebase Local Emulator แทน project จริง — สำหรับพัฒนา/ทดสอบในเครื่องเท่านั้น */
const emulatorHost =
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' ? (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ?? '127.0.0.1') : null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

function clientApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function clientAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(clientApp());
  if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  return auth;
}

export function clientDb(): Database {
  if (db) return db;
  db = getDatabase(clientApp());
  if (emulatorHost) connectDatabaseEmulator(db, emulatorHost, 9000);
  return db;
}

let pendingUser: Promise<User> | null = null;

/** รอสถานะ auth ที่เก็บไว้ก่อน แล้วจึง sign in แบบ anonymous ถ้ายังไม่มี */
export function ensureUser(): Promise<User> {
  pendingUser ??= new Promise<User>((resolve, reject) => {
    const auth = clientAuth();
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        stop();
        if (user) resolve(user);
        else signInAnonymously(auth).then((cred) => resolve(cred.user), reject);
      },
      reject,
    );
  }).catch((e: unknown) => {
    pendingUser = null;
    throw e;
  });
  return pendingUser;
}

export async function idToken(): Promise<string> {
  const user = await ensureUser();
  return user.getIdToken();
}
