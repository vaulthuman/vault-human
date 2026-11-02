// Stripe: webhook signature checks, access rules, and the Customer Portal.
// The mode (test or live) follows the secret key; a webhook event must match it.
import { hmacHex, safeEqual } from './crypto';
import { localDay } from './dates';
import * as q from './db';
import type { Db, Member } from './db';

export const SIGNATURE_TOLERANCE_S = 300;

/** Only test-mode keys are accepted in v1. */
export const isTestKey = (key?: string) => !!key && /^(sk|rk)_test_/.test(key);
export const isLiveKey = (key?: string) => !!key && /^(sk|rk)_live_/.test(key);
/** 'test' or 'live' from the secret key, or null when no usable key is set. */
export const stripeMode = (key?: string): 'test' | 'live' | null => (isTestKey(key) ? 'test' : isLiveKey(key) ? 'live' : null);
/** True when the event's mode matches the key's mode (test events with a test key, live with live). */
export const eventMatchesKey = (livemode: unknown, key?: string) => {
  const mode = stripeMode(key);
  return mode !== null && (mode === 'live') === (livemode === true);
};

/** Verifies a Stripe-Signature header ("t=...,v1=...") against the raw body. */
export async function verifySignature(
  payload: string,
  header: string | null,
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false;
  let t = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map((s) => s?.trim());
    if (k === 't') t = v;
    if (k === 'v1' && v) v1.push(v);
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || !v1.length || Math.abs(nowS - ts) > SIGNATURE_TOLERANCE_S) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return v1.some((sig) => safeEqual(sig, expected));
}

type StripeEvent = { id: string; type: string; data: { object: any } };
export type Deps = {
  db: Db;
  /** Looks up a subscription's current status in Stripe; null when Stripe isn't configured. */
  subscriptionStatus: (id: string) => Promise<string | null>;
  now?: Date;
};
export type Outcome = { action: 'opened' | 'closed' | 'updated' | 'ignored' | 'duplicate'; reason?: string; memberId?: number; welcome?: boolean };

const CLOSING = new Set(['unpaid', 'canceled']);
// A free-week trial counts as membership: the member has given a card and Stripe charges on day 8.
const OPENING = new Set(['active', 'trialing']);
const id = (v: any): string | null => (typeof v === 'string' ? v : v?.id ?? null);

// Older API versions put the subscription on the invoice; 2025+ versions put it under `parent`.
const invoiceSubscription = (inv: any): string | null =>
  id(inv.subscription) ?? id(inv.parent?.subscription_details?.subscription);

export async function handleEvent(event: StripeEvent, deps: Deps): Promise<Outcome> {
  const { db } = deps;
  if (await q.eventSeen(db, event.id)) return { action: 'duplicate' };
  const out = await apply(event, deps);
  await q.recordEvent(db, event.id, event.type);
  return out;
}

async function apply(event: StripeEvent, { db, subscriptionStatus, now = new Date() }: Deps): Promise<Outcome> {
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case 'invoice.paid': {
      const customer = id(obj.customer);
      const sub = invoiceSubscription(obj);
      if (!customer || !sub) return { action: 'ignored', reason: 'not a subscription invoice' };
      const status = await subscriptionStatus(sub);
      if (!status || !OPENING.has(status)) return { action: 'ignored', reason: `subscription status ${status ?? 'unknown'}` };
      let member: Member | null = await q.memberByCustomer(db, customer);
      const email = typeof obj.customer_email === 'string' ? obj.customer_email : null;
      const name = typeof obj.customer_name === 'string' ? obj.customer_name : null;
      let created = false;
      if (!member && email) {
        member = await q.memberByEmail(db, email);
        if (!member) { member = await q.createMember(db, email, localDay(now), name); created = true; }
        else if (!mayLinkByEmail(member, customer)) {
          // Someone else paid with this member's email while the member already has an open membership.
          // Never move their billing to another customer: that would let a stranger cancel them.
          console.warn('[stripe] refused to relink open member', member.id, 'to another customer');
          return { action: 'ignored', reason: 'email belongs to an open member with another customer' };
        }
      }
      if (!member) return { action: 'ignored', reason: 'no member or email for customer' };
      const wasOpen = !!member.access;
      await q.setBilling(db, member.id, { access: true, customer, subscription: sub, status });
      return { action: 'opened', memberId: member.id, welcome: created || !wasOpen };
    }
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const customer = id(obj.customer);
      const member = customer ? await q.memberByCustomer(db, customer) : null;
      if (!member) return { action: 'ignored', reason: 'unknown customer' };
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : String(obj.status);
      if (CLOSING.has(status)) {
        await q.setBilling(db, member.id, { access: false, subscription: obj.id, status });
        return { action: 'closed', memberId: member.id };
      }
      // Any other status is recorded; access only opens on a paid invoice.
      await q.setBilling(db, member.id, { access: !!member.access, subscription: obj.id, status });
      return { action: 'updated', memberId: member.id };
    }
    default:
      return { action: 'ignored', reason: 'event type not handled' };
  }
}

async function stripeApi(key: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', ...init.headers },
  });
  const body: any = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `Stripe returned ${res.status}`);
  return body;
}

export function subscriptionStatusFrom(key?: string) {
  return async (sub: string): Promise<string | null> => {
    if (!stripeMode(key)) return null;
    return (await stripeApi(key!, `subscriptions/${encodeURIComponent(sub)}`)).status ?? null;
  };
}

export async function portalUrl(key: string, customer: string, returnUrl: string): Promise<string> {
  const body = new URLSearchParams({ customer, return_url: returnUrl });
  return (await stripeApi(key, 'billing_portal/sessions', { method: 'POST', body })).url;
}

/**
 * Finds a current subscriber by email directly in Stripe (active or in the free-week trial).
 * Used at sign-in so anyone who paid before the webhook was connected, or whose webhook was missed, still gets in.
 */
/** A member may be linked to a customer by email only when unlinked, already linked to it, or not currently open. */
export const mayLinkByEmail = (member: { stripe_customer_id: string | null; access: number }, customer: string) =>
  !member.stripe_customer_id || member.stripe_customer_id === customer || !member.access;

export async function findSubscriber(key: string | undefined, email: string): Promise<
  { customer: string; subscription: string; status: string; name: string | null } | null
> {
  if (!stripeMode(key)) return null;
  // Stripe's email filter is case-sensitive: try the address as typed and in lower case.
  const variants = [...new Set([email.trim(), email.trim().toLowerCase()])];
  for (const e of variants) {
    const customers = await stripeApi(key!, `customers?limit=10&email=${encodeURIComponent(e)}`);
    for (const c of customers.data ?? []) {
      const subs = await stripeApi(key!, `subscriptions?limit=10&status=all&customer=${encodeURIComponent(c.id)}`);
      // Same rule as the webhook: only active or trialing subscriptions open access.
      const open = (subs.data ?? []).find((s: any) => OPENING.has(s.status));
      if (open) return { customer: c.id, subscription: open.id, status: open.status, name: c.name ?? null };
    }
  }
  return null;
}
