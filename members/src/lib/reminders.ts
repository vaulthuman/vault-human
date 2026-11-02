// Reminders: the hourly clock that nudges each member at 8 a.m. and 8 p.m. their time, and the manual fan-out.
import { localDay, localHour } from './dates';
import { dropPushSub, openPushSubs, openPushSubsWithMembers, type Db } from './db';
import { KEYS, memberDay, OPENS_AT } from './keys';
import { isExpo, sendExpo } from './expo';
import { sendPush, type PushEnv, type PushSub } from './webpush';

/** One message to one device: Web Push for browsers and home-screen apps, Expo for the phone app. */
export const deliver = (env: PushEnv, sub: PushSub, msg: Message) => (isExpo(sub) ? sendExpo(sub, msg) : sendPush(env, sub, msg));

export type Message = { title: string; body: string; url: string; tag: string };

export const REMINDERS: Record<'morning' | 'evening', Message> = {
  morning: { title: 'Your key is open', body: 'One key, a few minutes. Open it before the day takes over.', url: '/today', tag: 'vh-morning' },
  evening: { title: 'One line before bed', body: 'What did today’s key show you? Write one line.', url: '/today', tag: 'vh-evening' },
};

/** A path on this site, or /today. Resolved the way a browser would, so tricks like "/\t/evil.example" fail. */
export function sitePath(u: unknown): string {
  if (typeof u !== 'string' || u.length > 200 || !u.startsWith('/')) return '/today';
  try {
    const base = 'https://members.invalid';
    const r = new URL(u, base);
    return r.origin === base ? r.pathname + r.search : '/today';
  } catch {
    return '/today';
  }
}

/** Builds the message from a send request: a named reminder, or a custom title and body. */
export function messageFrom(input: any): Message | null {
  if (input?.kind === 'morning' || input?.kind === 'evening') return REMINDERS[input.kind as 'morning' | 'evening'];
  const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 80) : '';
  const body = typeof input?.body === 'string' ? input.body.trim().slice(0, 240) : '';
  const url = sitePath(input?.url);
  if (!title || !body) return null;
  return { title, body, url, tag: 'vh-note' };
}

/** Sends to every device of every member with access. Removes devices the push service says are gone. */
export async function broadcast(db: Db, env: PushEnv, msg: Message, send = deliver) {
  const subs = await openPushSubs(db);
  let sent = 0, removed = 0, failed = 0;
  for (const s of subs) {
    try {
      const status = await send(env, s, msg);
      if (status === 404 || status === 410) { await dropPushSub(db, s.id); removed++; }
      else if (status >= 200 && status < 300) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { devices: subs.length, sent, removed, failed };
}

/**
 * What a member should hear at `now`, in their own time zone, or null:
 * - 8 a.m., when a new morning Key opened: its title.
 * - 8 p.m., when a new evening Key opened: its title.
 * - 8 p.m. on other days, if nothing is logged yet today: one line before bed.
 * The first morning opens at sign-up, so it never needs a nudge.
 */
export function dueMessage(member: { tz: string; started_on: string; loggedDays: string[] }, now: Date): Message | null {
  const hour = localHour(now, member.tz);
  if (hour !== OPENS_AT.morning && hour !== OPENS_AT.evening) return null;
  const today = localDay(now, member.tz);
  const day = memberDay(member.started_on, today);
  const time = hour === OPENS_AT.morning ? 'morning' : 'evening';
  const opened = KEYS.find((k) => k.day === day && k.time === time && !(k.day === 1 && time === 'morning'));
  if (opened) {
    return time === 'morning'
      ? { title: 'Your Key is open', body: `${opened.title}. A few minutes, before the day takes over.`, url: '/today', tag: 'vh-morning' }
      : { title: 'Tonight’s Key is open', body: `${opened.title}. One small step before bed.`, url: '/today', tag: 'vh-evening' };
  }
  if (time === 'evening' && !member.loggedDays.includes(today)) return REMINDERS.evening;
  return null;
}

/** The hourly clock: sends each open member's due reminder to their devices. */
export async function sendDue(db: Db, env: PushEnv, now = new Date(), send = deliver) {
  const rows = await openPushSubsWithMembers(db);
  let sent = 0, removed = 0, failed = 0, due = 0;
  for (const r of rows) {
    const msg = dueMessage({ tz: r.tz, started_on: r.started_on, loggedDays: (r.logged_days ?? '').split(',').filter(Boolean) }, now);
    if (!msg) continue;
    if (!isExpo(r) && !(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK)) continue; // browser reminders not switched on yet
    due++;
    try {
      const status = await send(env, r, msg);
      if (status === 404 || status === 410) { await dropPushSub(db, r.id); removed++; }
      else if (status >= 200 && status < 300) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { devices: rows.length, due, sent, removed, failed };
}
