/**
 * รัน integration tests กับ Firebase Local Emulator แบบคำสั่งเดียว
 *
 * บน Windows `firebase emulators:exec` ปิด hub แล้วแต่ Java ของ Database Emulator มักค้างอยู่
 * ทำให้รันรอบถัดไปไม่ได้ ("port taken") จึงเก็บกวาดเฉพาะ process ของ emulator ก่อนและหลังรัน
 */
import { spawnSync } from 'node:child_process';

const FIREBASE = 'npx --yes firebase-tools@15.30.2';
const EXTRA = process.argv.slice(2).join(' ');
const INNER = `node scripts/with-env.mjs .env.emulator vitest run --project integration ${EXTRA}`.trim();

function killStaleEmulators() {
  if (process.platform === 'win32') {
    const ps =
      "Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | " +
      "Where-Object { $_.CommandLine -match 'firebase-database-emulator' } | " +
      'ForEach-Object { Stop-Process -Id $_.ProcessId -Force }';
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  } else {
    spawnSync('pkill', ['-f', 'firebase-database-emulator'], { stdio: 'ignore' });
  }
}

killStaleEmulators();
const res = spawnSync(
  `${FIREBASE} emulators:exec --only auth,database --project demo-heart-sync "${INNER}"`,
  { stdio: 'inherit', shell: true },
);
killStaleEmulators();
process.exit(res.status ?? 1);
