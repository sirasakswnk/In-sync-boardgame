import { getQuestionBank } from '@/lib/game';
import { adminDb, ConfigError } from '@/lib/server/admin';
import { json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ตรวจ process + การเชื่อมต่อ RTDB โดยไม่เปิดข้อมูลใด ๆ ของผู้เล่น */
export async function GET() {
  const started = Date.now();
  let database: 'ok' | 'unconfigured' | 'error' = 'ok';
  try {
    await adminDb().ref('roomCodes').limitToFirst(1).get();
  } catch (e) {
    database = e instanceof ConfigError ? 'unconfigured' : 'error';
  }
  let questions = 0;
  try {
    questions = getQuestionBank().length;
  } catch {
    questions = -1;
  }
  const healthy = database === 'ok' && questions > 0;
  return json({ ok: healthy, database, questions, latencyMs: Date.now() - started }, healthy ? 200 : 503);
}
