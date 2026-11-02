// The phone app saves one Key's boxes: {"keyId":"B001","answers":{"before":"4","outside":"yes"},"tz":"America/Chicago"}.
import type { APIRoute } from 'astro';
import { readEntries } from '../../../lib/answers';
import { fail, json, readJson, todayJson } from '../../../lib/app-api';
import { isValidTz, localDay } from '../../../lib/dates';
import { saveAnswers, setTz } from '../../../lib/db';
import { memberState } from '../../../lib/member';

export const POST: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  if (!member.access) return fail('Membership is not open', 403);
  const env = locals.runtime.env;
  const body = await readJson(request, 16384);
  if (isValidTz(body?.tz) && body.tz !== member.tz) {
    await setTz(env.DB, member.id, body.tz);
    member.tz = body.tz;
  }
  const s = await memberState(env.DB, member);
  const k = s.received.find((x) => x.id === body?.keyId);
  if (!k) return fail('That Key isn’t open yet.', 400);
  const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {};
  await saveAnswers(env.DB, member.id, k.id, localDay(new Date(), member.tz), readEntries(k, (n) => answers[n]));
  return json({ today: todayJson(await memberState(env.DB, member)) });
};
