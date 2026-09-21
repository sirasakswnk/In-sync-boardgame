# แผนพัฒนา “ใจตรงกันแค่ไหน” — Heart Sync

เอกสารส่งต่อ Claude Code / Codex · ฉบับ 1.0 · 21 กันยายน 2026

## 1. คำสั่งสำหรับ Coding Agent

สร้างเว็บเกมภาษาไทยสำหรับผู้เล่น 2 คนตามเอกสารนี้ ให้เล่นผ่านคนละเบราว์เซอร์หรือคนละอุปกรณ์ได้จริง ตั้งแต่สร้างห้องจนจบเกม อ่านเอกสารทั้งหมดและตรวจ repository เดิมก่อนเริ่ม หากมี AGENTS.md ให้ปฏิบัติตาม และรักษางานเดิมที่ไม่เกี่ยวข้อง

- ถ้าเป็น repository ใหม่ ใช้สถาปัตยกรรมเริ่มต้นในข้อ 8 หากมีระบบเดิม ให้ใช้ของเดิมเมื่อรองรับข้อกำหนดได้ พร้อมบันทึกเหตุผลของสิ่งที่เปลี่ยน
- ลงมือทำเป็น milestone และปรับ checklist ในเอกสารนี้ตามความจริง อย่าจบที่ mockup หรือ frontend ที่จำลองผู้เล่นอีกคน
- ตัดสินใจรายละเอียดเล็กน้อยได้เอง ยึดกติกาในเอกสารนี้เป็นหลัก ถ้าติดข้อจำกัดให้แจ้งสาเหตุและสิ่งที่ทำได้แล้วอย่างตรงไปตรงมา
- ตรวจ API/เวอร์ชันของ dependency จากเอกสารทางการเมื่อเริ่มติดตั้ง ใช้รุ่น stable ที่เข้ากันและบันทึก lockfile ไม่จำเป็นต้องใช้รุ่นล่าสุดทุกตัว
- UI และข้อความข้อผิดพลาดใช้ภาษาไทย โค้ด ชื่อตัวแปร และโครงสร้างข้อมูลใช้ภาษาอังกฤษ
- ทำให้รันในเครื่องได้โดยไม่ต้องสมัครบริการภายนอกหรือใส่ API key
- ส่งมอบซอร์สโค้ด README, .env.example, migrations, seed questions, tests และหลักฐานการตรวจงานจริง
- เอกสารนี้อนุญาตให้พัฒนาและทดสอบในเครื่อง การเผยแพร่สาธารณะให้ดำเนินการเมื่อผู้ใช้สั่งและมีปลายทางชัดเจน

## 2. Product brief

**แนวคิด:** ทั้งสองคนจัดอันดับคำตอบตามความชอบของตัวเอง จากนั้นทายอันดับของอีกคน แล้วเปิดเฉลยพร้อมกัน

**ความสนุกหลัก:** ได้ลุ้นว่ารู้ใจอีกคนแค่ไหน และได้คุยว่า “ทำไมถึงเลือกแบบนั้น?” ใช้ได้กับเพื่อน คู่รัก หรือคนที่กำลังทำความรู้จักกัน

**ประสบการณ์:** เว็บบอร์ดเกมการ์ดสีสันสดใส มี motion ขณะเรียงและเฉลย อ่านง่ายบนมือถือและเดสก์ท็อป ไม่ใช่หน้าฟอร์มสำรวจหรือแดชบอร์ดธุรกิจ

**เป้าหมาย MVP:** เกมละ 6 คำถาม ตั้งเป้าเล่นประมาณ 10–15 นาที แต่ไม่จำกัดเวลา เพราะบทสนทนาเป็นส่วนหนึ่งของการเล่น

ชื่อ Heart Sync เป็น working title ปรับได้ภายหลัง ชื่อหลักใน UI คือ “ใจตรงกันแค่ไหน”

## 3. ขอบเขต

### ต้องมีใน MVP

- สร้างห้องส่วนตัวและเข้าด้วยรหัส/ลิงก์ รับผู้เล่นสองคนเท่านั้น
- Guest session แบบไม่ต้องสมัครสมาชิก ตั้งชื่อเล่นและเลือกอวาตาร์จากชุดสำเร็จ
- Lobby เลือกหมวดคำถาม เห็นสถานะคู่หู และยืนยันพร้อม
- หนึ่งเกมมี 6 รอบ รอบละ 5 ตัวเลือก จัดอันดับแบบไม่มีอันดับร่วม
- เล่นพร้อมกันในแต่ละช่วง: จัดของตัวเอง → ทายอีกคน → เฉลย
- ลากเรียงการ์ดได้ พร้อมปุ่มขึ้น/ลงและการควบคุมด้วยคีย์บอร์ด
- คำตอบและคำทายของคู่หูเป็นความลับก่อนเฉลย
- คะแนนที่ server คำนวณ สรุปรายข้อและคะแนนรวม เสมอได้
- หน้าเฉลยที่สลับดูได้ว่าฝ่ายใดทายอีกฝ่ายอย่างไร
- รอทั้งสองคนกดไปต่อก่อนเปลี่ยนรอบ และเริ่มใหม่เมื่อทั้งคู่ตกลง
- รีเฟรช/เชื่อมต่อใหม่แล้วยังกลับเข้าที่นั่งเดิมและเกมเดิมได้
- ชุดคำถามตั้งต้น 30 ข้อ และสุ่มไม่ซ้ำภายในเกม
- Responsive UI, reduced motion, สถานะกำลังส่ง/รอ/ผิดพลาดชัดเจน

### ยังไม่ทำใน MVP

บัญชีถาวร, จับคู่คนแปลกหน้า, ผู้ชม, มากกว่า 2 คน, bot, AI สร้างคำถาม, voice/video/chat ในตัว, leaderboard สาธารณะ, monetization, คำถามที่ผู้เล่นแต่งเอง, โบนัสมั่นใจ, export รูปผลลัพธ์, ระบบข้ามคำถามกลางเกม

ใช้การคุยกันตรง ๆ หรือแอปโทรที่ผู้เล่นมีอยู่แล้ว ไม่ต้องขอสิทธิ์ไมโครโฟน

## 4. กติกาที่ต้องใช้ตรงกัน

### 4.1 ก่อนเริ่ม

1. ผู้สร้างตั้งชื่อเล่นและอวาตาร์ แล้วสร้างห้อง ได้รหัสตัวอักษร/ตัวเลข 6 ตัวที่ไม่กำกวม
2. อีกคนเปิดลิงก์ห้องหรือใส่รหัส ตั้งชื่อและเข้าที่นั่งที่สอง
3. ผู้สร้างเลือกหมวดอย่างน้อย 1 หมวด ค่าเริ่มต้นคือเลือกทุกหมวดทั่วไป หมวดความสัมพันธ์ปิดไว้ก่อน
4. ต้องมีคำถามในหมวดที่เลือกรวมกันอย่างน้อย 6 ข้อ หากไม่พอ ปิดปุ่มเริ่มและอธิบายให้เลือกเพิ่ม
5. ทั้งคู่กดพร้อม ผู้สร้างกดเริ่มได้เมื่อทั้งสองออนไลน์และพร้อม
6. เปลี่ยนหมวดแล้วรีเซ็ตความพร้อมของทั้งคู่ เพื่อให้เห็นการตั้งค่าใหม่ก่อนเริ่ม
7. Server สุ่มชุดคำถาม 6 ข้อครั้งเดียว บันทึกลำดับและ snapshot ของคำถาม ตัวเลือก และเวอร์ชันไว้ในเกม

### 4.2 SELF_RANK — “สำหรับฉัน…”

- ทั้งสองเห็นคำถามเดียวกันและ 5 ตัวเลือกเดียวกัน พร้อมป้ายหัว/ท้ายของลำดับ เช่น “อยากทำมากที่สุด” ถึง “อยากทำน้อยที่สุด”
- ลำดับตั้งต้นเป็นการสุ่มที่ server บันทึกแยกตามผู้เล่น/รอบ/ช่วง ไม่ใช่คำตอบของใคร และ refresh แล้วไม่สุ่มใหม่
- ลากเรียงหรือใช้ปุ่มขึ้น/ลงได้ อนุญาตยืนยันลำดับตั้งต้นโดยไม่ลาก
- กด “ยืนยันอันดับของฉัน” แล้ว server ล็อกคำตอบ ห้ามแก้ภายหลัง
- ก่อน server ตอบสำเร็จ ต้องไม่แสดงว่าล็อกแล้ว ถ้าส่งไม่สำเร็จเก็บ draft และให้ลองใหม่
- คนที่ส่งแล้วเห็นคำตอบตัวเองแบบอ่านอย่างเดียวและสถานะรออีกคน
- เมื่อครบสองคำตอบ จึงเปลี่ยนทั้งห้องเป็น GUESS_RANK

### 4.3 GUESS_RANK — “ฉันคิดว่า [ชื่อคู่หู]…”

- จัดตัวเลือกเพื่อทายอันดับของคู่หู ไม่ใช่ตอบความชอบตัวเองซ้ำ
- ใช้สีและหัวเรื่องต่างจากช่วงแรก แสดงอวาตาร์คู่หูชัดเจน
- แสดงคำตอบของตัวเองในส่วนที่พับได้และติดป้ายว่าเป็นของตัวเอง
- คำทายเริ่มจากลำดับสุ่มแยก ไม่ prefill ตามคำตอบส่วนตัว
- กด “ล็อกคำทาย” เมื่อ server รับแล้วแก้ไม่ได้
- ต้องรับคำทายครบทั้งสองคนก่อนเปิดข้อมูลลับหรือคะแนนใด ๆ ของรอบนี้

### 4.4 REVEAL — เปิดเฉลยและคุยกัน

- เมื่อคำทายครบ server คำนวณคะแนนสองฝั่งและเปลี่ยน phase ใน transaction เดียว แล้วส่ง reveal payload
- มีสองแท็บ “คุณทาย [คู่หู]” และ “[คู่หู] ทายคุณ” แต่ละแท็บเปรียบเทียบคำทายกับคำตอบจริง
- เปิดอันดับ 1 ถึง 5 อย่างกระชับ มีปุ่ม “ดูทั้งหมด” ไม่ต้องรอ animation เพื่อใช้งาน
- คะแนนควรระบุผลต่อการ์ดอย่างชัดเจน เช่น “เน็ตหลุด: ทายอันดับ 2 / จริงอันดับ 3 / +1” การวางแถวเทียบตำแหน่งอย่างเดียวอาจทำให้เข้าใจคะแนนคลาดเคลื่อน
- แสดงคะแนนรอบนี้และรวม พร้อมข้อความสนทนา เช่น “ข้อไหนทำให้คุณแปลกใจที่สุด?”
- เพิ่มข้อมูล “อันดับหนึ่งเหมือนกัน” ได้ แยกจากคะแนนทายใจ
- ไม่มีนาฬิกานับถอยหลัง ทั้งคู่ต้องกด “พร้อมไปข้อต่อไป” จึงเริ่มรอบใหม่
- รอบที่ 6 ปุ่มเปลี่ยนเป็น “ดูผลรวม” และรอทั้งสองเช่นเดิม
- การเฉลยพร้อมกันหมายถึง server อนุญาตข้อมูลใน phase เดียว ไม่ต้องซิงก์ animation แบบแม่นยำระดับเฟรม

### 4.5 RESULTS และเล่นอีกครั้ง

- แสดงคะแนนแต่ละคนจากเต็ม 60 พร้อมผลชนะ/เสมอ ใช้ข้อความเป็นมิตร
- แสดงรอบที่ทายได้คะแนนสูงที่สุด ถ้าหลายรอบเท่ากันเลือกข้อแรกตามลำดับเกม
- แสดงจำนวนครั้งที่ทั้งคู่เลือกอันดับหนึ่งเหมือนกัน โดยไม่เรียกเป็นคะแนนความรักหรือความเข้ากันได้ทางจิตวิทยา
- ย้อนดูเฉลยของทั้ง 6 รอบได้จากผลลัพธ์
- ทั้งคู่กด “เล่นอีกครั้ง” แล้วจึงสร้าง game ID ใหม่ รีเซ็ตคะแนนและคำตอบทั้งหมดในห้องเดิม
- Rematch กลับ lobby โดย reset ready ผู้สร้างปรับหมวดได้แล้วกดเริ่มตามกติกาปกติ
- เลี่ยงคำถามจากเกมที่เพิ่งจบก่อน หากคลังหมวดที่เลือกไม่พอให้เติมจากข้อเดิม แต่ห้ามซ้ำภายในเกมใหม่

## 5. คะแนน: คำนวณต่อ option ID

ใช้ rank index แบบเดียวกันทั้งระบบ (แนะนำ 0-based ในโค้ด และ 1-based ใน UI)

```text
distance(option) = abs(guessedIndex(option) - actualIndex(option))
points(option) = 2 if distance == 0
                1 if distance == 1
                0 otherwise
roundScore = sum(points(option))          // 0..10
gameScore = sum(roundScore for 6 rounds)  // 0..60
score(A) compares guess(A) against selfRank(B)
score(B) compares guess(B) against selfRank(A)
```

ตัวอย่างยืนยันผล: actual=[a,b,c,d,e], guess=[c,b,a,d,e] ได้ 0+2+0+2+2 = 6 คะแนน
actual=[a,b,c,d,e], guess=[b,a,c,d,e] ได้ 1+1+2+2+2 = 8 คะแนน
ลำดับกลับด้าน [e,d,c,b,a] เทียบ actual ข้างต้นได้ 2 คะแนน เพราะ c ยังอยู่ตรงกลาง

ห้ามคิดคะแนนจากจำนวนคู่ที่ชอบตรงกัน ห้ามเชื่อคะแนนที่ client ส่งมา ไม่ใช้ AI ตัดสิน และไม่เพิ่มโบนัสใน MVP

## 6. UX/UI และ motion

### 6.1 Visual direction

- Mood: playful, warm, tactile การ์ดมุมมนและเงาบาง มีพื้นที่หายใจ
- Background cream #FFF8F0, text #25233A, accent coral #F47676, secondary lavender #A99BEF, success teal #248477
- ค่าสีเป็นจุดเริ่มต้น ต้องตรวจ contrast จริงก่อนใช้กับข้อความ/ปุ่ม สีอ่อนให้ใช้เป็นพื้นและข้อความเข้ม
- ฟอนต์ไทย Noto Sans Thai หรือฟอนต์ไทยอ่านง่ายพร้อม fallback ใช้ไฟล์ที่มีสิทธิ์ใช้และเก็บ license หาก bundle
- Desktop จำกัดความกว้างเนื้อหา ไม่แผ่การ์ดเต็มจอจนอ่านยาก Mobile จัดแนวตั้งและปุ่มยืนยันเข้าถึงง่าย
- ใช้ CSS/SVG/icon เป็นหลัก ไม่ต้องใช้ 3D, ภาพสร้างจาก AI, วิดีโอพื้นหลัง หรือภาพราคาแพง
- ห้ามให้ UI ดูเหมือน dashboard ที่เต็มไปด้วยตาราง ตัวชี้วัด และเมนูข้างจอ

### 6.2 หน้าจอและเส้นทาง

| Route/หน้าจอ | สิ่งสำคัญ |
| --- | --- |
| `/` Home | ชื่อเกม คำโปรยสั้น วิธีเล่น 3 ขั้น ตั้งชื่อ/อวาตาร์ สร้างห้อง/เข้ารหัส |
| `/room/:code` Lobby | ที่นั่งสองคน คัดลอกลิงก์ หมวดคำถาม ปุ่มพร้อม/เริ่ม สถานะออนไลน์ |
| `/room/:code` SELF_RANK | รอบ x/6 คำถาม ลำดับ 1–5 ป้ายความหมายลำดับ การ์ดและปุ่มยืนยัน |
| `/room/:code` GUESS_RANK | อวาตาร์คู่หู หัวเรื่อง/สีที่ต่าง และปุ่มล็อกคำทาย |
| `/room/:code` REVEAL | เลือกดูผลสองฝั่ง การเปรียบเทียบ คะแนน ปุ่มดูทั้งหมดและไปต่อ |
| `/room/:code` RESULTS | คะแนนรวม รอบเด่น ประวัติเฉลย ปุ่มเล่นอีกครั้ง/ออก |
| Error state | ห้องไม่พบ/เต็ม/หมดอายุ/ปิดแล้ว พร้อมทางกลับหน้าหลัก |

หน้าเกมยึด phase ที่ server ส่ง ไม่เชื่อ URL หรือ localStorage ว่าอนุญาตให้เข้าหน้าเฉลยแล้ว

### 6.3 รายละเอียด interaction

- Drag ยกการ์ดขึ้นเล็กน้อย แสดงตำแหน่งที่จะวาง การ์ดอื่นเลื่อนแทรกประมาณ 150–220ms
- Touch ใช้ drag handle เพื่อไม่แย่ง gesture scroll มีปุ่มขึ้น/ลงเป็นทางเลือกเสมอ
- Keyboard ต้องเรียงได้ มี focus visible และประกาศการเปลี่ยนอันดับผ่าน aria-live อย่างพอดี
- ลำดับเลขอยู่กับตำแหน่ง ส่วนเนื้อหาการ์ดขยับ หลีกเลี่ยงตัวเลขที่วิ่งติดการ์ดจนสับสน
- หลังยืนยันใช้สถานะ “ส่งแล้ว • รอ [ชื่อ]” ไม่แสดงความคืบหน้าการลากของอีกคน
- Reveal ใช้ fade/slide หรือ flip สั้น ๆ เปิดครบภายในประมาณ 2 วินาที และข้ามได้
- รองรับ prefers-reduced-motion โดยแสดงผลทันทีหรือใช้ fade เบา ๆ
- อย่าใช้สีเป็นตัวบอกคะแนนอย่างเดียว ต้องมีไอคอน/ข้อความกำกับ
- พื้นที่กดอย่างน้อย 44×44 CSS px ไม่มี horizontal overflow ที่ 360px
- มีสถานะ disabled/loading ป้องกันส่งซ้ำ และข้อความข้อผิดพลาดที่บอกว่าจะทำต่ออย่างไร
- เสียงและอีโมจิ realtime เป็น optional polish หลัง core ผ่านครบ ไม่ใช่ข้อกำหนดก่อนจบ MVP

## 7. Question bank

ทุกข้อมี stable ID, category, prompt, topLabel, bottomLabel และ options 5 รายการที่มี stable ID ไม่ใช้ข้อความเป็น primary key

```ts
type Question = {
  id: string;
  version: number;
  category: 'daily' | 'food' | 'gaming' | 'hypothetical' | 'annoyances' | 'relationships';
  prompt: string;
  topLabel: string;
  bottomLabel: string;
  options: Array<{ id: string; label: string; icon?: string }>;
};
```

ให้ใช้ 30 ข้อต่อไปนี้เป็นเนื้อหาตั้งต้น เรียบเรียง label ให้กระชับได้โดยคงความหมาย สร้าง ID ของตัวเลือกแบบ q01-o1 ฯลฯ และกำหนด topLabel/bottomLabel ให้ตรงคำถาม

| ID | หมวด | เรียงจากมากไปน้อยตามโจทย์ | 5 ตัวเลือก |
| --- | --- | --- | --- |
| q01 | daily | วันหยุดว่าง ๆ อยากทำอะไรมากที่สุด? | นอนพัก / เที่ยว / เล่นเกม / เจอเพื่อน / ทำงานอดิเรก |
| q02 | daily | หลังเลิกงานหรือเลิกเรียน อยากทำอะไรก่อน? | อาบน้ำ / กินข้าว / นอนพัก / ดูคลิป / คุยกับคนสนิท |
| q03 | daily | เวลาออกจากบ้าน กลัวลืมอะไรมากที่สุด? | โทรศัพท์ / กระเป๋าเงิน / กุญแจ / หูฟัง / บัตรที่ต้องใช้ |
| q04 | daily | อยากให้มีคนช่วยทำงานบ้านอะไรมากที่สุด? | ล้างจาน / ซักผ้า / ถูพื้น / ล้างห้องน้ำ / ทำอาหาร |
| q05 | daily | อยากใช้เวลาช่วงเย็นในสถานที่ไหนมากที่สุด? | บ้าน / คาเฟ่ / สวน / ห้าง / ริมทะเล |
| q06 | food | หิวตอนเที่ยงคืน อยากกินอะไรมากที่สุด? | มาม่า / ไก่ทอด / ข้าวกะเพรา / ขนมปัง / ไอศกรีม |
| q07 | food | เลือกร้านอาหาร ให้ความสำคัญกับอะไรมากที่สุด? | รสชาติ / ราคา / ความสะอาด / บรรยากาศ / ระยะทาง |
| q08 | food | วันอากาศร้อน อยากดื่มอะไรมากที่สุด? | น้ำเปล่าเย็น / ชาเย็น / กาแฟเย็น / น้ำผลไม้ / โซดามะนาว |
| q09 | food | มื้อพิเศษ อยากกินอะไรมากที่สุด? | ชาบู / หมูกระทะ / ซูชิ / สเต๊ก / อาหารทะเล |
| q10 | food | ของหวานหลังมื้ออาหาร อยากเลือกอะไรมากที่สุด? | ไอศกรีม / เค้ก / ผลไม้ / บิงซู / ขนมไทย |
| q11 | gaming | อัปเกรดมุมคอมได้อย่างเดียว อยากเลือกอะไรก่อน? | การ์ดจอ / จอ / หูฟัง / เก้าอี้ / อินเทอร์เน็ต |
| q12 | gaming | เลือกเกมใหม่ ให้ความสำคัญกับอะไรมากที่สุด? | เนื้อเรื่อง / ภาพ / ระบบเล่น / เล่นกับเพื่อนได้ / ราคา |
| q13 | gaming | มีเวลาเล่นด้วยกัน อยากเล่นแนวไหนมากที่สุด? | ต่อสู้แข่งขัน / ร่วมมือผ่านด่าน / ไขปริศนา / สร้างเมือง / ปาร์ตี้ |
| q14 | gaming | อยากได้เทคโนโลยีอะไรมาช่วยชีวิตมากที่สุด? | หุ่นยนต์ทำความสะอาด / ผู้ช่วยจัดตาราง / แปลภาษาเรียลไทม์ / ทำอาหารอัตโนมัติ / รถขับเอง |
| q15 | gaming | ฟีเจอร์โทรศัพท์ด้านไหนสำคัญกับคุณมากที่สุด? | กล้อง / แบตเตอรี่ / ความลื่นไหล / หน้าจอ / น้ำหนักเบา |
| q16 | hypothetical | ได้พลังพิเศษหนึ่งอย่าง อยากได้อะไรมากที่สุด? | เทเลพอร์ต / หยุดเวลา / บิน / ล่องหน / เข้าใจทุกภาษา |
| q17 | hypothetical | ได้ตั๋วเที่ยวฟรี อยากไปแบบไหนมากที่สุด? | ภูเขา / ทะเล / เมืองใหญ่ / เมืองเก่า / สวนสนุก |
| q18 | hypothetical | ต้องมีเพื่อนร่วมบ้านแฟนตาซี อยากอยู่กับใครมากที่สุด? | ผีขี้กลัว / มังกรตัวเล็ก / หุ่นยนต์จู้จี้ / แมวพูดได้ / มนุษย์ต่างดาว |
| q19 | hypothetical | เรียนทักษะใดได้ทันที อยากเลือกอะไรมากที่สุด? | เล่นดนตรี / พูดภาษาใหม่ / ทำอาหาร / วาดรูป / เล่นกีฬา |
| q20 | hypothetical | เปิดร้านเล็ก ๆ ของตัวเอง อยากเปิดร้านอะไรมากที่สุด? | คาเฟ่ / ร้านหนังสือ / ร้านบอร์ดเกม / ร้านต้นไม้ / ร้านขนม |
| q21 | annoyances | เรื่องไหนทำให้หงุดหงิดมากที่สุด? | เน็ตหลุด / คนผิดนัด / แบตหมด / อาหารไม่อร่อย / เล่นเกมแพ้ |
| q22 | annoyances | เรื่องไหนทำให้หมดอารมณ์เที่ยวมากที่สุด? | ฝนตก / รถติด / คนเยอะ / ร้านปิด / ที่พักไม่ตรงปก |
| q23 | annoyances | นั่งดูหนังแล้วเจออะไรน่ารำคาญที่สุด? | คนคุยเสียงดัง / โฆษณาขัด / มีคนสปอยล์ / ภาพกระตุก / เสียงเบา |
| q24 | annoyances | ทำงานกลุ่มแล้วเจออะไรหงุดหงิดที่สุด? | ส่งงานช้า / ไม่ตอบข้อความ / เปลี่ยนโจทย์บ่อย / งานไม่ครบ / นัดเวลาไม่ตรงกัน |
| q25 | annoyances | ซื้อของออนไลน์แล้วเจออะไรเซ็งที่สุด? | ส่งช้า / สีไม่ตรง / ขนาดผิด / ของเสีย / ลดราคาหลังซื้อ |
| q26 | relationships | เวลาเหนื่อย อยากให้อีกคนทำอะไรมากที่สุด? | รับฟัง / พาไปกิน / ให้เวลาอยู่คนเดียว / ช่วยแก้ปัญหา / ชวนทำอย่างอื่น |
| q27 | relationships | อยากใช้เวลาร่วมกันแบบไหนมากที่สุด? | ทำอาหาร / เดินเล่น / ดูหนัง / เล่นเกม / เที่ยวที่ใหม่ |
| q28 | relationships | ของขวัญแบบไหนทำให้ดีใจที่สุด? | ของที่เคยบอกว่าอยากได้ / ของทำมือ / จดหมาย / มื้อพิเศษ / ทริปด้วยกัน |
| q29 | relationships | คุณให้ความสำคัญกับอะไรในมิตรภาพมากที่สุด? | รักษาคำพูด / รับฟัง / เคารพพื้นที่ส่วนตัว / ช่วยเหลือ / หัวเราะด้วยกัน |
| q30 | relationships | หลังเข้าใจผิดกัน อยากให้อีกคนเริ่มแบบไหนมากที่สุด? | คุยตรง ๆ / ให้เวลาสงบใจ / ส่งข้อความ / ขอโทษก่อน / นัดเจอกัน |

หมวด relationships เป็น opt-in ตั้งแต่ lobby ตรวจคลังตอน build/test: IDs ไม่ซ้ำ, ทุกข้อมี 5 options ไม่ซ้ำ, prompt/labels ไม่ว่าง, มีอย่างน้อย 6 ข้อในค่าตั้งต้น

## 8. สถาปัตยกรรมเริ่มต้น

ใช้ TypeScript ทั้งระบบและ npm workspaces แบบเล็ก ไม่ต้องเพิ่ม microservices

| ส่วน | ทางเลือกเริ่มต้น | วัตถุประสงค์ |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript | SPA สำหรับเกมและหน้า lobby |
| Styling | CSS Modules + CSS variables | design tokens และ responsive โดยไม่เพิ่ม UI framework ใหญ่ |
| Routing | React Router | Home/room deep link |
| Card sorting | dnd-kit ที่รองรับ React รุ่นที่เลือก | pointer/touch/keyboard และมีปุ่มขึ้นลงสำรอง |
| Backend | Node.js LTS + Express + Socket.IO | HTTP session/ห้อง และ realtime |
| Persistence | SQLite + better-sqlite3 + SQL migrations | บันทึก session เกม คำตอบ และคะแนนให้รอดจาก restart |
| Validation | Zod | ตรวจ input และ schema ร่วม |
| Tests | Vitest + Playwright | กติกา integration และเกมสอง browser contexts |

Node runtime ต้องตรงกับ engines ของ Vite และ SQLite driver รุ่นที่เลือก บันทึกเวอร์ชันใน README และ engines/.nvmrc ใช้ package-lock.json

Development: Vite proxy `/api` และ `/socket.io` ไป backend ให้ browser ใช้ origin เดียว
Production: Node process เดียว serve frontend build, API และ Socket.IO ผ่าน origin เดียว พร้อม persistent volume สำหรับ DB

ไม่ใช่ static-only deployment และไม่ควรวาง Socket.IO server นี้บนฟังก์ชันอายุสั้น ใช้ host ที่รองรับ Node process ต่อเนื่อง WebSocket และ persistent disk หากต้อง scale หลาย instance ให้เป็นงานภายหลัง

ตัวอย่างโครงสร้าง (สร้างเท่าที่จำเป็น ห้ามมีไฟล์ placeholder จำนวนมาก):

```text
apps/web/src/{pages,components,features,lib,styles}
apps/server/src/{http,socket,game,db,auth}
apps/server/migrations/
apps/server/data/questions.th.json
packages/shared/src/{types,schemas,scoring}
tests/e2e/
package.json
package-lock.json
.env.example
.gitignore
README.md
plan.md
```

แยก pure game/scoring functions ออกจาก network handlers เพื่อทดสอบง่าย ใช้ React state/reducer สำหรับ local UI ได้ ไม่ต้องเพิ่ม state library หากไม่จำเป็น

## 9. State machine และความเป็นเจ้าของข้อมูล

### 9.1 State

```text
LOBBY --host start, both ready--> SELF_RANK
SELF_RANK --both self submissions--> GUESS_RANK
GUESS_RANK --both guesses + compute scores--> REVEAL
REVEAL --both continue, rounds 1..5--> SELF_RANK(next round)
REVEAL --both continue, round 6--> RESULTS
RESULTS --both rematch--> LOBBY(new game ID)
any open room --explicit leave or inactivity expiry--> CLOSED
```

Connection status เป็นข้อมูลแยกจาก game phase ไม่สร้าง round ใหม่เมื่อ reconnect
Game phase, round index, answers, scores, question schedule และ ready flags ถูกตัดสินโดย server ทั้งหมด

### 9.2 การบันทึกขั้นต่ำ

- `sessions`: id, token_hash, display_name, avatar_id, expires_at
- `rooms`: id, unique code, host_session_id, status, active_game_id, revision, created_at, last_activity_at, expires_at
- `room_members`: room_id, session_id, seat (0/1), lobby_ready; unique(room_id,seat), unique(room_id,session_id)
- `games`: id, room_id, phase, round_index, settings_json, created_at, finished_at
- `rounds`: id, game_id, round_index, question_snapshot_json; unique(game_id,round_index)
- `round_submissions`: round_id, session_id, kind (self/guess), option_ids_json, submitted_at; unique(round_id,session_id,kind)
- `round_layouts`: round_id, session_id, stage, initial_option_ids_json; unique(round_id,session_id,stage)
- `round_results`: round_id, session_id, score, breakdown_json; unique(round_id,session_id)
- `phase_ready`: game_id, round_index, phase, session_id, action (continue/rematch); unique ตามบริบทและผู้เล่น
- `processed_commands`: session_id, command_id, payload_hash, response_json; unique(session_id,command_id)

ปรับชื่อตาราง/รวมตารางได้ แต่ต้องคง uniqueness, membership checks และความสามารถ replay/reconnect ตามนี้
เปิด SQLite foreign keys ทุก connection และใช้ transaction สำหรับรับคำสั่งพร้อมตรวจ phase/เปลี่ยน phase/คำนวณคะแนน
คำตอบไม่อยู่ใน log, analytics หรือ error response

### 9.3 ข้อมูลที่แต่ละคนมองเห็น

สร้าง `projectRoomForPlayer(fullState, viewerSessionId)` แบบ allowlist แทนการส่ง state เต็มแล้วลบไม่กี่ field

| ข้อมูล | LOBBY | SELF_RANK | GUESS_RANK | REVEAL / RESULTS |
| --- | --- | --- | --- | --- |
| ชื่อ อวาตาร์ สถานะ ready/online | ได้ | ได้ | ได้ | ได้ |
| คำถาม/ตัวเลือกของรอบปัจจุบัน | ไม่จำเป็น | ได้ | ได้ | ได้ |
| คำตอบของตัวเองที่ส่งแล้ว | ไม่มี | ได้ | ได้ | ได้ |
| คำตอบจริงของคู่หูรอบปัจจุบัน | ไม่มี | ห้าม | ห้าม | ได้ |
| คำทายของตัวเองที่ส่งแล้ว | ไม่มี | ไม่มี | ได้ | ได้ |
| คำทายของคู่หูรอบปัจจุบัน | ไม่มี | ห้าม | ห้าม | ได้ |
| อีกคนส่งครบหรือยัง (boolean) | ตาม phase | ได้ | ได้ | ได้ |
| คะแนนรอบปัจจุบัน | ไม่มี | ห้าม | ห้าม | ได้ |
| ผลรอบก่อนที่เฉลยแล้ว | ไม่มี | ได้ | ได้ | ได้ |

ห้ามส่ง secret ให้ browser ตั้งแต่ต้นแล้วซ่อนด้วย CSS หรือ encrypted payload ที่ key อยู่ใน client
การส่ง snapshot ต้องแยกตามผู้เล่น/ทุก socket ของ session นั้น อย่า broadcast payload ที่มีคำตอบส่วนตัวไปทั้งห้อง
ข้อมูล public เช่น presence แยก broadcast ได้

## 10. Session, API และ realtime contract

### 10.1 Guest identity

- `POST /api/session`: สร้าง guest session หากยังไม่มี และคืนข้อมูลโปรไฟล์ที่ไม่ลับ
- ใช้ opaque token ที่สุ่มอย่างปลอดภัยใน HttpOnly, SameSite=Lax cookie; Secure เมื่อ production HTTPS เก็บเฉพาะ hash ฝั่ง DB
- session อายุ 7 วัน การล้าง cookie ทำให้กลับที่นั่งเดิมไม่ได้ใน MVP ต้องอธิบายข้อจำกัดใน README
- `PATCH /api/session`: ตั้งชื่อ 1–20 ตัวอักษรที่มองเห็นและ avatar จาก allowlist; ระหว่าง active game ให้ล็อกโปรไฟล์เพื่อไม่ให้ชื่อเปลี่ยนกลางรอบ
- server หา player identity จาก session ไม่รับ playerId ที่ client ส่งมาเป็นหลักฐานสิทธิ์
- สองแท็บใน browser profile เดียวคือผู้เล่นคนเดียว ไม่กินอีกที่นั่ง ทดสอบสองคนด้วย browser profiles/contexts ที่แยก cookies
- HTTP mutations และ Socket.IO handshake ต้องตรวจ Origin เทียบ APP_ORIGIN และจำกัดขนาด payload; ไม่เปิด credentialed CORS แบบ wildcard

### 10.2 HTTP endpoints

| Method/path | พฤติกรรม |
| --- | --- |
| POST `/api/rooms` | สร้างห้องพร้อมที่นั่ง host และคืน code/link |
| POST `/api/rooms/:code/join` | เข้าห้องถ้ามีที่ว่าง; สมาชิกเดิมได้ที่นั่งเดิม; atomic capacity check |
| GET `/api/rooms/:code` | คืน snapshot ตามสิทธิ์เฉพาะสมาชิก ไม่เปิดข้อมูลเกมให้บุคคลที่สาม |
| GET `/api/health` | เช็ก process/DB โดยไม่เปิดข้อมูลลับ |

room code เป็นตัวค้นหาห้อง/คำเชิญเข้า seat ว่าง ไม่ใช่ credential สำหรับอ้างสิทธิ์สมาชิกที่มีอยู่
ใช้ crypto random สร้าง code และ unique constraint พร้อม retry collision มี rate limit สำหรับ create/join แยกจากการเล่นปกติ
ผู้ใช้มี active room ได้ครั้งละหนึ่งห้อง ถ้าจะสร้าง/เข้าห้องอื่นให้ UI ขอให้ออกจากห้องเดิมก่อน

### 10.3 Socket commands

ทุก command มี `commandId` (UUID), `roomCode`; game command เพิ่ม `gameId`, `roundIndex`, `expectedPhase` ส่วน payload ตามตาราง

| Command | Payload เพิ่ม | เงื่อนไข |
| --- | --- | --- |
| `room:subscribe` | ไม่มี | สมาชิกเท่านั้น; ส่ง snapshot ทันที |
| `room:settings` | categories | host, LOBBY เท่านั้น; reset ready |
| `room:ready` | ready:boolean | LOBBY |
| `game:start` | ไม่มี | host, LOBBY, ทั้งคู่พร้อม/online |
| `round:self` | optionIds:string[5] | SELF_RANK, ส่งได้ครั้งเดียว |
| `round:guess` | optionIds:string[5] | GUESS_RANK, ส่งได้ครั้งเดียว |
| `round:continue` | ไม่มี | REVEAL, รอครบสองคน |
| `game:rematch` | ไม่มี | RESULTS, รอครบสองคน |
| `room:leave` | ไม่มี | สมาชิก; ปิดห้องทั้งคู่หลังยืนยันใน UI |

Server events: `room:snapshot`, `room:presence`, `room:closed`
Ack: `{ok:true, commandId, revision}` หรือ `{ok:false, commandId, code, message}`
รหัสผิดพลาดอย่างน้อย ROOM_NOT_FOUND, ROOM_FULL, ROOM_CLOSED, UNAUTHORIZED, INVALID_RANKING, WRONG_PHASE, ALREADY_SUBMITTED, PARTNER_OFFLINE, NOT_READY

ตรวจ ranking ว่าเป็น permutation ของ option IDs ทั้ง 5 ของรอบนั้น ห้ามซ้ำ ห้ามขาด ห้าม foreign ID ห้ามเชื่อ timestamp/score จาก client

### 10.4 คำสั่งซ้ำและคำสั่งพร้อมกัน

- Deduplicate ด้วย (sessionId, commandId) ที่บันทึกใน DB พร้อม transaction เดียวกับผลคำสั่ง แล้วคืน ack เดิมเมื่อ retry payload เดิม
- commandId เดิมแต่ payload ต่างให้ reject ไม่เขียนทับ
- เพิ่ม unique constraints ของ submissions และ round_results เป็นชั้นป้องกันซ้ำอีกชั้น
- ไม่ใช้ strict global revision เป็นเงื่อนไขปฏิเสธการส่งพร้อมกันจากคนละคน เพราะทั้งคู่อาจเริ่มจาก revision เดียวได้ตามปกติ
- ตรวจ phase/game/round ใน transaction ทุกครั้ง และเพิ่ม revision เฉพาะเมื่อ authoritative game state เปลี่ยน
- client ไม่ยอมให้ snapshot revision เก่าทับใหม่ Presence ใช้ channel แยกไม่ทำให้เกม rollback
- ตรวจ receipt ของ command ที่เคยสำเร็จก่อนตรวจ phase ใหม่ เพื่อให้ retry หลัง server เลื่อน phase ได้ ack สำเร็จเดิม
- ส่ง state หลัง DB commit เท่านั้น ถ้า commit สำเร็จแต่ broadcast หาย การ resync ต้องกู้ได้

## 11. Refresh, disconnect และอายุห้อง

- Draft ที่ยังไม่ส่งเก็บใน sessionStorage แยก session/game/round/phase; ล้างเมื่อยืนยันแล้วหรือ phase เปลี่ยน
- Server ไม่เก็บทุก drag movement และไม่ส่ง draft ไปหาอีกคน
- Refresh/reconnect ต้อง fetch/subscribe เพื่อรับ snapshot ใหม่เสมอ ข้อมูล server ที่ยืนยันแล้วชนะ draft
- Socket.IO อาจพลาด event ช่วงหลุด จึงต้องมี snapshot resync ไม่ใช้ event history ใน browser เป็นแหล่งความจริง
- หาก ack timeout ให้แสดงว่ายังไม่ทราบผล รับ snapshot ตรวจสถานะก่อน retry commandId เดิม ห้ามสร้างคำตอบสำรองอัตโนมัติ
- presence นับจำนวน socket ของแต่ละ session; online เมื่ออย่างน้อยหนึ่ง socket ยังเชื่อมอยู่
- ระหว่าง offline ให้คนที่ยังอยู่เรียง draft ต่อได้ แต่ปิดปุ่ม submit/start/continue/rematch และ server reject mutation เหล่านี้เมื่อคู่หู offline; settings/ready ใน lobby และ leave ยังทำได้
- คำสั่งที่ commit ไปแล้วก่อนตรวจพบ disconnect ยังคงมีผล ห้าม rollback คะแนนเพียงเพราะเน็ตหลุด
- เชื่อมกลับแล้วเล่น phase เดิม ไม่แพ้อัตโนมัติและไม่แทนที่ที่นั่งด้วยคนใหม่
- Server restart: โหลดเกม/session/receipt จาก SQLite ได้ ตั้ง presence เป็น offline จนแต่ละคนเชื่อมกลับ
- ห้องหมดอายุเมื่อไม่มี valid activity จากผู้เล่นครบ 24 ชั่วโมง การ heartbeat/presence ไม่ต่ออายุห้อง การกระทำเกมที่สำเร็จหรือ subscribe ของสมาชิกเมื่อเปิดเกมกลับมานับเป็น activity
- ตรวจหมดอายุก่อน touch activity ทั้งใน HTTP/command/subscribe; cleanup ลบคำตอบ/session receipts ที่ผูกห้องตาม retention หลังหมดอายุ
- ผู้เล่นกดออกอย่างชัดเจนต้องมี confirmation เพราะจะจบห้องให้ทั้งคู่ ไม่ถือการปิดแท็บเป็นการออก
- MVP ไม่ต้องมี host migration: host หลุดยังรักษาที่นั่ง และระหว่างเล่นการไปต่อใช้ความพร้อมของทั้งสองไม่ต้องให้ host เป็นคนสั่ง

## 12. Milestones และเกณฑ์ผ่าน

> **สถานะจริง (21 ก.ย. 2026)** — ทุกข้อด้านล่างตรวจกับ **Firebase Local Emulator** แล้ว ยังไม่ได้รันกับ Firebase project จริง และยังไม่ได้ deploy
>
> **สถาปัตยกรรมเปลี่ยนจาก §8 ตามคำสั่งผู้ใช้**: ปลายทาง Vercel + Firebase Realtime Database แทน Express/Socket.IO/SQLite (Vercel ถือ WebSocket server ค้างไว้ไม่ได้) รายละเอียดการแมปอยู่ใน README หัวข้อ “ทำไมต่างจาก plan.md §8”
> - “migrations” = `database.rules.json` (RTDB ไม่มี schema) · “Socket authentication” = Firebase ID token + security rules · “npm workspaces” = แอป Next.js เดียว โดยกติกาล้วนแยกไว้ที่ `src/lib/game` (lint ห้าม import Firebase)
> - “สอง browser contexts” ตรวจด้วย Chrome สอง profile แยกตัวตน เล่นผ่าน UI จริงครบ 6 รอบ + rematch + ออกห้อง และตรวจ WebSocket frames ว่าไม่รั่วก่อนเฉลย (สคริปต์ตรวจชั่วคราวผ่าน CDP ไม่ได้ส่งมอบเป็นชุดเทสต์ เพราะตกลงไว้ว่าไม่ใช้ Playwright)
> - refresh ตรวจในเบราว์เซอร์จริงช่วง SELF_RANK; ช่วง GUESS/REVEAL และ restart server ตรวจผ่าน integration test (เส้นทาง snapshot เดียวกัน)
>
> **กติกาเปลี่ยนเป็นผลัดเทิร์นตามคำขอผู้ใช้ (21 ก.ย. 2026 หลัง deploy ครั้งแรก)** — ส่วนนี้แทนที่ §4.2–§4.5 และตาราง §9.3 ในจุดที่ขัดกัน:
> - แต่ละรอบมี **คนวาง** (setter) กับ **คนทาย** (guesser) สลับที่นั่งทุกรอบ รอบแรกผู้สร้างห้องวาง จึงได้ทายคนละ 3 รอบ
> - SELF_RANK: คนวางเรียงคนเดียว คนทายเห็นคำถามพร้อมหน้ารอ · GUESS_RANK: คนทายเรียงคนเดียว คนวางเห็นการเรียงแบบ realtime คู่กับคำตอบตัวเอง แต่ไม่เห็นคะแนน · ส่งครั้งเดียวก็เลื่อน phase ได้เลย
> - REVEAL: เฉลยทางเดียว คะแนนเข้าคนทาย (เต็มคนละ 30) และ **คนวางเป็นคนกดไปต่อคนเดียว** ส่วนการเล่นอีกครั้งยังต้องยืนยันทั้งคู่
> - คนผิดตาส่งคำสั่งได้ `NOT_YOUR_TURN` · ตัดป้าย “อันดับหนึ่งเหมือนกัน” ออก เพราะแต่ละรอบมีคำตอบจริงชุดเดียว หน้าสรุปใช้จำนวนการ์ดที่ทายตรงเป๊ะแทน
> - คำทายสดอยู่ที่ `/live/$roomId/$uid` ซึ่ง rules ให้เฉพาะคนทายเขียนได้ในช่วงทายของรอบนั้น ใช้แสดงผลอย่างเดียว ไม่มีผลกับคะแนน

### M1 — Project foundation และกติกา

- [x] ตั้ง workspace, scripts, typecheck, lint และ .env.example
- [x] สร้าง shared schemas, scoring และ state transition functions
- [x] สร้าง migrations + question bank 30 ข้อ พร้อม validator
- [x] ทดสอบคะแนน 10/8/6/2 และ input ผิด รวมทั้งทิศการทาย A→B

ผ่านเมื่อ pure rules ทำงานได้และคำถามทุกข้อถูก schema

### M2 — ห้องสองคนที่ใช้งานได้จริง

- [x] Guest sessions, create/join, capacity constraints, ready/settings/start
- [x] Socket authentication และ per-player snapshot projection
- [x] เปิดสอง browser contexts แล้วเห็นห้องเดียวกัน คนที่สามเข้าไม่ได้
- [x] Deep link/refresh ได้และ session เดิมไม่กินที่นั่งใหม่

ผ่านเมื่อสองคนเริ่ม SELF_RANK ใน game ID เดียวกันผ่าน backend จริง

### M3 — เกมครบ 6 รอบ

- [x] Self rank, guess rank, reveal และ continue barriers
- [x] Server scoring, score breakdown, results และ rematch reset
- [x] Unique/idempotent writes และ transaction phase advancement
- [x] ทุกปุ่มหลักมีพฤติกรรมจริง ไม่มี fake partner/fake score

ผ่านเมื่อสองคนเล่นครบ 6 รอบและเล่นอีกครั้งได้โดยไม่แก้ state เอง

### M4 — UI และ interaction

- [x] ทำทุกหน้าตาม visual direction พร้อมข้อมูลจริง
- [x] ลากการ์ดบน mouse/touch, keyboard และปุ่มขึ้นลง
- [x] Loading/waiting/error/reconnect states, reveal animation/skip/reduced motion
- [x] ตรวจที่ขนาด 360px, 768px, 1440px รวมข้อความชื่อยาว

ผ่านเมื่อเล่นตั้งแต่เข้าห้องจนจบได้ทั้ง desktop และ mobile viewport โดยไม่ติด layout

### M5 — Reliability และส่งมอบ

- [x] Refresh ระหว่าง self/guess/reveal และ restart server แล้วเล่นต่อได้
- [x] ตรวจ network payload ว่าไม่รั่วคำตอบก่อน reveal
- [x] Integration/E2E ที่ครอบคลุมความเสี่ยงจริงผ่าน
- [x] Production build + production server + room deep link ทำงาน
- [x] README, env, run/deploy instructions และ known limitations ครบ

หยุดเพิ่มฟีเจอร์เมื่อผ่านเกณฑ์แล้ว บันทึกสิ่งนอก scope ไว้เป็น backlog

## 13. Test cases ที่มีความหมาย

### กติกาและความลับ

1. ทายตรงทั้งหมดได้ 10; ตัวอย่างคะแนนข้อ 5 ได้ผลตามกำหนด; ทุกคะแนนอยู่ใน 0..10
2. สลับตำแหน่งเพียงหนึ่งคู่ติดกันได้ 8 และ reverse ได้ 2 ไม่ใช่ 0
3. A/B มีคำตอบต่างกัน ตรวจว่าคะแนน A เทียบ B และคะแนน B เทียบ A จริง
4. รับเฉพาะ permutation ครบ 5 ID; reject duplicates, unknown ID, ขาด/เกิน และ malformed payload
5. Projection ทุก phase: คน A ไม่ได้ self/guess ของ B หรือคะแนนปัจจุบันก่อน REVEAL ตรวจทั้ง HTTP และ socket
6. Submit คนเดียวไม่เลื่อน phase; เมื่อคนที่สอง submit เลื่อนครั้งเดียว; phase ผิดและ round/game เก่าถูก reject

### Network/ฐานข้อมูล

7. Join พร้อมกันสอง request เพื่อชิง seat สุดท้าย รับได้เพียงหนึ่งคน
8. ส่งคำตอบพร้อมกันได้ทั้งคู่โดยไม่ reject เพียงเพราะ global revision เปลี่ยน
9. Double click/retry ด้วย commandId เดิมให้ผลเดิม คะแนนไม่ถูกบวกซ้ำ แม้ phase เปลี่ยนแล้ว
10. Refresh หลัง submit แต่ก่อน ack แสดงข้อมูลที่ล็อกจริงจาก server และไม่เปิดให้เปลี่ยนคำตอบ
11. Socket หลุด/เชื่อมกลับ, missed events และ server restart กู้ game/phase/คะแนนจาก DB ได้
12. ผู้ใช้ที่ไม่เป็นสมาชิก subscribe/read/submit ไม่ได้; ปลอม playerId ไม่เปลี่ยน actor
13. คำสั่ง continue จากรอบเก่าหรือ rematch จากเกมเก่าไม่ทำให้ข้ามรอบ/รีเซ็ตเกมใหม่
14. คนหนึ่งเปิดสองแท็บยังเป็นผู้เล่นคนเดิม ปิดหนึ่งแท็บไม่ทำให้ offline ถ้าอีกแท็บอยู่

### End-to-end (สอง isolated browser contexts)

15. Create → join → ready → start → ครบ 6 รอบ → results; ส่งคำตอบที่รู้ผลแล้ว assert คะแนนรวมทั้งคู่จาก expected values
16. คะแนนเท่ากันแสดงเสมอ; rematch ต้องยืนยันสองคนและเกมใหม่คะแนนศูนย์
17. มือถือเรียงด้วย touch/ปุ่มได้; keyboard ทำครบ flow ได้; reduced motion ไม่บล็อกปุ่ม
18. ห้องเต็ม/หมดอายุ/ปิดแล้ว มีข้อความและทางออกที่ถูกต้อง

อย่าใช้ screenshot อย่างเดียวเป็นหลักฐาน multiplayer ต้องมีสอง session ที่คุยกับ backend จริง ใช้ fixture/seed randomness ใน test เพื่อทำผลซ้ำได้โดยไม่ใช้ค่าทดสอบใน production

## 14. Commands, configuration และการส่งมอบ

กำหนด root scripts อย่างน้อย:

```bash
npm install
npm run db:migrate
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run start
```

README ต้องระบุการติดตั้ง browser สำหรับ Playwright ถ้าจำเป็น และทุก command ต้องทำงานจริงตาม package.json

`.env.example` อย่างน้อย: `PORT`, `APP_ORIGIN`, `DATABASE_PATH`, `NODE_ENV` พร้อมค่าตัวอย่างที่ไม่ใช่ secret
ห้าม commit .env จริง, cookies/tokens, DB ที่มีคำตอบผู้ใช้, node_modules หรือไฟล์ test artifacts ขนาดใหญ่

README อธิบาย:

- Node/npm เวอร์ชันที่ใช้และวิธีเริ่มบน Windows 11
- วิธีเปิด 2 browser profiles/หน้าปกติกับ incognito เพื่อทดสอบสองผู้เล่น
- วิธีเล่นผ่าน LAN: bind address, APP_ORIGIN ที่ตรงกับ browser และ port/firewall ที่ต้องเข้าถึง โดยไม่ hardcode localhost ใน client
- Production ใช้ persistent disk, HTTPS, origin ถูกต้อง และ process เดียวใน MVP
- วิธี backup/ล้างข้อมูล local development อย่างชัดเจน ไม่ลบ DB เดิมอัตโนมัติเมื่อ start
- ล้าง cookie แล้วกู้ guest seat ไม่ได้ และเกมไม่มี chat/voice ในตัว

**Definition of Done:** ผู้เล่นสองคนบนคนละ session เล่นเกมจริงครบ 6 รอบ ดูเฉลยได้ คะแนนถูกต้อง คำตอบไม่รั่วก่อนเวลา reconnect ได้ และเริ่มเกมใหม่ได้ พร้อม source และคำสั่งรันที่ตรวจแล้ว

รายงานส่งมอบต้องบอกสิ่งที่ทำสำเร็จ คำสั่งที่รันและผลทดสอบจริง ข้อจำกัด และวิธีเปิดเล่น ห้ามระบุว่า test ผ่านถ้าไม่ได้รัน

## 15. เอกสารทางการประกอบการลงมือทำ

สถาปัตยกรรมในเอกสารนี้เป็นข้อเสนอสำหรับโปรเจกต์ ไม่ใช่ข้อบังคับจากผู้ให้บริการ ตรวจเอกสาร API รุ่นที่ติดตั้งอีกครั้งเมื่อลงมือ

- [Vite Getting Started](https://vite.dev/guide/) — ตรวจ runtime และขั้นตอนติดตั้ง/build ตามรุ่นที่เลือก
- [Socket.IO: Handling disconnections](https://socket.io/docs/v4/tutorial/handling-disconnections) — client ต้อง resync หลังพลาด event ระหว่างหลุด
- [Socket.IO: Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/) — retry/ack ไม่แทน application-level deduplication จึงต้องมี command receipts และข้อจำกัดไม่ให้คิดคะแนนซ้ำ
- [SQLite: Foreign Key Support](https://www.sqlite.org/foreignkeys.html) — เปิดและตรวจ foreign-key enforcement สำหรับความสัมพันธ์ในฐานข้อมูล

## 16. ข้อความเริ่มงานสำหรับผู้ใช้

คัดลอกข้อความนี้ส่งพร้อมไฟล์ให้ Claude Code / Codex:

> อ่าน plan.md ให้ครบ แล้วพัฒนาเว็บเกม “ใจตรงกันแค่ไหน” ตามแผนนี้ เริ่มจากตรวจ repository และทำ milestone M1 ต่อเนื่องจน MVP ใช้งานได้จริง ใช้ UI ภาษาไทย เน้นการ์ดที่สวยและโต้ตอบลื่นไหล ต้องเล่นสอง browser sessions ผ่าน backend จริง เก็บคำตอบลับจนทั้งคู่ล็อกคำทาย และรองรับ reconnect ปรับ checklist ตามสิ่งที่เสร็จจริง พร้อมทดสอบกติกา ความลับ และ flow ครบ 6 รอบ ส่งมอบซอร์สโค้ดกับ README สำหรับรันในเครื่อง ตัดสินใจรายละเอียดทั่วไปได้เอง และยังไม่ต้อง deploy สาธารณะ
