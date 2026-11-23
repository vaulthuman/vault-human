// The hourly reminder clock: 8 a.m. and 8 p.m. in each member's own time zone, only when there's something to say.
import { describe, expect, it } from 'vitest';
import { savePushSub } from '../src/lib/db';
import { dueMessage, sendDue } from '../src/lib/reminders';
import { testDb } from './sqlite-d1';

// 2026-11-03 is a Tuesday; Chicago is UTC-6 in November.
const at = (iso: string) => new Date(iso);
const chicago = (start: string, loggedDays: string[] = []) => ({ tz: 'America/Chicago', started_on: start, loggedDays });

describe('what a member hears, and when', () => {
  it('names the new morning Key at 8 a.m. their time', () => {
    expect(dueMessage(chicago('2026-11-02'), at('2026-11-03T14:00:00Z'))).toMatchObject({ title: 'Your Key is open', body: expect.stringContaining('Read the label') });
  });
  it('names the new evening Key at 8 p.m.', () => {
    expect(dueMessage(chicago('2026-11-03'), at('2026-11-04T02:00:00Z'))).toMatchObject({ title: 'Tonight’s Key is open', body: expect.stringContaining('Stay in love') });
  });
  it('stays quiet at every other hour', () => {
    for (let h = 0; h < 24; h++) {
      const now = new Date(Date.UTC(2026, 10, 3, h));
      const local = (h - 6 + 24) % 24;
      if (local !== 8 && local !== 20) expect(dueMessage(chicago('2026-11-02'), now)).toBeNull();
    }
  });
  it('never nudges the first morning: it opened at sign-up', () => {
    expect(dueMessage(chicago('2026-11-03'), at('2026-11-03T14:00:00Z'))).toBeNull();
  });
  it('follows each member’s own time zone', () => {
    const london = { tz: 'Europe/London', started_on: '2026-11-02', loggedDays: [] };
    expect(dueMessage(london, at('2026-11-03T08:00:00Z'))).toMatchObject({ title: 'Your Key is open' });
    expect(dueMessage(london, at('2026-11-03T14:00:00Z'))).toBeNull();
  });
  it('after the member week: one line before bed, only if nothing is logged today', () => {
    expect(dueMessage(chicago('2026-10-01'), at('2026-11-04T02:00:00Z'))).toMatchObject({ title: 'One line before bed' });
    expect(dueMessage(chicago('2026-10-01', ['2026-11-03']), at('2026-11-04T02:00:00Z'))).toBeNull();
    expect(dueMessage(chicago('2026-10-01'), at('2026-11-03T14:00:00Z'))).toBeNull();
  });
});

describe('the clock run', () => {
  it('sends only to open members who are due, and drops dead devices', async () => {
    const db = testDb();
    db.raw.exec(`INSERT INTO members (id, email, started_on, tz, access) VALUES
      (1, 'due@example.com', '2026-11-02', 'America/Chicago', 1),
      (2, 'notdue@example.com', '2026-11-02', 'Asia/Tokyo', 1),
      (3, 'closed@example.com', '2026-11-02', 'America/Chicago', 0)`);
    await savePushSub(db, 1, 'https://fcm.googleapis.com/a', 'k', 'a');
    await savePushSub(db, 1, 'https://fcm.googleapis.com/gone', 'k', 'a');
    await savePushSub(db, 2, 'https://fcm.googleapis.com/b', 'k', 'a');
    await savePushSub(db, 3, 'https://fcm.googleapis.com/c', 'k', 'a');
    const sent: string[] = [];
    const fake = async (_e: any, s: any, m: any) => { sent.push(`${s.endpoint}|${m.title}`); return s.endpoint.endsWith('gone') ? 410 : 201; };
    expect(await sendDue(db, { VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_JWK: '{}' }, at('2026-11-03T14:00:00Z'), fake)).toEqual({ devices: 3, due: 2, sent: 1, removed: 1, failed: 0 });
    expect(sent).toEqual(['https://fcm.googleapis.com/a|Your Key is open', 'https://fcm.googleapis.com/gone|Your Key is open']);
  });

  it('reaches the phone app without browser keys, and skips browsers until those keys exist', async () => {
    const db = testDb();
    db.raw.exec("INSERT INTO members (id, email, started_on, tz, access) VALUES (1, 'due@example.com', '2026-11-02', 'America/Chicago', 1)");
    await savePushSub(db, 1, 'https://fcm.googleapis.com/a', 'k', 'a');
    await savePushSub(db, 1, 'expo:ExponentPushToken[abcdefghijklmnop]', '', '');
    const sent: string[] = [];
    const fake = async (_e: any, s: any) => { sent.push(s.endpoint); return 200; };
    expect(await sendDue(db, {}, at('2026-11-03T14:00:00Z'), fake)).toMatchObject({ due: 1, sent: 1 });
    expect(sent).toEqual(['expo:ExponentPushToken[abcdefghijklmnop]']);
  });
});
