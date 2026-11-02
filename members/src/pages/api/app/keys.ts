// The phone app's My keys and Progress: every open Key, newest first, with its boxes and status.
import type { APIRoute } from 'astro';
import { fail, json, keyJson } from '../../../lib/app-api';
import { KEYS } from '../../../lib/keys';
import { memberState } from '../../../lib/member';

export const GET: APIRoute = async ({ locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  if (!member.access) return fail('Membership is not open', 403);
  const s = await memberState(locals.runtime.env.DB, member);
  return json({
    current: s.key.id,
    total: KEYS.length,
    streak: s.streak,
    next: s.next ? { id: s.next.key.id, title: s.next.key.title, when: s.next.when } : null,
    keys: s.received.map((k) => ({ ...keyJson(k), answers: s.answers.get(k.id) ?? {}, status: s.status.get(k.id) ?? 'open', lines: s.logs.filter((l) => l.key_id === k.id).map((l) => ({ day: l.day, line: l.line })) })),
  });
};
