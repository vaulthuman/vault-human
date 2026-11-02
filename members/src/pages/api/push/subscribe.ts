// Saves (POST) or removes (DELETE) this device's push subscription for the signed-in member.
import type { APIRoute } from 'astro';
import { deletePushSub, savePushSub } from '../../../lib/db';
import { fromB64u, validEndpoint } from '../../../lib/webpush';

const bad = (msg: string, status = 400) => new Response(msg, { status });

async function readSub(request: Request) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return null;
  const text = await request.text();
  if (text.length > 4096) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return bad('Sign in first', 401);
  if (!member.access) return bad('Membership is not open', 403);
  const sub = await readSub(request);
  const p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
  if (!validEndpoint(sub?.endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string') return bad('Bad subscription');
  try {
    if (fromB64u(p256dh).length !== 65 || fromB64u(auth).length !== 16) return bad('Bad subscription keys');
  } catch {
    return bad('Bad subscription keys');
  }
  await savePushSub(locals.runtime.env.DB, member.id, sub.endpoint, p256dh, auth);
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return bad('Sign in first', 401);
  const sub = await readSub(request);
  if (!validEndpoint(sub?.endpoint)) return bad('Bad subscription');
  await deletePushSub(locals.runtime.env.DB, member.id, sub.endpoint);
  return Response.json({ ok: true });
};
