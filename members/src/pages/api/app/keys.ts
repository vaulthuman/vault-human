// The phone app's My keys: every open Key, newest first, with the member's lines.
import type { APIRoute } from 'astro';
import { fail, json, keyJson } from '../../../lib/app-api';
import { memberState } from '../../../lib/member';

export const GET: APIRoute = async ({ locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  if (!member.access) return fail('Membership is not open', 403);
  const s = await memberState(locals.runtime.env.DB, member);
  return json({
    current: s.key.id,
    keys: s.received.map((k) => ({ ...keyJson(k), lines: s.logs.filter((l) => l.key_id === k.id).map((l) => ({ day: l.day, line: l.line })) })),
  });
};
