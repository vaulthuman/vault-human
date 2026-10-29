import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { handleEvent, isTestKey, verifySignature } from '../src/lib/stripe';
import { testDb } from './sqlite-d1';

const SECRET = 'whsec_test_placeholder';
const sign = (payload: string, t: number, secret = SECRET) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

describe('webhook signature', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
  const now = 1_800_000_000;
  it('accepts a valid signature', async () => expect(await verifySignature(body, sign(body, now), SECRET, now)).toBe(true));
  it('accepts when one of several v1 signatures matches', async () =>
    expect(await verifySignature(body, `t=${now},v1=deadbeef,${sign(body, now).split(',')[1]}`, SECRET, now)).toBe(true));
  it('rejects a tampered body', async () =>
    expect(await verifySignature(body + ' ', sign(body, now), SECRET, now)).toBe(false));
  it('rejects the wrong secret', async () =>
    expect(await verifySignature(body, sign(body, now, 'whsec_other'), SECRET, now)).toBe(false));
  it('rejects an old timestamp (replay)', async () =>
    expect(await verifySignature(body, sign(body, now - 301), SECRET, now)).toBe(false));
  it('rejects a missing or malformed header', async () => {
    expect(await verifySignature(body, null, SECRET, now)).toBe(false);
    expect(await verifySignature(body, 'garbage', SECRET, now)).toBe(false);
    expect(await verifySignature(body, `t=${now}`, SECRET, now)).toBe(false);
  });
});

describe('test-mode keys only', () => {
  it('accepts test keys and refuses live ones', () => {
    expect(isTestKey('sk_test_abc')).toBe(true);
    expect(isTestKey('rk_test_abc')).toBe(true);
    expect(isTestKey('sk_live_abc')).toBe(false);
    expect(isTestKey('')).toBe(false);
    expect(isTestKey(undefined)).toBe(false);
  });
});

describe('access rules', () => {
  const now = new Date('2026-10-28T15:00:00Z');
  const setup = (statuses: Record<string, string> = { sub_1: 'active' }) => {
    const db = testDb();
    const deps = { db, now, subscriptionStatus: async (id: string) => statuses[id] ?? null };
    const member = (email = 'new@example.com') => db.raw.prepare('SELECT * FROM members WHERE email = ?').get(email) as any;
    return { db, deps, member };
  };
  const paid = (id: string, extra: object = {}) => ({
    id, type: 'invoice.paid',
    data: { object: { customer: 'cus_1', customer_email: 'New@Example.com', customer_name: 'Nell Example', subscription: 'sub_1', ...extra } },
  });
  const subEvent = (id: string, type: string, status: string) => ({
    id, type, data: { object: { id: 'sub_1', customer: 'cus_1', status } },
  });

  it('opens access on invoice.paid with an active subscription, creating the member', async () => {
    const { deps, member } = setup();
    expect(await handleEvent(paid('evt_1'), deps)).toMatchObject({ action: 'opened' });
    expect(member()).toMatchObject({ access: 1, name: 'Nell Example', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', started_on: '2026-10-28' });
  });

  it('links an existing member by email', async () => {
    const { db, deps, member } = setup();
    db.raw.exec("INSERT INTO members (email, started_on) VALUES ('new@example.com', '2026-01-01')");
    await handleEvent(paid('evt_1'), deps);
    expect(member()).toMatchObject({ access: 1, started_on: '2026-01-01', stripe_customer_id: 'cus_1' });
  });

  it('reads the subscription from the 2025+ invoice shape', async () => {
    const { deps, member } = setup();
    const ev = paid('evt_1', { subscription: undefined, parent: { subscription_details: { subscription: 'sub_1' } } });
    expect(await handleEvent(ev, deps)).toMatchObject({ action: 'opened' });
    expect(member().access).toBe(1);
  });

  it('does not open access when the subscription is not active', async () => {
    const { deps, member } = setup({ sub_1: 'past_due' });
    expect(await handleEvent(paid('evt_1'), deps)).toMatchObject({ action: 'ignored' });
    expect(member()).toBeUndefined();
  });

  it('does not open access when Stripe cannot be asked (no key)', async () => {
    const { deps } = setup({});
    expect(await handleEvent(paid('evt_1'), deps)).toMatchObject({ action: 'ignored' });
  });

  it('ignores one-off invoices with no subscription', async () => {
    const { deps } = setup();
    expect(await handleEvent(paid('evt_1', { subscription: null }), deps)).toMatchObject({ action: 'ignored' });
  });

  it('closes access on customer.subscription.deleted', async () => {
    const { deps, member } = setup();
    await handleEvent(paid('evt_1'), deps);
    expect(await handleEvent(subEvent('evt_2', 'customer.subscription.deleted', 'canceled'), deps)).toMatchObject({ action: 'closed' });
    expect(member()).toMatchObject({ access: 0, subscription_status: 'canceled' });
  });

  it.each(['unpaid', 'canceled'])('closes access when the subscription becomes %s', async (status) => {
    const { deps, member } = setup();
    await handleEvent(paid('evt_1'), deps);
    expect(await handleEvent(subEvent('evt_2', 'customer.subscription.updated', status), deps)).toMatchObject({ action: 'closed' });
    expect(member().access).toBe(0);
  });

  it('keeps access for other status changes, and does not open on them', async () => {
    const { db, deps, member } = setup();
    await handleEvent(paid('evt_1'), deps);
    await handleEvent(subEvent('evt_2', 'customer.subscription.updated', 'past_due'), deps);
    expect(member()).toMatchObject({ access: 1, subscription_status: 'past_due' });
    db.raw.exec("UPDATE members SET access = 0");
    await handleEvent(subEvent('evt_3', 'customer.subscription.updated', 'active'), deps);
    expect(member().access).toBe(0);
  });

  it('keeps access open through past_due while Stripe retries, then closes on unpaid', async () => {
    const statuses: Record<string, string> = { sub_1: 'active' };
    const { deps, member } = setup(statuses);
    await handleEvent(paid('evt_1'), deps);
    // A renewal fails: Stripe sends invoice.payment_failed and marks the subscription past_due.
    expect(await handleEvent({ id: 'evt_2', type: 'invoice.payment_failed', data: { object: { customer: 'cus_1', subscription: 'sub_1' } } }, deps))
      .toMatchObject({ action: 'ignored' });
    expect(await handleEvent(subEvent('evt_3', 'customer.subscription.updated', 'past_due'), deps)).toMatchObject({ action: 'updated' });
    expect(member()).toMatchObject({ access: 1, subscription_status: 'past_due' });
    // Retries run out.
    expect(await handleEvent(subEvent('evt_4', 'customer.subscription.updated', 'unpaid'), deps)).toMatchObject({ action: 'closed' });
    expect(member()).toMatchObject({ access: 0, subscription_status: 'unpaid' });
  });

  it('stays open when a past_due retry succeeds', async () => {
    const statuses: Record<string, string> = { sub_1: 'active' };
    const { deps, member } = setup(statuses);
    await handleEvent(paid('evt_1'), deps);
    await handleEvent(subEvent('evt_2', 'customer.subscription.updated', 'past_due'), deps);
    await handleEvent(paid('evt_3'), deps); // the retry is paid; the subscription is active again
    await handleEvent(subEvent('evt_4', 'customer.subscription.updated', 'active'), deps);
    expect(member()).toMatchObject({ access: 1, subscription_status: 'active' });
  });

  it('handles each event once', async () => {
    const { deps, member } = setup();
    await handleEvent(paid('evt_1'), deps);
    await handleEvent(subEvent('evt_2', 'customer.subscription.deleted', 'canceled'), deps);
    expect(await handleEvent(paid('evt_1'), deps)).toMatchObject({ action: 'duplicate' });
    expect(member().access).toBe(0);
  });

  it('ignores unknown customers and unhandled event types', async () => {
    const { deps } = setup();
    expect(await handleEvent(subEvent('evt_1', 'customer.subscription.deleted', 'canceled'), deps)).toMatchObject({ action: 'ignored' });
    expect(await handleEvent({ id: 'evt_2', type: 'charge.refunded', data: { object: {} } }, deps)).toMatchObject({ action: 'ignored' });
  });
});
