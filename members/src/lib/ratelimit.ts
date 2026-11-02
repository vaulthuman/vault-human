// Sign-in rate limits: a few links per email and per network each hour, so nobody can flood an inbox.
import { hmacHex } from './crypto';
import type { Db } from './db';

export const PER_EMAIL_PER_HOUR = 5;
export const PER_IP_PER_HOUR = 20;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** IPv4 as is; IPv6 cut to its /64, since one household or server gets a whole /64. */
export function ipBucket(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

export const hashIp = (secret: string, ip: string) => hmacHex(secret, `ip:${ipBucket(ip)}`);

const changes = (r: unknown) => Number((r as any)?.meta?.changes ?? (r as any)?.changes ?? 0);

/**
 * Records an attempt and returns true when it is within both limits: per key and per network, over `windowMs`.
 * One statement, so parallel requests can't slip past.
 */
export async function allowWithin(db: Db, key: string, ipHash: string, perKey: number, perIp: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const since = now - windowMs;
  const r = await db
    .prepare(
      'INSERT INTO signin_requests (email, ip, at) SELECT ?, ?, ? ' +
        'WHERE (SELECT COUNT(*) FROM signin_requests WHERE email = ? AND at > ?) < ? ' +
        'AND (SELECT COUNT(*) FROM signin_requests WHERE ip = ? AND at > ?) < ?',
    )
    .bind(key, ipHash, now, key, since, perKey, ipHash, since, perIp)
    .run();
  if (changes(r) !== 1) return false;
  await db.prepare('DELETE FROM signin_requests WHERE at < ?').bind(now - 2 * DAY).run();
  return true;
}

/** Sign-in links and app codes sent: a few per email and per network each hour. */
export const allowSignIn = (db: Db, email: string, ipHash: string, now = Date.now()) =>
  allowWithin(db, email, ipHash, PER_EMAIL_PER_HOUR, PER_IP_PER_HOUR, HOUR, now);

/** App codes sent: their own bucket, so the app can't be used to lock someone out of the website's links. */
export const allowCodeSend = (db: Db, email: string, ipHash: string, now = Date.now()) =>
  allowWithin(db, `code:${email}`, `code:${ipHash}`, PER_EMAIL_PER_HOUR, PER_IP_PER_HOUR, HOUR, now);

/** Guesses at an app code: a handful per email each day and per network each hour, so six digits can't be worn down. */
export const GUESSES_PER_EMAIL_PER_DAY = 10;
export const GUESSES_PER_IP_PER_HOUR = 30;
export const allowGuess = async (db: Db, email: string, ipHash: string, now = Date.now()) =>
  (await allowWithin(db, `guess:${email}`, `guess:${ipHash}`, GUESSES_PER_EMAIL_PER_DAY, Number.MAX_SAFE_INTEGER, DAY, now)) &&
  (await allowWithin(db, `guess-ip:${email}`, `guess:${ipHash}:h`, Number.MAX_SAFE_INTEGER, GUESSES_PER_IP_PER_HOUR, HOUR, now));
