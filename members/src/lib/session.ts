import type { AstroCookies } from 'astro';
import { makeSessionToken, SESSION_TTL_MS } from './tokens';

export const COOKIE = 'vh_member';

export async function startSession(cookies: AstroCookies, secret: string, memberId: number, secure: boolean) {
  cookies.set(COOKIE, await makeSessionToken(secret, memberId), {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_MS / 1000,
  });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}
