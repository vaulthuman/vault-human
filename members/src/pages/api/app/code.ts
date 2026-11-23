// Phone app sign-in, step 1: email a six-digit code. Always answers the same, at the same speed, member or not.
import type { APIRoute } from 'astro';
import { fail, json, readJson } from '../../../lib/app-api';
import { deliverSignInCode } from '../../../lib/email';
import { allowCodeSend, hashIp } from '../../../lib/ratelimit';
import { memberForSignIn, validEmail } from '../../../lib/signin';
import { makeCode, makeCodeChallenge } from '../../../lib/tokens';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const body = await readJson(request);
  const typed = typeof body?.email === 'string' ? body.email.trim() : '';
  const email = typed.toLowerCase();
  if (!validEmail(email)) return fail('That email address doesn’t look right.', 400);
  if (!(await allowCodeSend(env.DB, email, await hashIp(env.SESSION_SECRET, request.headers.get('cf-connecting-ip') ?? 'local')))) {
    return fail('Too many sign-in requests. Wait a little while, then try again.', 429);
  }
  const code = makeCode();
  const challenge = await makeCodeChallenge(env.SESSION_SECRET, email, code);
  const work = (async () => {
    const member = await memberForSignIn(env, typed);
    if (member) await deliverSignInCode(env, email, code);
  })().catch((e) => console.error('[app/code] failed', (e as Error).message));
  const ctx = locals.runtime.ctx;
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else await work;
  return json({ challenge });
};
