// Signed, expiring tokens: "<base64url(json)>.<hmac>". Used for sign-in links and the session cookie.
import { b64url, hmacHex, randomId, safeEqual, unb64url } from './crypto';

export const LINK_TTL_MS = 15 * 60 * 1000;        // sign-in links work for 15 minutes
export const SESSION_TTL_MS = 30 * 86_400_000;    // stay signed in for 30 days

async function sign(secret: string, kind: string, data: Record<string, unknown>): Promise<string> {
  const body = b64url(JSON.stringify({ ...data, k: kind }));
  return `${body}.${await hmacHex(secret, body)}`;
}

async function verify<T>(secret: string, kind: string, token: string, now: number): Promise<T | null> {
  const [body, sig, extra] = (token || '').split('.');
  if (!body || !sig || extra !== undefined) return null;
  if (!safeEqual(sig, await hmacHex(secret, body))) return null;
  try {
    const data = JSON.parse(unb64url(body));
    if (data.k !== kind || typeof data.x !== 'number' || data.x < now) return null;
    return data as T;
  } catch {
    return null;
  }
}

export type LinkToken = { e: string; n: string; x: number };
export type SessionToken = { m: number; x: number };

export function makeLinkToken(secret: string, email: string, now = Date.now()) {
  return sign(secret, 'link', { e: email.toLowerCase(), n: randomId(), x: now + LINK_TTL_MS });
}

export function readLinkToken(secret: string, token: string, now = Date.now()) {
  return verify<LinkToken>(secret, 'link', token, now);
}

export function makeSessionToken(secret: string, memberId: number, now = Date.now()) {
  return sign(secret, 'session', { m: memberId, x: now + SESSION_TTL_MS });
}

export function readSessionToken(secret: string, token: string, now = Date.now()) {
  return verify<SessionToken>(secret, 'session', token, now);
}
