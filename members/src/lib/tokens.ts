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

// Sign-in by emailed code, for the phone app. The server keeps nothing: the app holds a signed challenge
// that carries a keyed hash of the code, and the challenge's nonce is used once (same table as links).
export const CODE_TTL_MS = 10 * 60 * 1000;
export type CodeChallenge = { e: string; h: string; n: string; x: number };

/** A random six-digit code, without modulo bias. */
export function makeCode(): string {
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < 4_294_000_000) return String(buf[0] % 1_000_000).padStart(6, '0');
  }
}

const codeHash = (secret: string, email: string, code: string) => hmacHex(secret, `code:${email.toLowerCase()}:${code}`);

export async function makeCodeChallenge(secret: string, email: string, code: string, now = Date.now()) {
  return sign(secret, 'code', { e: email.toLowerCase(), h: await codeHash(secret, email, code), n: randomId(), x: now + CODE_TTL_MS });
}

/** The challenge's data when it is genuine, unexpired, for this email and this code; otherwise null. */
export async function checkCode(secret: string, challenge: string, email: string, code: string, now = Date.now()) {
  const c = await verify<CodeChallenge>(secret, 'code', challenge, now);
  if (!c || c.e !== email.toLowerCase() || !/^\d{6}$/.test(code)) return null;
  return safeEqual(c.h, await codeHash(secret, email, code)) ? c : null;
}
