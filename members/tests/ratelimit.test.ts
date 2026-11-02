import { describe, expect, it } from 'vitest';
import { allowSignIn, hashIp, PER_EMAIL_PER_HOUR, PER_IP_PER_HOUR } from '../src/lib/ratelimit';
import { testDb } from './sqlite-d1';

const T = 1_800_000_000_000;

describe('sign-in rate limits', () => {
  it('allows a few links per email each hour, then refuses', async () => {
    const db = testDb();
    for (let i = 0; i < PER_EMAIL_PER_HOUR; i++) expect(await allowSignIn(db, 'a@example.com', `ip${i}`, T + i)).toBe(true);
    expect(await allowSignIn(db, 'a@example.com', 'ipX', T + 10)).toBe(false);
    expect(await allowSignIn(db, 'b@example.com', 'ipX', T + 10)).toBe(true);
  });

  it('opens again after an hour', async () => {
    const db = testDb();
    for (let i = 0; i < PER_EMAIL_PER_HOUR; i++) await allowSignIn(db, 'a@example.com', 'ip', T);
    expect(await allowSignIn(db, 'a@example.com', 'ip', T + 3_600_001)).toBe(true);
  });

  it('caps one network across many emails', async () => {
    const db = testDb();
    for (let i = 0; i < PER_IP_PER_HOUR; i++) expect(await allowSignIn(db, `u${i}@example.com`, 'ip', T)).toBe(true);
    expect(await allowSignIn(db, 'last@example.com', 'ip', T)).toBe(false);
  });

  it('refused requests are not counted', async () => {
    const db = testDb();
    for (let i = 0; i < PER_EMAIL_PER_HOUR + 3; i++) await allowSignIn(db, 'a@example.com', 'ip', T);
    const n = (db.raw.prepare('SELECT COUNT(*) AS n FROM signin_requests').get() as any).n;
    expect(n).toBe(PER_EMAIL_PER_HOUR);
  });

  it('forgets requests older than two days', async () => {
    const db = testDb();
    await allowSignIn(db, 'a@example.com', 'ip', T);
    await allowSignIn(db, 'b@example.com', 'ip', T + 49 * 3_600_000);
    const n = (db.raw.prepare('SELECT COUNT(*) AS n FROM signin_requests').get() as any).n;
    expect(n).toBe(1);
  });

  it('stores IPs only as a keyed hash', async () => {
    const h = await hashIp('secret', '203.0.113.7');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203');
    expect(await hashIp('other', '203.0.113.7')).not.toBe(h);
  });
});
