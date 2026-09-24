import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  countQuestionsIn,
  DEFAULT_CATEGORIES,
  loadQuestionBank,
  ROUNDS_PER_GAME,
  roundsFor,
  SPECIAL_CATEGORY,
} from '../src/lib/game';

const bank = loadQuestionBank();
const byCategory = new Map<string, number>();
for (const q of bank) byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);

// ทุกข้อต้องมีคำถามแบบระบุคนตอบ เพื่อให้หน้าวาง/ทายบอกชัดว่ากำลังตอบแทนใคร
const noPersonal = bank.filter((q) => !q.personal).map((q) => q.id);
if (noPersonal.length) {
  console.error(`คำถามที่ยังไม่มี personal: ${noPersonal.join(', ')}`);
  process.exit(1);
}

// รูปไอคอนวาดเองต้องมีไฟล์อยู่จริงใน public/ ไม่อย่างนั้นการ์ดจะขึ้นรูปเสีย
const missingIcons = bank
  .flatMap((q) => q.options)
  .filter((o) => o.icon?.startsWith('/') && !existsSync(join('public', o.icon)))
  .map((o) => `${o.id} → ${o.icon}`);
if (missingIcons.length) {
  console.error(`ไม่พบไฟล์รูปไอคอน:\n  ${missingIcons.join('\n  ')}`);
  process.exit(1);
}

const defaults = countQuestionsIn(bank, DEFAULT_CATEGORIES);
if (defaults < ROUNDS_PER_GAME) {
  console.error(`หมวดค่าตั้งต้นมีคำถาม ${defaults} ข้อ ต้องมีอย่างน้อย ${ROUNDS_PER_GAME}`);
  process.exit(1);
}

// ชุดพิเศษเล่นครบทุกข้อ จำนวนข้อจึงต้องเป็นเลขคู่ให้สองคนได้ทายเท่ากัน
const special = countQuestionsIn(bank, [SPECIAL_CATEGORY]);
if (special > 0 && roundsFor(bank, [SPECIAL_CATEGORY]) === 0) {
  console.error(`ชุดพิเศษมี ${special} ข้อ ต้องเป็นเลขคู่ตั้งแต่ 2 ข้อขึ้นไป`);
  process.exit(1);
}

console.warn(`คลังคำถามถูกต้อง: ${bank.length} ข้อ`);
for (const [category, count] of byCategory) console.warn(`  ${category.padEnd(14)} ${count}`);
console.warn(`  ค่าตั้งต้น (ไม่รวม relationships และชุดพิเศษ): ${defaults} ข้อ`);
if (special > 0) console.warn(`  ชุดพิเศษ: เล่นครบ ${special} รอบตามลำดับในไฟล์`);
