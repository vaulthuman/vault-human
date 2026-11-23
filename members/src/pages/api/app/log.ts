// The phone app's daily line: "What I did, and what it did." Same rules as the website.
import type { APIRoute } from 'astro';
import { fail, json, readJson, todayJson } from '../../../lib/app-api';
import { isValidTz, localDay, localHour } from '../../../lib/dates';
import { saveLog, setTz } from '../../../lib/db';
import { currentKey } from '../../../lib/keys';
import { memberState } from '../../../lib/member';

export const POST: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  if (!member.access) return fail('Membership is not open', 403);
  const env = locals.runtime.env;
  const body = await readJson(request);
  const line = String(body?.line ?? '').replace(/\s+/g, ' ').trim();
  if (isValidTz(body?.tz) && body.tz !== member.tz) {
    await setTz(env.DB, member.id, body.tz);
    member.tz = body.tz;
  }
  if (!line) return fail('Write one line first.', 400);
  if (line.length > 280) return fail('Keep it to one line (280 characters).', 400);
  const now = new Date();
  const today = localDay(now, member.tz);
  await saveLog(env.DB, member.id, currentKey(member.started_on, today, localHour(now, member.tz)).id, today, line);
  return json({ today: todayJson(await memberState(env.DB, member, now)) });
};
