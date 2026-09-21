/**
 * โหลดไฟล์ env แล้วรันคำสั่งต่อ: node scripts/with-env.mjs <env-file> <command...>
 *
 * ใช้แทน `node --env-file=…` เพราะ Next.js ส่งต่อ flag ของ node ผ่าน NODE_OPTIONS
 * ซึ่งไม่อนุญาต --env-file ทำให้ `next dev` ล้มทันที
 */
import { spawn } from 'node:child_process';

const [envFile, ...command] = process.argv.slice(2);
if (!envFile || command.length === 0) {
  console.error('usage: node scripts/with-env.mjs <env-file> <command...>');
  process.exit(2);
}
process.loadEnvFile(envFile);

const child = spawn(command.join(' '), { stdio: 'inherit', shell: true, env: process.env });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
