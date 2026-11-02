// Fixes from the security review: billing can't be moved off an open member, limits hold under bursts and IPv6,
// notification links stay on this site, devices per member are capped, and the backfill follows the webhook's rules.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUSH_DEVICES_PER_MEMBER, savePushSub } from '../src/lib/db';
import { allowSignIn, ipBucket, PER_EMAIL_PER_HOUR } from '../src/lib/ratelimit';
import { messageFrom, sitePath } from '../src/lib/reminders';
import { findSubscriber, handleEvent, mayLinkByEmail } from '../src/lib/stripe';
import { testDb } from './sqlite-d1';

const now = new Date('2026-10-28T15:00:00Z');
const paid = (id: string, customer: string) => ({
  id, type: 'invoice.paid',
  data: { object: { customer, customer_email: 'm@example.com', subscription: `sub_${customer}` } },
});
const deps = (db: any) => ({ db, now, subscriptionStatus: async () => 'trialing' });

describe('a stranger paying with a member’s email', () => {
  it('cannot take over an open member’s billing, so cannot cancel them', async () => {
    const db = testDb();
    await handleEvent(paid('evt_1', 'cus_real'), deps(db));
    expect(await handleEvent(paid('evt_2', 'cus_attacker'), deps(db))).toMatchObject({ action: 'ignored' });
    await handleEvent({ id: 'evt_3', type: 'customer.subscription.deleted', data: { object: { id: 'sub_cus_attacker', customer: 'cus_attacker' } } }, deps(db));
    expect(db.raw.prepare("SELECT access, stripe_customer_id FROM members WHERE email = 'm@example.com'").get()).toEqual({ access: 1, stripe_customer_id: 'cus_real' });
  });

  it('still lets a lapsed member come back under a new customer', async () => {
    const db = testDb();
    db.raw.exec("INSERT INTO members (email, started_on, access, stripe_customer_id) VALUES ('m@example.com', '2026-01-01', 0, 'cus_old')");
    expect(await handleEvent(paid('evt_1', 'cus_new'), deps(db))).toMatchObject({ action: 'opened', welcome: true });
  });

  it('link rule', () => {
    expect(mayLinkByEmail({ stripe_customer_id: null, access: 1 }, 'cus_x')).toBe(true);
    expect(mayLinkByEmail({ stripe_customer_id: 'cus_x', access: 1 }, 'cus_x')).toBe(true);
    expect(mayLinkByEmail({ stripe_customer_id: 'cus_y', access: 0 }, 'cus_x')).toBe(true);
    expect(mayLinkByEmail({ stripe_customer_id: 'cus_y', access: 1 }, 'cus_x')).toBe(false);
  });
});

describe('rate limits under pressure', () => {
  it('a burst of parallel requests gets no more than the limit', async () => {
    const db = testDb();
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => allowSignIn(db, 'a@example.com', `ip${i}`, 1_800_000_000_000)));
    expect(results.filter(Boolean)).toHaveLength(PER_EMAIL_PER_HOUR);
  });

  it('groups IPv6 addresses by /64 and leaves IPv4 alone', () => {
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7');
    expect(ipBucket('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipBucket('::1')).toBe('0:0:0:0::/64');
  });
});

describe('notification links', () => {
  it('stay on this site', () => {
    expect(sitePath('/keys?x=1')).toBe('/keys?x=1');
    expect(sitePath('/\t/evil.example')).toBe('/today');
    expect(sitePath('//evil.example')).toBe('/today');
    expect(sitePath('/\\evil.example')).toBe('/today');
    expect(sitePath('https://evil.example')).toBe('/today');
    expect(sitePath(7)).toBe('/today');
    expect(messageFrom({ title: 'a', body: 'b', url: '/\t/evil.example' })?.url).toBe('/today');
  });
});

describe('push devices', () => {
  it('keeps only the newest few per member', async () => {
    const db = testDb();
    db.raw.exec("INSERT INTO members (id, email, started_on, access) VALUES (1, 'a@example.com', '2026-01-01', 1)");
    for (let i = 0; i < 12; i++) await savePushSub(db, 1, `https://fcm.googleapis.com/${i}`, 'k', 'a');
    const rows = (db.raw.prepare('SELECT endpoint FROM push_subs ORDER BY id').all() as any[]).map((r) => r.endpoint);
    expect(rows).toHaveLength(PUSH_DEVICES_PER_MEMBER);
    expect(rows.at(-1)).toBe('https://fcm.googleapis.com/11');
  });
});

describe('sign-in backfill follows the webhook', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not open past_due, and tries the address as typed and in lower case', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('customers?')) return new Response(JSON.stringify({ data: [{ id: 'cus_1' }] }));
      return new Response(JSON.stringify({ data: [{ id: 'sub_1', status: 'past_due' }] }));
    }));
    expect(await findSubscriber('sk_test_x', 'Jas@Example.com')).toBeNull();
    expect(calls.filter((c) => c.includes('customers?')).map((c) => decodeURIComponent(c.split('email=')[1]))).toEqual(['Jas@Example.com', 'jas@example.com']);
  });
});
