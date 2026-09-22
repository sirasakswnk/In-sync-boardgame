import { countQuestionsIn, DEFAULT_CATEGORIES, loadQuestionBank, ROUNDS_PER_GAME } from '../src/lib/game';

const bank = loadQuestionBank();
const byCategory = new Map<string, number>();
for (const q of bank) byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);

// ทุกข้อต้องมีคำถามแบบระบุคนตอบ เพื่อให้หน้าวาง/ทายบอกชัดว่ากำลังตอบแทนใคร
const noPersonal = bank.filter((q) => !q.personal).map((q) => q.id);
if (noPersonal.length) {
  console.error(`คำถามที่ยังไม่มี personal: ${noPersonal.join(', ')}`);
  process.exit(1);
}

const defaults = countQuestionsIn(bank, DEFAULT_CATEGORIES);
if (defaults < ROUNDS_PER_GAME) {
  console.error(`หมวดค่าตั้งต้นมีคำถาม ${defaults} ข้อ ต้องมีอย่างน้อย ${ROUNDS_PER_GAME}`);
  process.exit(1);
}

console.warn(`คลังคำถามถูกต้อง: ${bank.length} ข้อ`);
for (const [category, count] of byCategory) console.warn(`  ${category.padEnd(14)} ${count}`);
console.warn(`  ค่าตั้งต้น (ไม่รวม relationships): ${defaults} ข้อ`);
