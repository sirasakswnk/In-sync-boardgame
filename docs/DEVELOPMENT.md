# คู่มือนักพัฒนา — IN SYNC

รายละเอียดการติดตั้ง รัน ทดสอบ และ deploy ทั้งหมด (ภาพรวมของโปรเจกต์อยู่ใน [README](../README.md))

---

## สถาปัตยกรรม

| ส่วน | ที่ใช้ |
| --- | --- |
| Frontend + API | Next.js 16 (App Router) + React 19 + TypeScript |
| Realtime + ฐานข้อมูล | Firebase Realtime Database (RTDB) |
| ตัวตนผู้เล่น | Firebase Anonymous Auth (guest ไม่ต้องสมัคร) |
| Styling | CSS Modules + CSS variables |
| เรียงการ์ด | dnd-kit (pointer/touch/keyboard) + ปุ่มขึ้นลง |
| Validation | Zod |
| Tests | Vitest (unit + integration ที่คุยกับ backend จริง) |
| ปลายทาง deploy | Vercel (serverless) |

### ทำไมต่างจากแผนตั้งต้น

แผนตั้งต้นเสนอ Node + Express + Socket.IO + SQLite แต่ปลายทางที่เลือกคือ **Vercel + Firebase** ซึ่ง Vercel รันเฉพาะ serverless function อายุสั้น จึง **ถือ Socket.IO server ค้างไว้ไม่ได้** จึงเปลี่ยนเป็น:

| แผนเดิม | ของจริงในโปรเจกต์ |
| --- | --- |
| Socket.IO events | RTDB listeners — client ฟังเฉพาะมุมมองของตัวเอง |
| Socket commands | `POST /api/rooms/[code]/commands` (Next.js route handler) |
| Cookie session + ตาราง `sessions` | Firebase Anonymous Auth + ID token (`Authorization: Bearer`) |
| SQLite + migrations | RTDB + `database.rules.json` (ไม่มี SQL migration) |
| `processed_commands` | `receipts/$uid/$commandId` ในโหนดห้อง |
| นับ socket เพื่อทำ presence | `onDisconnect()` ของ RTDB หนึ่ง connection ต่อแท็บ |
| cron ใน process | Vercel Cron → `/api/cron/cleanup` + ตรวจหมดอายุทุกคำสั่ง |

สูตรคะแนนรายการ์ดและ phase ของ state machine คงเดิมตามแผน แต่**กติกาการเล่นเปลี่ยน**ตามที่ผู้ใช้ขอ: จากเดิมที่ทั้งคู่เรียงและทายพร้อมกัน เป็นผลัดเทิร์นคนวาง/คนทาย และคนวางเป็นคนพาไปต่อ

### หัวใจของการออกแบบ

```text
browser ──POST /api/rooms/CODE/commands──▶ route handler (Vercel)
   ▲                                         │ verifyIdToken → uid
   │                                         ▼
   │                       RTDB transaction บน /rooms/$roomId (โหนดเดียว)
   │                         └─ applyCommand(state, cmd)  ← pure function
   │                         └─ projectRoomForPlayer(state, uid) ต่อคน
   │                         └─ เขียน state + views ของทั้งคู่พร้อมกัน
   └────── onValue(/rooms/$roomId/views/$myUid) ◀──────────┘
```

- **กติกาทั้งหมดอยู่ใน pure reducer** ที่ [src/lib/game/reducer.ts](../src/lib/game/reducer.ts) ไม่ import Firebase เลย (มี lint rule บังคับ) จึงทดสอบได้ครบโดยไม่ต้องมี credential
- **ทุกคำสั่งคือ transaction เดียว** ตรวจ receipt → สมาชิก → หมดอายุ → เกม/รอบ/phase → ตาใคร → เขียนผล → คิดคะแนน → เลื่อน phase → เขียน view ของทั้งคู่ ถ้าสองคำสั่งมาพร้อมกัน RTDB จะ retry ให้เอง phase จึงเลื่อนครั้งเดียว
- **ความลับบังคับด้วย security rules**: `state` ไม่มีใครอ่านได้, `views/$uid` อ่านได้เฉพาะเจ้าของ, client เขียนได้แค่ presence ของตัวเอง กับคำทายสดของตัวเองตอนเป็นตาทาย — ต่อให้เขียน query เองก็อ่านคำตอบของคนวางไม่ได้
- **มุมมองของผู้เล่นสร้างแบบ allowlist** ใน [src/lib/game/projection.ts](../src/lib/game/projection.ts) คำตอบของคนวางออกไปถึงคนทายได้ทางเดียวคือเมื่อรอบนั้นมีผลคะแนนแล้ว ซึ่งเกิดตอนเข้า REVEAL เท่านั้น
- **คำทายสด** (ให้คนวางดูคนทายเรียง) คนทายเขียนตรงลง `/live` แบบ throttle ประมาณ 120 ms ไม่ผ่าน API จึงลื่นและไม่กินโควต้า function ของ Vercel ข้อมูลนี้ใช้แค่แสดงผล ไม่มีผลกับคะแนน คะแนนมาจากคำสั่ง `guess` ที่ server ตรวจเท่านั้น และ `/live` แยกไว้นอกโหนดห้องเพื่อไม่ให้การเขียนถี่ ๆ ชนกับ transaction ของห้อง

โครงข้อมูลใน RTDB:

```text
/roomCodes/$CODE                      → roomId                (ผู้ที่ล็อกอินอ่านได้ เพื่อเข้าห้อง)
/users/$uid                           → ชื่อ อวาตาร์ ห้องปัจจุบัน   (เจ้าของอ่านได้)
/rooms/$roomId/state                  → state เต็มของห้อง       (ไม่มี client อ่านได้)
/rooms/$roomId/views/$uid             → มุมมองของผู้เล่นคนนั้น    (เจ้าของอ่านได้คนเดียว)
/rooms/$roomId/presence/$uid/$connId  → true                  (สมาชิกอ่าน / เจ้าของเขียน)
/rooms/$roomId/turn                   → key, phase, คนทาย ของรอบปัจจุบัน (ไม่มี client อ่านได้ ใช้ใน rules ของ /live)
/live/$roomId/$uid                    → คำทายระหว่างเรียง       (สมาชิกอ่าน / คนทายเขียนได้เฉพาะช่วงทายของรอบนั้น)
/rateLimits/$hash                     → ตัวนับ create/join       (server เท่านั้น)
```

---

---

## สิ่งที่ต้องมี

| เครื่องมือ | เวอร์ชันที่ใช้พัฒนา | หมายเหตุ |
| --- | --- | --- |
| Node.js | 24.20.0 (ดู `.nvmrc`) | ขั้นต่ำ 20.9 ตาม engines ของ Next.js 16 |
| npm | 11.6.2 | ใช้ `package-lock.json` — ติดตั้งด้วย `npm ci` |
| Java | 21 ขึ้นไป (พัฒนาด้วย 25.0.1) | **เฉพาะเมื่อใช้ Firebase Emulator** |

Firebase CLI ไม่ต้องติดตั้งเอง: สคริปต์เรียก `firebase-tools@15.30.2` ผ่าน `npx` (ดาวน์โหลดครั้งแรกครั้งเดียว)

### เริ่มบน Windows 11

1. ติดตั้ง Node.js 24 LTS จาก <https://nodejs.org> (หรือ `nvm-windows` แล้ว `nvm use 24`)
2. ถ้าจะใช้ emulator: ติดตั้ง JDK 21+ (เช่น Eclipse Temurin) แล้วเปิด PowerShell ใหม่ ตรวจด้วย `java -version`
3. เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ แล้ว `npm ci`

---

## เริ่มเร็วที่สุด: ใช้ Firebase Emulator (ไม่ต้องมีบัญชี)

รันทุกอย่างในเครื่อง ไม่ต้องสมัครบริการใดและไม่ต้องใส่ API key

```powershell
npm ci

# หน้าต่างที่ 1 — Firebase Auth + Realtime Database จำลอง (พอร์ต 9099 / 9000)
npm run emulators

# หน้าต่างที่ 2 — เว็บ (อ่านค่าจาก .env.emulator)
npm run dev:emulator
```

เปิด <http://localhost:3000>

- emulator โหลด `database.rules.json` ตัวเดียวกับ production จึงทดสอบกฎความลับได้จริง
- ข้อมูลใน emulator หายเมื่อปิด emulator
- `.env.emulator` ไม่มีความลับ — project ชื่อ `demo-*` ใช้ได้เฉพาะกับ emulator

---

## ตั้งค่า Firebase project จริง

1. สร้าง project ที่ <https://console.firebase.google.com>
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**
3. **Build → Realtime Database → Create Database** เลือก location (แนะนำ `asia-southeast1` สิงคโปร์) และเริ่มแบบ *locked mode*
4. **Project settings → General → Your apps → Add app → Web** แล้วคัดลอกค่า config
5. **Project settings → Service accounts → Generate new private key** ได้ไฟล์ JSON
   เก็บไฟล์นี้ให้ดี ห้าม commit และห้ามส่งให้ใคร
6. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   | ตัวแปร | ค่า |
   | --- | --- |
   | `APP_ORIGIN` | `http://localhost:3000` ตอนพัฒนา (ต้องตรงกับที่เบราว์เซอร์เปิด) |
   | `NEXT_PUBLIC_FIREBASE_*` | จากขั้นที่ 4 (`databaseURL` ดูได้ที่หน้า Realtime Database) |
   | `FIREBASE_SERVICE_ACCOUNT` | เนื้อหาไฟล์ JSON จากขั้นที่ 5 เป็นบรรทัดเดียว ครอบด้วย `'…'` |
   | `CRON_SECRET` | สุ่มเอง: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

   แปลงไฟล์ JSON เป็นบรรทัดเดียวได้ด้วย:

   ```powershell
   node -e "console.log(JSON.stringify(require('./path/to/service-account.json')))"
   ```

7. deploy security rules (ต้องทำครั้งแรก และทุกครั้งที่แก้ `database.rules.json`):

   ```powershell
   npx --yes firebase-tools@15.30.2 login
   npm run rules:deploy -- --project <project-id>
   ```

   ถ้าไม่ deploy rules ฐานข้อมูลจะยังเป็น locked mode และผู้เล่นจะอ่านมุมมองของตัวเองไม่ได้
8. `npm run dev` แล้วเปิด <http://localhost:3000> — ตรวจความพร้อมได้ที่ <http://localhost:3000/api/health> (ต้องได้ `"database":"ok"`)

---

## คำสั่งทั้งหมด

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm ci` | ติดตั้ง dependency ตาม lockfile |
| `npm run dev` | dev server ต่อ Firebase ตาม `.env.local` |
| `npm run emulators` | เปิด Firebase Auth + RTDB emulator |
| `npm run dev:emulator` | dev server ต่อ emulator (ค่าจาก `.env.emulator`) |
| `npm run build` | production build |
| `npm run start` | รัน production build (ต้อง build ก่อน) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run test` | unit tests: กติกา คะแนน ความลับ reducer คลังคำถาม contrast — **ไม่ต้องมี Firebase** |
| `npm run test:e2e` | integration: สองผู้เล่นคุยกับ Next.js server + RTDB จริงตาม `.env.local` (ถ้าไม่ได้ตั้งค่าจะถูกข้าม) |
| `npm run test:e2e:emulator` | integration ชุดเดียวกัน โดยเปิด/ปิด emulator ให้อัตโนมัติ |
| `npm run check:questions` | ตรวจคลังคำถามกับ schema และจำนวนข้อของชุดพิเศษ |
| `npm run rules:deploy` | deploy `database.rules.json` ขึ้น project จริง |

ไม่มี `db:migrate` ตามที่แผนเดิมเขียนไว้ เพราะ RTDB ไม่มี schema/migration — สิ่งที่เทียบเท่าคือ `rules:deploy` และคลังคำถามอยู่ในซอร์ส ([src/data/questions.th.json](../src/data/questions.th.json)) ไม่ต้อง seed ลงฐานข้อมูล

---

## ทดสอบสองผู้เล่นในเครื่องเดียว

ผู้เล่นหนึ่งคน = หนึ่ง browser profile เพราะตัวตน guest เก็บใน IndexedDB ของ profile นั้น

1. เปิดหน้าต่างปกติ → ตั้งชื่อ → **สร้างห้องใหม่** → กด **คัดลอกลิงก์เชิญ**
2. เปิด **หน้าต่าง Incognito/InPrivate** (หรือ browser profile อื่น หรือคนละเบราว์เซอร์) → วางลิงก์ → ตั้งชื่อ → **เข้าร่วมห้อง**
3. ทั้งคู่กด **ฉันพร้อมแล้ว** → เจ้าของห้องกด **เริ่มเกม**

ข้อควรรู้:

- **สองแท็บใน profile เดียวกันคือผู้เล่นคนเดียวกัน** ไม่กินที่นั่งที่สอง (ตั้งใจไว้แบบนี้)
- ปิดแท็บไม่ถือว่าออกจากห้อง ต้องกด **ออกจากห้อง** และยืนยัน ซึ่งจะปิดห้องให้ทั้งคู่
- เกมไม่มีแชตหรือเสียงในตัว คุยกันต่อหน้าหรือโทรหากันระหว่างเล่น

---

## เล่นผ่าน LAN

ให้เครื่องอื่นในวง Wi‑Fi เดียวกันเข้ามาเล่น:

1. หา IP ของเครื่องที่รัน: `ipconfig` → IPv4 Address เช่น `192.168.1.23`
2. ตั้ง `APP_ORIGIN` ให้ตรงกับที่ **เบราว์เซอร์ของทุกคน** จะเปิด (คั่นหลายค่าด้วย `,` ได้):

   ```dotenv
   APP_ORIGIN=http://localhost:3000,http://192.168.1.23:3000
   ```

3. Next.js bind ทุก network interface อยู่แล้ว รัน `npm run dev` (หรือ `npm run build` แล้ว `npm run start`)
4. อนุญาตพอร์ต **3000/TCP** ใน Windows Firewall (ครั้งแรก Windows จะถาม ให้เลือก *Private networks*)
5. เครื่องอื่นเปิด `http://192.168.1.23:3000`
6. **ถ้าใช้ project จริง**: เพิ่ม `192.168.1.23` ใน Firebase console → Authentication → Settings → **Authorized domains** ไม่อย่างนั้น anonymous sign-in จะถูกปฏิเสธ

โค้ดฝั่ง client ไม่ hardcode `localhost` — ทุก request ใช้ path สัมพัทธ์ ลิงก์เชิญสร้างจาก origin ที่เปิดอยู่จริง และมีทางสำรองสำหรับ http ที่ไม่ใช่ secure context (สร้าง UUID และคัดลอกลิงก์ได้)

หมายเหตุ: emulator ฟังเฉพาะ `127.0.0.1` เครื่องอื่นจึงต่อ emulator ไม่ได้ — การเล่นผ่าน LAN ให้ใช้ project จริง

---

## Deploy ขึ้น Vercel

**deploy แล้วที่ <https://heartsyncboardgamebymingmx.vercel.app>** — ทุก push ขึ้น branch `main` ของ <https://github.com/sirasakswnk/heart-sync> จะ deploy อัตโนมัติ

ถ้าจะตั้ง deployment ใหม่เอง:

1. push โค้ดขึ้น Git provider แล้ว **Import Project** ใน Vercel (ตรวจเจอ Next.js อัตโนมัติ)
2. **Settings → Environment Variables** ใส่ทุกตัวใน `.env.example` โดย:
   - `APP_ORIGIN` = โดเมนจริง เช่น `https://heartsyncboardgamebymingmx.vercel.app` (ถ้ามีหลายโดเมนคั่นด้วย `,`)
   - `FIREBASE_SERVICE_ACCOUNT` = JSON บรรทัดเดียว (ไม่ต้องครอบ quote ใน Vercel)
   - `CRON_SECRET` = ค่าสุ่มยาว ๆ — Vercel Cron ส่งค่านี้มาใน `Authorization` header ให้เอง
   - **ห้ามตั้ง** `HS_TEST_SEED`, `FIREBASE_*_EMULATOR_HOST`, `NEXT_PUBLIC_FIREBASE_EMULATOR`
3. เพิ่มโดเมน Vercel ใน Firebase → Authentication → Settings → **Authorized domains**
4. `npm run rules:deploy -- --project <project-id>` ถ้ายังไม่เคย
5. Deploy แล้วตรวจ `https://<โดเมน>/api/health`

สิ่งที่ตั้งไว้แล้วใน [vercel.json](../vercel.json): region `sin1` (สิงคโปร์ ใกล้ผู้เล่นไทยและ RTDB `asia-southeast1`) และ cron ล้างห้องหมดอายุวันละครั้ง (20:00 UTC = 03:00 น. เวลาไทย) — แผน Hobby ของ Vercel รัน cron ได้วันละครั้ง ซึ่งพอสำหรับงานนี้ เพราะห้องหมดอายุถูกตรวจในทุกคำสั่งอยู่แล้ว

HTTPS: Vercel ให้อัตโนมัติ ไม่มี cookie ที่ต้องตั้ง `Secure` เพราะใช้ ID token ใน header แทน

---

## ข้อมูล: สำรองและล้าง

- **Emulator**: ข้อมูลหายเมื่อปิด emulator ไม่มีอะไรต้องล้าง
- **Project จริง — สำรอง**: Firebase console → Realtime Database → ⋮ → **Export JSON** หรือเปิด automated backups (แผน Blaze)
- **Project จริง — ล้างทั้งหมด**: Realtime Database → เลือกโหนด root → ลบ `rooms`, `roomCodes`, `users`, `rateLimits` (ทำเองเท่านั้น แอปไม่ลบข้อมูลอัตโนมัติตอนเริ่ม)
- **ล้างอัตโนมัติ**: cron ลบห้องที่ไม่มี activity เกิน 24 ชม. พร้อมคำตอบ คำทาย คะแนน และ receipts ทั้งหมดของห้องนั้น
- **Integration test** ลบห้อง ผู้ใช้ และบัญชี anonymous ที่สร้างเองทุกครั้งหลังรัน

---

## การทดสอบ

สรุปสิ่งที่ครอบคลุม (รายละเอียดผลการรันจริงอยู่ในรายงานส่งมอบ):

**Unit — `npm run test`** (ไม่ต้องมี Firebase)

- คะแนนตามสูตรในแผน: 10 / 8 / 6 / 2, ครบทั้ง 120 permutation อยู่ใน 0..10, ทิศการทาย A→B
- validation: permutation ผิดทุกแบบ, payload ผิดรูป, ชื่อเล่น 1–20 ตัว (นับแบบ grapheme ภาษาไทย), รหัสห้อง
- reducer: ถอนคนที่เพิ่งเข้าห้องได้เฉพาะใน lobby, บทบาทสลับทุกรอบ, คนผิดตาส่ง/กดไปต่อไม่ได้ (`NOT_YOUR_TURN`), ส่งครั้งเดียวเลื่อน phase, คะแนนเข้าคนทายเท่านั้น, retry commandId เดิมหลัง phase เปลี่ยน, payload ต่างถูก reject, คำสั่งจากรอบ/เกมเก่า, คู่หู offline, ห้องหมดอายุ, ออกจากห้อง, เกมเต็ม 6 รอบ, เต็ม 30 เสมอกัน, rematch
- ความลับ: **non-interference** — สร้างสองโลกที่ต่างกันแค่คำตอบลับของคนวาง แล้วยืนยันว่ามุมมองของคนทายเหมือนกันทุกไบต์จนถึง REVEAL (ทั้งรอบที่ host วางและรอบที่แขกวาง)
- RTDB round-trip: state/view กู้รูปร่างได้หลัง RTDB ทิ้ง null/array ว่าง
- contrast: คู่สีข้อความทุกคู่ใน `globals.css` ผ่าน WCAG AA

**Integration — `npm run test:e2e` / `npm run test:e2e:emulator`**

รัน `next dev` จริง แล้วให้ผู้เล่นแต่ละคนเป็น Firebase app แยกกัน (uid, token, การเชื่อมต่อ RTDB ของตัวเอง):

- สร้างห้อง → เข้าห้อง → คนที่สามถูกปฏิเสธ → ready → start → **ครบ 6 รอบแบบผลัดเทิร์น** → คะแนนรวม 24/16 ตรงค่าที่คำนวณล่วงหน้า → rematch → เกมใหม่เริ่มศูนย์ → ออกจากห้อง
- ทุกรอบตรวจว่ามุมมองของคนทายที่อ่านจาก RTDB ไม่มีคำตอบของคนวางก่อนเฉลย และคนผิดตาถูกปฏิเสธ
- security rules: อ่าน `state`/`turn`/view ของคนอื่นไม่ได้, เขียนเกมไม่ได้, ปลอม presence ของคนอื่นไม่ได้
- rules ของ `/live` ทุกรอบ: คนทายเขียนได้เฉพาะช่วงทาย, คนวางเขียนไม่ได้แต่อ่านได้, คนนอกอ่านไม่ได้, key ของรอบก่อน/ฟิลด์เกิน/การ์ดไม่ครบถูกปฏิเสธ, server ลบทิ้งหลังเฉลย
- join ชิงที่นั่งสุดท้ายพร้อมกัน, **คนเดียวสร้างสองห้องหรือ join สองห้องพร้อมกัน** ได้ห้องเดียวและไม่เหลือห้อง/รหัส/ที่นั่งค้าง, ส่งคำสั่งพร้อมกันสองคน, double click, retry หลังเฉลย, คำสั่งรอบเก่า
- คู่หูหลุดจริง (ตัดการเชื่อมต่อ RTDB) → `PARTNER_OFFLINE` → ต่อกลับแล้วเล่นต่อ, เปิดสองแท็บ, **รีสตาร์ต server กลางเกม** แล้ว state/receipt ยังอยู่

### ผลการรันจริง (Windows 11, Node 24.20.0)

| คำสั่ง | ผล | รันล่าสุด |
| --- | --- | --- |
| `npm run typecheck` / `npm run lint` | ผ่าน ไม่มี error/warning | 24 ก.ย. 2026 |
| `npm run test` | 187/187 ผ่าน (8 ไฟล์) | 24 ก.ย. 2026 |
| `npm run build` | ผ่าน | 24 ก.ย. 2026 |
| `npm run check:questions` | 38 ข้อถูก schema, ค่าตั้งต้นมี 25 ข้อ, ชุดพิเศษ 8 ข้อ | 24 ก.ย. 2026 |
| `npm run test:e2e:emulator` | 20/20 ผ่าน กับ Firebase Local Emulator (รวม rules ของ `/live`) | 24 ก.ย. 2026 |

ตรวจเพิ่มด้วยสคริปต์ชั่วคราวผ่าน Chrome DevTools Protocol (ไม่ได้อยู่ในชุดเทสต์ที่ส่งมอบ) กับ emulator — Chrome สอง profile (1280 px กับ 360 px) เล่นผ่าน UI จริงแบบผลัดเทิร์นครบ 6 รอบ ผ่าน 59 รายการ:
- คนทายเห็นหน้ารอพร้อมอนิเมชัน และไม่มีปุ่มส่ง · header บอกบทบาทถูกทุกรอบ
- คนวางเห็นการ์ดของคนทายขยับตาม: median 59 ms, สูงสุด 174 ms (18 ครั้ง) · หน้าดูสดไม่แสดงคะแนน
- คนทายรีเฟรชกลางการเรียงแล้วได้ลำดับเดิม และคนวางเห็นตรงกัน · คนวางรีเฟรชหน้าเฉลยแล้วคะแนนเท่าเดิม
- WebSocket frames ของคนทายก่อนเฉลยไม่มีคำตอบของคนวาง (และหลังเฉลยมีจริง จึงรู้ว่าการตรวจไวพอ)
- หน้าเฉลยมีปุ่มไปต่อเฉพาะคนวาง · หน้าสรุปเต็ม 30 ตรงกันสองฝั่ง · ไม่มี error ใน console

ตรวจเพิ่ม 24 ก.ย. 2026 ด้วยวิธีเดียวกัน (สอง profile กับ emulator) ผ่าน 4 รายการ:
- ผู้เล่นกดโลโก้กลับหน้าแรก (socket ยังต่ออยู่) → อีกฝ่ายเห็นว่าออฟไลน์ภายใน 5 วินาที และกลับเข้าห้องแล้วออนไลน์อีกครั้ง
- ตั้ง `expiresAt` ของห้องเป็นอดีต → แท็บที่เปิดค้างทั้งสองฝั่งเปลี่ยนเป็นหน้า “ห้องนี้ปิดไปแล้ว” เองโดยไม่ต้องรีโหลด

หน้า `/dev/preview` ทุกหน้าของเกมที่ 360/768/1440 px ทั้งชื่อปกติและชื่อยาว 20 ตัว: ไม่ล้นแนวนอน ปุ่ม/ลิงก์ ≥ 44×44 px และเปิด reduced motion แล้วหน้ารอหยุดนิ่ง

### หน้าตรวจ UI สำหรับนักพัฒนา

`npm run dev` แล้วเปิด `/dev/preview?screen=lobby|lobby-empty|self|waiting|guess|watch|reveal|reveal-guesser|results|join|full` (`waiting` = คนทายรอ, `watch` = คนวางดูคนทายเรียงสดด้วยข้อมูลจำลอง) (เติม `&long=1` เพื่อทดสอบชื่อยาว, `&skin=classic` เพื่อดูหน้ากระดานแบบเดิมก่อนธีมโต๊ะบอร์ดเกม, `&submit=fail` เพื่อจำลองส่งไม่สำเร็จ) — ใช้ reducer/projection ตัวจริงสร้าง state ไม่ต่อ backend และถูกปิดเป็น 404 ใน production

**ไม่มี browser-driven E2E ในชุดเทสต์** (ตกลงไว้ว่าไม่ใช้ Playwright) — การลากการ์ด, layout ที่ 360/768/1440 px, reduced motion และ screen reader ต้องตรวจด้วยมือ ดูรายการที่ควรตรวจใน [ข้อจำกัดที่ทราบ](#ข้อจำกัดที่ทราบ)

---

## ข้อจำกัดที่ทราบ

- **ล้างข้อมูลเบราว์เซอร์ = กลับที่นั่งเดิมไม่ได้** ตัวตน guest อยู่ใน IndexedDB ของ browser profile ถ้าล้าง site data/ใช้ incognito ที่ปิดไปแล้ว จะกลายเป็นผู้เล่นใหม่ (ไม่มีบัญชีถาวรใน MVP)
- ไม่มีแชต เสียง หรือวิดีโอในเกม
- ไม่มี host migration: host หลุดยังคงที่นั่งไว้ ระหว่างเล่นการไปต่อใช้ความพร้อมของทั้งคู่
- ไม่มี browser-driven E2E — UI ผ่าน typecheck/lint/build และตรวจโครงสร้างแล้ว แต่ยังต้องเล่นจริงด้วยมือเพื่อยืนยันการลาก, layout มือถือ และ motion
- rate limit ของ create/join เก็บใน RTDB ต่อ uid และต่อ IP (hash) — บัญชี anonymous สร้างใหม่ได้ง่ายจึงพึ่ง IP ร่วมด้วย ถ้าเล่นหลายคนหลัง NAT เดียวกันอาจชนเพดาน (สร้างห้อง 10 ครั้ง/10 นาที ต่อ IP)
- Firebase free tier (Spark) มีโควต้าการเชื่อมต่อพร้อมกัน/แบนด์วิดท์ของ RTDB — ถ้าคนเล่นเยอะให้ดูหน้า Usage
- cron บน Vercel Hobby รันได้วันละครั้ง ห้องที่หมดอายุจึงอาจค้างในฐานข้อมูลได้ถึง ~1 วันก่อนถูกลบ (แต่ใช้ต่อไม่ได้ตั้งแต่ครบ 24 ชม. และแท็บที่เปิดค้างจะเปลี่ยนเป็นหน้าห้องปิดเองเมื่อถึงเวลา)
- ฟอนต์ Noto Sans Thai bundle ผ่าน `@fontsource/noto-sans-thai` (SIL OFL 1.1) — license อยู่ที่ [licenses/NotoSansThai-OFL.txt](../licenses/NotoSansThai-OFL.txt)

### แก้ปัญหาที่พบบ่อย

- **emulator ขึ้นไม่ได้ “port taken”** — Java ของ Database Emulator ค้างจากรอบก่อน (พบบน Windows) `npm run test:e2e:emulator` เก็บกวาดให้อัตโนมัติ ถ้าใช้ `npm run emulators` แล้วค้าง ให้รัน:
  `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | ? CommandLine -match 'firebase-database-emulator' | % { Stop-Process -Id $_.ProcessId -Force }`
- **ใช้ emulator แล้วได้ 401 ทุกคำสั่ง** — `.env.emulator` ต้องใช้ project `demo-heart-sync` (ตรงกับ `--project` ของ emulator) ห้ามใส่ค่าของ project จริงในไฟล์นี้
- **ค่าของ project จริงไม่มีผล** — ต้องอยู่ใน `.env.local` Next.js ไม่อ่าน `.env.example`

### Backlog (นอก MVP)

บัญชีถาวร, จับคู่คนแปลกหน้า, ผู้ชม, มากกว่า 2 คน, คำถามที่ผู้เล่นแต่งเอง, export รูปผลลัพธ์, เสียงประกอบและอีโมจิ realtime, browser E2E อัตโนมัติ

---

## โครงสร้างโปรเจกต์

```text
src/
  app/                      Next.js routes: หน้า / , /room/[code] และ /api/*
  features/home/            หน้าแรก + ฉากโต๊ะตัวอย่าง (TableScene)
  features/room/            Lobby, จัดอันดับ, รอคู่หู, ดูคนทายเรียงสด, เฉลย, สรุปคะแนน
                            (หน้าละหนึ่ง .module.css: lobby / waiting / reveal / results)
  components/               RankBoard + RankList (dnd-kit), Avatar, Button, Banner, ConfirmDialog, ProfileFields
  lib/game/                 กติกาล้วน (ห้าม import Firebase): reducer, scoring, projection, schemas
  lib/server/               firebase-admin, auth, transaction ของห้อง, rate limit
  lib/client/               firebase client, useRoom (realtime + resync), drafts
  data/questions.th.json    คลังคำถาม (6 หมวด + ชุดพิเศษ)
tests/unit/                 unit tests
tests/integration/          สองผู้เล่นกับ backend จริง
database.rules.json         security rules ของ RTDB (ส่วนสำคัญของความลับ)
vercel.json                 region + cron
```
