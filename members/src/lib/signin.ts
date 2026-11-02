// Who may receive a sign-in link or code: an existing member, or someone who paid in Stripe but isn't here yet
// (joined before the app was connected, or a missed webhook), who is brought in on the spot.
import { localDay } from './dates';
import { createMember, memberByEmail, setBilling, type Db, type Member } from './db';
import { findSubscriber, mayLinkByEmail } from './stripe';

export async function memberForSignIn(env: { DB: Db; STRIPE_SECRET_KEY?: string }, typed: string): Promise<Member | null> {
  const email = typed.trim().toLowerCase();
  let member = await memberByEmail(env.DB, email);
  if (!member || !member.access) {
    try {
      const sub = await findSubscriber(env.STRIPE_SECRET_KEY, typed.trim());
      if (sub && (!member || mayLinkByEmail(member, sub.customer))) {
        member = member ?? (await createMember(env.DB, email, localDay(new Date()), sub.name));
        await setBilling(env.DB, member.id, { access: true, customer: sub.customer, subscription: sub.subscription, status: sub.status });
      }
    } catch (e) {
      console.error('[signin] Stripe lookup failed', (e as Error).message);
    }
  }
  return member;
}

export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
