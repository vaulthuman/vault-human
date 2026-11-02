// Each Key's own boxes: what they accept, when a Key counts as done, and that any open Key can be filled in later.
import { describe, expect, it } from 'vitest';
import { byKey, cleanValue, promptsOf, readEntries, statusOf, type Prompt } from '../src/lib/answers';
import { saveAnswers } from '../src/lib/db';
import { saveKeyForm } from '../src/lib/key-form';
import { KEYS, keyById } from '../src/lib/keys';
import { memberState } from '../src/lib/member';
import { POST as answersApi } from '../src/pages/api/app/answers';
import { testDb } from './sqlite-d1';

const p = (kind: Prompt['kind']): Prompt => ({ id: 'x', kind, label: 'x' });
const setup = (started = "date('now', '-6 days')") => {
  const db = testDb();
  db.raw.exec(`INSERT INTO members (id, email, started_on, tz, access) VALUES (1, 'm@example.com', ${started}, 'America/Chicago', 1)`);
  const member = db.raw.prepare('SELECT * FROM members WHERE id = 1').get() as any;
  return { db, member };
};
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

describe('every Key has its own boxes', () => {
  it('each of the 15 Keys has two to four boxes with unique ids', () => KEYS.forEach((k) => {
    const ps = promptsOf(k);
    expect(ps.length).toBeGreaterThanOrEqual(2);
    expect(ps.length).toBeLessThanOrEqual(4);
    expect(new Set(ps.map((x) => x.id)).size).toBe(ps.length);
    ps.forEach((x) => expect(['check', 'scale', 'text', 'long']).toContain(x.kind));
  }));
  it('Go outside asks for the number before, the number after, and what was noticed', () =>
    expect(promptsOf(keyById('B001')!).map((x) => x.kind)).toEqual(['scale', 'check', 'scale', 'text']));
});

describe('values', () => {
  it('ticks are yes or empty', () => {
    expect(cleanValue(p('check'), 'yes')).toBe('yes');
    expect(cleanValue(p('check'), 'on')).toBe('yes');
    expect(cleanValue(p('check'), '')).toBe('');
    expect(cleanValue(p('check'), null)).toBe('');
  });
  it('numbers are 1 to 10 only', () => {
    expect(cleanValue(p('scale'), '7')).toBe('7');
    expect(cleanValue(p('scale'), '10')).toBe('10');
    expect(cleanValue(p('scale'), '0')).toBe('');
    expect(cleanValue(p('scale'), '11')).toBe('');
    expect(cleanValue(p('scale'), 'x')).toBe('');
  });
  it('lines are trimmed and capped; longer answers keep their line breaks', () => {
    expect(cleanValue(p('text'), '  a   b \n c ')).toBe('a b c');
    expect(cleanValue(p('text'), 'x'.repeat(400))).toHaveLength(280);
    expect(cleanValue(p('long'), 'one\r\ntwo\n\n\n\nthree')).toBe('one\ntwo\n\nthree');
    expect(cleanValue(p('long'), 'x'.repeat(2000))).toHaveLength(1200);
  });
});

describe('done, started, to do', () => {
  const k = keyById('H004')!;
  it('is done only when every box is filled', () => {
    expect(statusOf(k, undefined)).toBe('open');
    expect(statusOf(k, { myself: 'At the creek' })).toBe('started');
    expect(statusOf(k, { myself: 'At the creek', thanks: 'Rain' })).toBe('done');
  });
  it('an earlier one-line note counts as started', () =>
    expect(statusOf(k, undefined, [{ key_id: 'H004', day: '2026-11-01', line: 'old' }])).toBe('started'));
});

describe('filling in Keys in any order', () => {
  it('saves an earlier Key, keeps other boxes, and clears an emptied one', async () => {
    const { db, member } = setup();
    const s = await memberState(db, member);
    expect((await saveKeyForm(db, member, form({ key_id: 'M002', p_belief: 'Rest is work', p_source: 'My dad', p_outside: 'yes' }), s.received))).toEqual({ keyId: 'M002' });
    expect((await memberState(db, member)).status.get('M002')).toBe('done');
    await saveKeyForm(db, member, form({ key_id: 'M002', p_belief: 'Rest is work', p_source: '' }), s.received);
    const after = await memberState(db, member);
    expect(after.answers.get('M002')).toEqual({ belief: 'Rest is work' });
    expect(after.status.get('M002')).toBe('started');
  });
  it('refuses a Key that has not opened yet', async () => {
    const { db, member } = setup("date('now')");
    const s = await memberState(db, member);
    expect(await saveKeyForm(db, member, form({ key_id: 'H004', p_myself: 'x' }), s.received)).toEqual({ error: expect.any(String) });
  });
  it('counts a day toward the streak when any Key is filled in', async () => {
    const { db, member } = setup();
    expect((await memberState(db, member)).streak).toBe(0);
    await saveAnswers(db, 1, 'B001', (await memberState(db, member)).today, [{ prompt: 'noticed', value: 'Birds' }]);
    expect((await memberState(db, member)).streak).toBe(1);
  });
  it('the phone app saves boxes the same way', async () => {
    const { db, member } = setup();
    const req = new Request('https://x/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keyId: 'H001', answers: { came_back: 'Dinner', saw: 'Jas', thanks: 'Sun', junk: 'ignored' } }) });
    const r = await answersApi({ request: req, locals: { runtime: { env: { DB: db } }, member } } as any);
    expect(r.status).toBe(200);
    expect(byKey(db.raw.prepare('SELECT key_id, prompt_id, value, day FROM answers').all() as any).get('H001')).toEqual({ came_back: 'Dinner', saw: 'Jas', thanks: 'Sun' });
  });
  it('reads only the Key’s own boxes from a form', () =>
    expect(readEntries(keyById('H003')!, (n) => ({ where: 'Store', thanks: 'Thank you', other: 'x' } as any)[n]).map((e) => e.prompt)).toEqual(['where', 'thanks']));
});
