// Stripe webhook. Verifies the signature and that the event's mode matches the key, then opens or closes access.
import type { APIRoute } from 'astro';
import { eventMatchesKey, handleEvent, subscriptionStatusFrom, verifySignature } from '../../../lib/stripe';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('Webhook secret not configured', { status: 503 });
  const payload = await request.text();
  if (!(await verifySignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return new Response('Bad signature', { status: 400 });
  }
  const event = JSON.parse(payload);
  if (!eventMatchesKey(event.livemode, env.STRIPE_SECRET_KEY)) {
    return new Response('Event mode does not match the configured Stripe key', { status: 400 });
  }
  const outcome = await handleEvent(event, { db: env.DB, subscriptionStatus: subscriptionStatusFrom(env.STRIPE_SECRET_KEY) });
  console.log('[stripe]', event.type, event.id, outcome);
  return Response.json({ received: true, ...outcome });
};
