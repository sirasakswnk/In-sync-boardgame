import { randomUUID } from 'node:crypto';
import { get, onDisconnect, push, ref, remove, set } from 'firebase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ack,
  firebaseReady,
  Janitor,
  pick,
  Player,
  scopedBody,
  TestServer,
  viewOf,
  waitFor,
} from './harness';

describe.skipIf(!firebaseReady())('ความทนทาน: พร้อมกัน, ส่งซ้ำ, หลุด/ต่อใหม่, รีสตาร์ต (§13 ข้อ 7–14)', () => {
  const server = new TestServer();
  const janitor = new Janitor();
  let host: Player;
  let guest: Player;
  let code = '';
  let roomId = '';

  async function newPlayer(label: string) {
    const p = janitor.trackPlayer(await Player.create(label, server));
    expect((await p.profile(label.slice(0, 20), 'owl')).status).toBe(200);
    return p;
  }

  beforeAll(async () => {
    await server.start();
    host = await newPlayer('โฮสต์');
    guest = await newPlayer('แขก');
  }, 180_000);

  afterAll(async () => {
    await janitor.cleanup();
    await server.stop();
  }, 60_000);

  it('join พร้อมกันสอง request ชิงที่นั่งสุดท้าย ได้เพียงหนึ่งคน (§13 ข้อ 7)', async () => {
    const owner = await newPlayer('เจ้าของ');
    const x = await newPlayer('คนที่หนึ่ง');
    const y = await newPlayer('คนที่สอง');
    const room = await owner.createRoom();
    janitor.trackRoom(room.roomId, room.code);

    const [rx, ry] = await Promise.all([x.join(room.code), y.join(room.code)]);
    const statuses = [rx.status, ry.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = rx.status === 409 ? rx : ry;
    expect(ack(loser).code).toBe('ROOM_FULL');

    const snap = viewOf(await owner.snapshot(room.code));
    expect(snap.partner).not.toBeNull();
  });

  it('เตรียมห้องหลักสำหรับเทสต์ถัดไป', async () => {
    const room = await host.createRoom();
    code = room.code;
    roomId = room.roomId;
    janitor.trackRoom(roomId, code);
    expect((await guest.join(code)).status).toBe(200);
    await host.online(roomId);
    await guest.online(roomId);
    await host.command(code, { kind: 'ready', ready: true });
    await guest.command(code, { kind: 'ready', ready: true });
    expect(viewOf(await host.command(code, { kind: 'start' })).phase).toBe('SELF_RANK');
  });

  it('คนที่ไม่ใช่สมาชิก subscribe/อ่าน/ส่งคำสั่งไม่ได้ (§13 ข้อ 12)', async () => {
    const outsider = await newPlayer('คนนอก');
    const v = (await host.readView(roomId))!;
    const res = await outsider.command(code, scopedBody(v, 'self', pick(v, [0, 1, 2, 3, 4])));
    expect(ack(res).code).toBe('UNAUTHORIZED');
    expect(res.body.view).toBeNull();
    expect((await outsider.snapshot(code)).body.ok).toBe(false);
    expect(await outsider.canRead(`rooms/${roomId}/views/${host.uid}`)).toBe(false);
    // ไม่ได้เป็นสมาชิก จึงไม่ถูกนับเป็นคนที่สองแม้จะส่งคำสั่ง
    expect(viewOf(await host.snapshot(code)).partner!.uid).toBe(guest.uid);
  });

  it('ข้อมูลที่ไม่ถูกต้องถูกปฏิเสธ: ranking ผิด, payload ผิดรูป, Origin แปลกปลอม (§13 ข้อ 4)', async () => {
    const v = (await host.readView(roomId))!;
    const ids = v.game!.question.options.map((o) => o.id);
    const bad = [
      [ids[0], ids[0], ids[2], ids[3], ids[4]],
      [...ids.slice(0, 4)],
      [...ids.slice(0, 4), 'q99-o1'],
      [...ids, ids[0]],
    ];
    for (const optionIds of bad) {
      const r = await host.command(code, scopedBody(v, 'self', optionIds as string[]));
      expect(ack(r).code).toBe('INVALID_RANKING');
    }
    const malformed = await host.call('POST', `/api/rooms/${code}/commands`, '{"kind":"self",');
    expect(malformed.status).toBe(400);
    const noId = await host.call('POST', `/api/rooms/${code}/commands`, { kind: 'start' });
    expect(noId.status).toBe(400);
    const evil = await host.call('POST', `/api/rooms/${code}/commands`, { kind: 'start', commandId: randomUUID() }, {
      origin: 'https://evil.example',
    });
    expect(evil.status).toBe(403);
    // คำตอบไม่ถูกบันทึกจากความพยายามที่ผิด
    expect((await host.readView(roomId))!.game!.yourSelf).toBeNull();
  });

  it('ส่งพร้อมกันสองคน: คนวางสำเร็จ คนทายถูกปฏิเสธเพราะไม่ใช่ตา และ phase เลื่อนครั้งเดียว (§13 ข้อ 8)', async () => {
    const vh = (await host.readView(roomId))!;
    const vg = (await guest.readView(roomId))!;
    expect(vh.game!.role).toBe('setter');
    const [rh, rg] = await Promise.all([
      host.command(code, scopedBody(vh, 'self', pick(vh, [0, 1, 2, 3, 4]))),
      guest.command(code, scopedBody(vg, 'self', pick(vg, [4, 3, 2, 1, 0]))),
    ]);
    expect(ack(rh).ok).toBe(true);
    // ลำดับที่ transaction ตัดสินไม่แน่นอน: ถ้าคำสั่งคนวางลงก่อน phase เลื่อนไปแล้วจึงได้ WRONG_PHASE — ถูกปฏิเสธทั้งสองแบบ
    expect(['NOT_YOUR_TURN', 'WRONG_PHASE']).toContain(ack(rg).code);
    const after = (await host.readView(roomId))!;
    expect(after.phase).toBe('GUESS_RANK');
    expect(after.game!.roundIndex).toBe(0);
    expect(after.game!.yourSelf).toEqual(pick(vh, [0, 1, 2, 3, 4]));
  });

  it('retry ด้วย commandId เดิมหลัง phase เปลี่ยนได้ ack เดิม และคะแนนไม่บวกซ้ำ (§13 ข้อ 9, 10)', async () => {
    const vg = (await guest.readView(roomId))!;
    const guessId = randomUUID();
    const body = scopedBody(vg, 'guess', pick(vg, [0, 1, 2, 3, 4]));

    // double click: ส่ง commandId เดียวกันสองครั้งพร้อมกัน
    const [first, dup] = await Promise.all([guest.command(code, body, guessId), guest.command(code, body, guessId)]);
    expect(ack(first).ok).toBe(true);
    expect(ack(dup).ok).toBe(true);
    expect(ack(dup).revision).toBe(ack(first).revision);

    const revealed = (await guest.readView(roomId))!;
    expect(revealed.phase).toBe('REVEAL');
    const totals = revealed.game!.totals;
    expect(totals).toEqual({ you: 10, partner: 0 });

    // เน็ตกระตุก: client ส่งคำทายเดิมซ้ำหลัง server เปิดเฉลยไปแล้ว
    const retry = await guest.command(code, body, guessId);
    expect(ack(retry)).toMatchObject({ ok: true, commandId: guessId, revision: ack(first).revision });
    const again = (await guest.readView(roomId))!;
    expect(again.game!.totals).toEqual(totals);
    expect(again.revision).toBe(revealed.revision);

    // commandId เดิมแต่ payload ต่าง → ปฏิเสธ ไม่เขียนทับ
    const conflict = await guest.command(code, scopedBody(vg, 'guess', pick(vg, [4, 3, 2, 1, 0])), guessId);
    expect(ack(conflict).code).toBe('COMMAND_CONFLICT');
  });

  it('continue: เฉพาะคนวางกดได้ และ continue จากรอบเก่าไม่ทำให้ข้ามรอบ (§13 ข้อ 13)', async () => {
    const vh = (await host.readView(roomId))!;
    const vg = (await guest.readView(roomId))!;
    expect(ack(await guest.command(code, scopedBody(vg, 'continue'))).code).toBe('NOT_YOUR_TURN');
    expect(ack(await host.command(code, scopedBody(vh, 'continue'))).ok).toBe(true);
    const next = (await host.readView(roomId))!;
    expect(next.game!.roundIndex).toBe(1);
    expect(next.game!.role).toBe('guesser');

    const stale = await host.command(code, scopedBody(vh, 'continue'));
    expect(ack(stale).code).toBe('WRONG_PHASE');
    expect((await host.readView(roomId))!.game!.roundIndex).toBe(1);
  });

  it('คนเดียวเปิดสองแท็บยังเป็นคนเดิม ปิดแท็บหนึ่งไม่ทำให้ offline (§13 ข้อ 14)', async () => {
    // แท็บที่สองของ host = การเชื่อมต่อ presence อีกอันของ uid เดิม
    const secondTab = push(ref(host.db, `rooms/${roomId}/presence/${host.uid}`));
    await onDisconnect(secondTab).remove();
    await set(secondTab, true);
    expect(viewOf(await host.join(code)).you.seat).toBe(0);

    await remove(secondTab); // ปิดแท็บที่สอง
    const vg = (await guest.readView(roomId))!;
    // host ยังออนไลน์จากแท็บแรก: รอบ 2 แขกเป็นคนวาง ส่งได้ตามปกติ
    const r = await guest.command(code, scopedBody(vg, 'self', pick(vg, [0, 1, 2, 3, 4])));
    expect(ack(r).ok).toBe(true);
    expect(viewOf(r).phase).toBe('GUESS_RANK');
  });

  it('คู่หูหลุด: ส่งไม่ได้ (PARTNER_OFFLINE) แต่ไม่ rollback; ต่อกลับแล้วอยู่ที่เดิม (§11, §13 ข้อ 11)', async () => {
    guest.offline();
    await waitFor(
      async () => (await get(ref(host.db, `rooms/${roomId}/presence/${guest.uid}`))).val() === null,
      'server ลบ presence ของแขกหลังหลุด',
    );

    const vh = (await host.readView(roomId))!;
    const blocked = await host.command(code, scopedBody(vh, 'guess', pick(vh, [0, 1, 2, 3, 4])));
    expect(ack(blocked).code).toBe('PARTNER_OFFLINE');
    expect((await host.readView(roomId))!.game!.yourGuess).toBeNull();

    await guest.online(roomId);
    const vg = (await guest.readView(roomId))!;
    // คำตอบของแขกที่ส่งไปก่อนหลุดยังอยู่
    expect(vg.phase).toBe('GUESS_RANK');
    expect(vg.game!.roundIndex).toBe(1);
    expect(vg.game!.yourSelf).toEqual(pick(vg, [0, 1, 2, 3, 4]));
  });

  it('รีสตาร์ต server กลางเกมแล้ว state/คะแนน/receipt ยังอยู่ครบ (§11, §13 ข้อ 11)', async () => {
    const before = viewOf(await host.snapshot(code));
    const vh = (await host.readView(roomId))!;
    const guessId = randomUUID();
    const body = scopedBody(vh, 'guess', pick(vh, [0, 1, 2, 3, 4]));
    const sent = await host.command(code, body, guessId);
    expect(ack(sent).ok).toBe(true);
    const revealed = viewOf(sent);
    expect(revealed.phase).toBe('REVEAL');
    expect(revealed.game!.totals.you).toBe(before.game!.totals.you + 10);

    const port = server.port;
    await server.stop();
    await server.start(port);

    const after = viewOf(await host.snapshot(code));
    expect(after.game!.id).toBe(before.game!.id);
    expect(after.phase).toBe('REVEAL');
    expect(after.game!.yourGuess).toEqual(body.kind === 'guess' ? body.optionIds : null);
    expect(after.game!.totals).toEqual(revealed.game!.totals);
    // receipt ถูกเก็บใน DB: retry หลังรีสตาร์ตได้ ack เดิม
    const retry = await host.command(code, body, guessId);
    expect(ack(retry)).toMatchObject({ ok: true, commandId: guessId, revision: ack(sent).revision });
  }, 240_000);

  it('ผู้ใช้มีห้องที่ active ได้ครั้งละห้องเดียว', async () => {
    const res = await host.call('POST', '/api/rooms');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_IN_ROOM');
    expect(res.body.activeCode).toBe(code);
  });

  it('โปรไฟล์ถูกล็อกระหว่างเกม', async () => {
    const res = await host.profile('ชื่อใหม่', 'panda');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROFILE_LOCKED');
  });
});
