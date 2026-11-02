// Sends a reminder to every open member's devices. Called by the scheduler with: Authorization: Bearer <PUSH_SEND_SECRET>.
// Body: {"kind":"morning"} or {"kind":"evening"} or {"title":"...","body":"...","url":"/today"}.
import type { APIRoute } from 'astro';
import { safeEqual } from '../../../lib/crypto';
import { broadcast, messageFrom } from '../../../lib/reminders';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env.PUSH_SEND_SECRET || env.PUSH_SEND_SECRET.length < 32) return new Response('Push sending is not configured', { status: 503 });
  const auth = request.headers.get('authorization') ?? '';
  if (!safeEqual(auth, `Bearer ${env.PUSH_SEND_SECRET}`)) return new Response('Unauthorized', { status: 401 });
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) return new Response('VAPID keys are not set', { status: 503 });
  let input: unknown = null;
  try { input = JSON.parse(await request.text()); } catch { /* fall through */ }
  const msg = messageFrom(input);
  if (!msg) return new Response('Send {"kind":"morning"}, {"kind":"evening"} or a title and body', { status: 400 });
  const result = await broadcast(env.DB, env, msg);
  console.log('[push]', msg.tag, result);
  return Response.json(result);
};
