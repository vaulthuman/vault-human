// The welcome email goes out once: when a member is created or reopened, not on every renewal.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findSubscriber, handleEvent } from '../src/lib/stripe';
import { testDb } from './sqlite-d1';

const now = new Date('2026-10-28T15:00:00Z');
const paid = (id: string) => ({
  id, type: 'invoice.paid',
  data: { object: { customer: 'cus_1', customer_email: 'new@example.com', customer_name: 'Nell Example', subscription: 'sub_1' } },
});

describe('welcome flag on invoice.paid', () => {
  const deps = (db: any, status = 'trialing') => ({ db, now, subscriptionStatus: async () => status });

  it('welcomes a brand-new member', async () => {
    const db = testDb();
    expect(await handleEvent(paid('evt_1'), deps(db))).toMatchObject({ action: 'opened', welcome: true });
  });

  it('does not welcome again on a renewal', async () => {
    const db = testDb();
    await handleEvent(paid('evt_1'), deps(db));
    expect(await handleEvent(paid('evt_2'), deps(db, 'active'))).toMatchObject({ action: 'opened', welcome: false });
  });

  it('welcomes a returning member whose access had closed', async () => {
    const db = testDb();
    db.raw.exec("INSERT INTO members (email, started_on, access) VALUES ('new@example.com', '2026-01-01', 0)");
    expect(await handleEvent(paid('evt_1'), deps(db, 'active'))).toMatchObject({ action: 'opened', welcome: true });
  });
});

describe('findSubscriber (sign-in backfill)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (routes: Record<string, unknown>) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      const hit = Object.entries(routes).find(([k]) => String(url).includes(k));
      return new Response(JSON.stringify(hit ? hit[1] : { data: [] }), { status: 200 });
    }));
    return calls;
  };

  it('finds a trialing subscriber by email', async () => {
    stub({ 'customers?': { data: [{ id: 'cus_9', name: 'Jas Example' }] }, 'subscriptions?': { data: [{ id: 'sub_9', status: 'trialing' }] } });
    expect(await findSubscriber('sk_test_x', 'jas@example.com')).toEqual({ customer: 'cus_9', subscription: 'sub_9', status: 'trialing', name: 'Jas Example' });
  });

  it('skips canceled subscriptions', async () => {
    stub({ 'customers?': { data: [{ id: 'cus_9' }] }, 'subscriptions?': { data: [{ id: 'sub_9', status: 'canceled' }] } });
    expect(await findSubscriber('sk_test_x', 'jas@example.com')).toBeNull();
  });

  it('does not call Stripe without a usable key', async () => {
    const calls = stub({});
    expect(await findSubscriber(undefined, 'jas@example.com')).toBeNull();
    expect(await findSubscriber('pk_test_x', 'jas@example.com')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('encodes the email in the query', async () => {
    const calls = stub({});
    await findSubscriber('sk_test_x', 'a+b@example.com');
    expect(calls[0]).toContain('email=a%2Bb%40example.com');
  });
});
