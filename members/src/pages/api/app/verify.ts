// Phone app sign-in, step 2: trade the emailed code (with its challenge) for a 30-day token.
import type { APIRoute } from 'astro';
import { fail, json, memberJson, readJson } from '../../../lib/app-api';
import { memberByEmail, useLinkNonce } from '../../../lib/db';
import { allowGuess, hashIp } from '../../../lib/ratelimit';
import { validEmail } from '../../../lib/signin';
import { checkCode, makeSessionToken } from '../../../lib/tokens';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code.replace(/\s+/g, '') : '';
  const challenge = typeof body?.challenge === 'string' ? body.challenge : '';
  if (!validEmail(email) || !/^\d{6}$/.test(code) || !challenge || challenge.length > 1024) return fail('Enter the six-digit code from the email.', 400);
  // Ten guesses a day for each address, thirty an hour for each network.
  if (!(await allowGuess(env.DB, email, await hashIp(env.SESSION_SECRET, request.headers.get('cf-connecting-ip') ?? 'local')))) {
    return fail('Too many tries. Wait a little while, then ask for a new code.', 429);
  }
  const ok = await checkCode(env.SESSION_SECRET, challenge, email, code);
  const member = ok ? await memberByEmail(env.DB, email) : null;
  if (!ok || !member || !(await useLinkNonce(env.DB, ok.n))) return fail('That code didn’t work. Check it, or ask for a new one.', 401);
  return json({ token: await makeSessionToken(env.SESSION_SECRET, member.id), member: memberJson(member) });
};
