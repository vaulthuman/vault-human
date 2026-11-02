// Sign-in rate limits: a few links per email and per network each hour, so nobody can flood an inbox.
import { hmacHex } from './crypto';
import type { Db } from './db';

export const PER_EMAIL_PER_HOUR = 5;
export const PER_IP_PER_HOUR = 20;
const HOUR = 3_600_000;

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

/** Records the request and returns true when it is within the limits. One statement, so parallel requests can't slip past. */
export async function allowSignIn(db: Db, email: string, ipHash: string, now = Date.now()): Promise<boolean> {
  const since = now - HOUR;
  const r = await db
    .prepare(
      'INSERT INTO signin_requests (email, ip, at) SELECT ?, ?, ? ' +
        'WHERE (SELECT COUNT(*) FROM signin_requests WHERE email = ? AND at > ?) < ? ' +
        'AND (SELECT COUNT(*) FROM signin_requests WHERE ip = ? AND at > ?) < ?',
    )
    .bind(email, ipHash, now, email, since, PER_EMAIL_PER_HOUR, ipHash, since, PER_IP_PER_HOUR)
    .run();
  if (changes(r) !== 1) return false;
  await db.prepare('DELETE FROM signin_requests WHERE at < ?').bind(now - 24 * HOUR).run();
  return true;
}
