// Saves (POST) or removes (DELETE) the phone's Expo push token, so the reminder clock reaches the app too.
import type { APIRoute } from 'astro';
import { fail, json, readJson } from '../../../lib/app-api';
import { deletePushSub, savePushSub } from '../../../lib/db';
import { expoEndpoint } from '../../../lib/expo';

export const POST: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  if (!member.access) return fail('Membership is not open', 403);
  const endpoint = expoEndpoint((await readJson(request))?.token);
  if (!endpoint) return fail('Bad push token', 400);
  await savePushSub(locals.runtime.env.DB, member.id, endpoint, '', '');
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return fail('Sign in first', 401);
  const endpoint = expoEndpoint((await readJson(request))?.token);
  if (!endpoint) return fail('Bad push token', 400);
  await deletePushSub(locals.runtime.env.DB, member.id, endpoint);
  return json({ ok: true });
};
