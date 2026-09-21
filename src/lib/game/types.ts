import type { AVATAR_IDS, CATEGORIES, ERROR_CODES, PHASES } from './constants';

export type Category = (typeof CATEGORIES)[number];
export type AvatarId = (typeof AVATAR_IDS)[number];
export type Phase = (typeof PHASES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];
export type Stage = 'self' | 'guess';
export type Uid = string;

export type QuestionOption = { id: string; label: string; icon?: string };

export type Question = {
  id: string;
  version: number;
  category: Category;
  prompt: string;
  topLabel: string;
  bottomLabel: string;
  options: QuestionOption[];
};

// ---------------------------------------------------------------------------
// Authoritative state — เก็บใน server เท่านั้น ห้ามส่งให้ client ทั้งก้อน
// ---------------------------------------------------------------------------

export type ScoreEntry = {
  optionId: string;
  guessedIndex: number;
  actualIndex: number;
  distance: number;
  points: number;
};

export type ScoreResult = { score: number; breakdown: ScoreEntry[] };

export type MemberState = {
  uid: Uid;
  seat: 0 | 1;
  displayName: string;
  avatarId: AvatarId;
  lobbyReady: boolean;
  joinedAt: number;
};

export type Role = 'setter' | 'guesser';

export type RoundState = {
  index: number;
  question: Question;
  /** คนวางลำดับของตัวเองในรอบนี้ — สลับที่นั่งทุกรอบ */
  setterUid: Uid;
  /** คนทายลำดับของ setter ในรอบนี้ */
  guesserUid: Uid;
  /** ลำดับการ์ดตั้งต้น สุ่มแยกตามผู้เล่น/ช่วง บันทึกครั้งเดียว (setter มี self, guesser มี guess) */
  layouts: Record<Uid, Partial<Record<Stage, string[]>>>;
  /** มีได้เฉพาะ key ของ setter */
  self: Record<Uid, string[]>;
  /** มีได้เฉพาะ key ของ guesser */
  guess: Record<Uid, string[]>;
  /** คะแนนของผู้ทาย (key = uid ของคนทาย) มีเมื่อถึง REVEAL เท่านั้น */
  results: Record<Uid, ScoreResult> | null;
  continued: Record<Uid, boolean>;
};

export type GameState = {
  id: string;
  phase: Exclude<Phase, 'LOBBY'>;
  roundIndex: number;
  rounds: RoundState[];
  totals: Record<Uid, number>;
  rematch: Record<Uid, boolean>;
  createdAt: number;
  finishedAt: number | null;
};

export type Ack =
  | { ok: true; commandId: string; revision: number }
  | { ok: false; commandId: string; code: ErrorCode; message: string };

export type Receipt = { payloadHash: string; ack: Ack; at: number };

export type RoomState = {
  id: string;
  code: string;
  hostUid: Uid;
  status: 'OPEN' | 'CLOSED';
  revision: number;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  settings: { categories: Category[] };
  members: Record<Uid, MemberState>;
  game: GameState | null;
  /** คำถามจากเกมที่เพิ่งจบ ใช้เลี่ยงซ้ำตอน rematch */
  previousQuestionIds: string[];
  receipts: Record<Uid, Record<string, Receipt>>;
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

type GameScoped = { gameId: string; roundIndex: number; expectedPhase: Phase };

export type CommandBody =
  | { kind: 'settings'; categories: Category[] }
  | { kind: 'ready'; ready: boolean }
  | { kind: 'start' }
  | ({ kind: 'self'; optionIds: string[] } & GameScoped)
  | ({ kind: 'guess'; optionIds: string[] } & GameScoped)
  | ({ kind: 'continue' } & GameScoped)
  | ({ kind: 'rematch' } & GameScoped)
  | { kind: 'leave' };

export type Command = CommandBody & { commandId: string };
export type CommandKind = Command['kind'];

// ---------------------------------------------------------------------------
// Player projection — สิ่งเดียวที่ส่งให้ผู้เล่นแต่ละคนได้
// ---------------------------------------------------------------------------

export type PublicMember = {
  uid: Uid;
  seat: 0 | 1;
  displayName: string;
  avatarId: AvatarId;
  lobbyReady: boolean;
};

export type Pair<T> = { you: T; partner: T };

/** เฉลยหนึ่งรอบ: ทางเดียว คือคำทายของ guesser เทียบคำตอบจริงของ setter */
export type RevealRound = {
  roundIndex: number;
  question: Question;
  /** ใครเป็นคนวางลำดับในรอบนี้ (อีกคนคือคนทาย) */
  setter: 'you' | 'partner';
  setterOrder: string[];
  guessOrder: string[];
  score: ScoreResult;
};

export type PlayerGameView = {
  id: string;
  phase: Exclude<Phase, 'LOBBY'>;
  roundIndex: number;
  roundCount: number;
  question: Question;
  /** บทบาทของคุณในรอบปัจจุบัน */
  role: Role;
  /** uid ของคนทายรอบนี้ — ใช้หา path ของคำทายสดใน /live */
  guesserUid: Uid;
  /** ป้ายของรอบปัจจุบัน `${gameId}:${roundIndex}` ใช้กรองคำทายสดที่ค้างจากรอบอื่น */
  liveKey: string;
  /** ลำดับการ์ดตั้งต้นของคุณในช่วงปัจจุบัน (ว่างถ้าช่วงนี้ไม่ใช่ตาคุณเรียง) */
  layout: string[];
  yourSelf: string[] | null;
  yourGuess: string[] | null;
  submitted: Pair<boolean>;
  continued: Pair<boolean>;
  rematch: Pair<boolean>;
  /** รวมเฉพาะรอบที่เฉลยแล้ว */
  totals: Pair<number>;
  reveal: RevealRound | null;
  history: RevealRound[];
};

export type PlayerView = {
  revision: number;
  roomId: string;
  code: string;
  status: RoomState['status'];
  expiresAt: number;
  isHost: boolean;
  hostUid: Uid;
  settings: RoomState['settings'];
  phase: Phase;
  you: PublicMember;
  partner: PublicMember | null;
  game: PlayerGameView | null;
};
