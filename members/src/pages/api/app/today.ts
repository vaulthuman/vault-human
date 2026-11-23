// The phone app's Today: the current Key, what else is open, when the next one opens, the streak.
import type { APIRoute } from 'astro';
import { fail, json, memberJson, todayJson } from '../../../lib/app-api';
import { memberState } from '../../../lib/member';

export const GET: APIRoute = async ({ locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  if (!member.access) return json({ member: memberJson(member), today: null });
  return json({ member: memberJson(member), today: todayJson(await memberState(locals.runtime.env.DB, member)) });
};
