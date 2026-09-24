export const ROUNDS_PER_GAME = 6;
export const OPTIONS_PER_ROUND = 5;
export const MAX_SEATS = 2;
export const MAX_ROUND_SCORE = OPTIONS_PER_ROUND * 2;
/** ผลัดกันทายรอบละคน แต่ละคนได้ทายครึ่งหนึ่งของเกม */
export const GUESSES_PER_PLAYER = ROUNDS_PER_GAME / 2;
export const MAX_GAME_SCORE = MAX_ROUND_SCORE * GUESSES_PER_PLAYER;

export const ROOM_CODE_LENGTH = 6;
/** ตัด I, O, 0, 1 ออกเพื่อไม่ให้อ่านสับสน */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const DISPLAY_NAME_MAX = 20;

export const CATEGORIES = [
  'daily',
  'food',
  'gaming',
  'hypothetical',
  'annoyances',
  'relationships',
  'custom',
] as const;

/** ชุดพิเศษ: เลือกกองนี้กองเดียวแล้วเล่นครบทุกข้อในกอง เรียงตามลำดับในไฟล์คำถาม */
export const SPECIAL_CATEGORY = 'custom' satisfies (typeof CATEGORIES)[number];

/** หมวดความสัมพันธ์และชุดพิเศษเป็น opt-in ตั้งแต่ lobby */
export const DEFAULT_CATEGORIES = CATEGORIES.filter((c) => c !== 'relationships' && c !== SPECIAL_CATEGORY);

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  daily: 'ชีวิตประจำวัน',
  food: 'อาหารการกิน',
  gaming: 'เกมและเทคโนโลยี',
  hypothetical: 'ถ้าเกิดว่า…',
  annoyances: 'เรื่องชวนหงุดหงิด',
  relationships: 'ความสัมพันธ์',
  custom: 'ชุดพิเศษ',
};

export const PHASES = ['LOBBY', 'SELF_RANK', 'GUESS_RANK', 'REVEAL', 'RESULTS'] as const;

export const AVATAR_IDS = [
  'cat',
  'dog',
  'bunny',
  'bear',
  'fox',
  'panda',
  'frog',
  'owl',
  'penguin',
  'tiger',
  'koala',
  'duck',
] as const;

export const ERROR_CODES = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_CLOSED',
  'UNAUTHORIZED',
  'INVALID_RANKING',
  'WRONG_PHASE',
  'ALREADY_SUBMITTED',
  'PARTNER_OFFLINE',
  'NOT_READY',
  'NOT_HOST',
  'NOT_YOUR_TURN',
  'NOT_ENOUGH_QUESTIONS',
  'INVALID_PAYLOAD',
  'COMMAND_CONFLICT',
  'PROFILE_LOCKED',
  'ALREADY_IN_ROOM',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

/** ข้อความภาษาไทยสำหรับ error ทุกตัว บอกด้วยว่าผู้เล่นควรทำอะไรต่อ */
export const ERROR_MESSAGES: Record<(typeof ERROR_CODES)[number], string> = {
  ROOM_NOT_FOUND: 'ไม่พบห้องนี้ ลองตรวจรหัสอีกครั้ง หรือสร้างห้องใหม่',
  ROOM_FULL: 'ห้องนี้มีผู้เล่นครบสองคนแล้ว',
  ROOM_CLOSED: 'ห้องนี้ปิดไปแล้ว กลับหน้าหลักเพื่อสร้างห้องใหม่',
  UNAUTHORIZED: 'คุณไม่ได้อยู่ในห้องนี้ หรือเซสชันหมดอายุ ลองเข้าห้องใหม่อีกครั้ง',
  INVALID_RANKING: 'ลำดับที่ส่งมาไม่ถูกต้อง ต้องมีตัวเลือกครบ 5 อันและไม่ซ้ำกัน',
  WRONG_PHASE: 'เกมเดินหน้าไปแล้ว กำลังโหลดสถานะล่าสุด…',
  ALREADY_SUBMITTED: 'คุณส่งคำตอบรอบนี้ไปแล้ว',
  PARTNER_OFFLINE: 'คู่หูหลุดการเชื่อมต่ออยู่ รอให้กลับมาก่อนนะ',
  NOT_READY: 'ยังเริ่มไม่ได้ ต้องมีผู้เล่นสองคนและกดพร้อมทั้งคู่',
  NOT_HOST: 'เฉพาะผู้สร้างห้องเท่านั้นที่ทำสิ่งนี้ได้',
  NOT_YOUR_TURN: 'ยังไม่ถึงตาคุณในช่วงนี้',
  NOT_ENOUGH_QUESTIONS: 'หมวดที่เลือกมีคำถามไม่ถึง 6 ข้อ เลือกหมวดเพิ่มอีกหน่อยนะ',
  INVALID_PAYLOAD: 'ข้อมูลที่ส่งมาไม่ถูกต้อง ลองรีเฟรชหน้าแล้วทำใหม่',
  COMMAND_CONFLICT: 'คำสั่งนี้ถูกส่งไปแล้วด้วยข้อมูลอื่น ลองรีเฟรชหน้า',
  PROFILE_LOCKED: 'เปลี่ยนชื่อหรืออวาตาร์ระหว่างเกมไม่ได้ รอจบเกมก่อนนะ',
  ALREADY_IN_ROOM: 'คุณอยู่ในห้องอื่นอยู่ ออกจากห้องเดิมก่อนแล้วลองใหม่',
  RATE_LIMITED: 'ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่',
  INTERNAL: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ ลองอีกครั้งในอีกสักครู่',
};
