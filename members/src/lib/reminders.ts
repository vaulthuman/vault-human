// The two daily reminders and the fan-out to every open member's devices.
import { dropPushSub, openPushSubs, type Db } from './db';
import { sendPush, type PushEnv } from './webpush';

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
export async function broadcast(db: Db, env: PushEnv, msg: Message, send = sendPush) {
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
