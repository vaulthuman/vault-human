import { defineMiddleware } from 'astro:middleware';
import { memberById } from './lib/db';
import { COOKIE } from './lib/session';
import { readSessionToken } from './lib/tokens';

const PUBLIC = ['/signin', '/auth/', '/api/'];
const NEEDS_ACCESS = ['/today', '/keys', '/progress'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const env = ctx.locals.runtime.env;
  const path = ctx.url.pathname;
  ctx.locals.member = null;

  // Form posts must come from this site. Stripe's webhook is checked by signature instead.
  if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD' && !path.startsWith('/api/stripe/')) {
    const origin = ctx.request.headers.get('origin');
    if (origin !== ctx.url.origin) return new Response('Cross-site request refused', { status: 403 });
  }
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set. Copy .dev.vars.example to .dev.vars.');

  const token = ctx.cookies.get(COOKIE)?.value;
  const session = token ? await readSessionToken(env.SESSION_SECRET, token) : null;
  if (session) ctx.locals.member = await memberById(env.DB, session.m);

  if (PUBLIC.some((p) => path.startsWith(p))) return next();
  const member = ctx.locals.member;
  if (!member) return ctx.redirect('/signin');
  if (path === '/') return ctx.redirect('/today');
  if (!member.access && NEEDS_ACCESS.some((p) => path.startsWith(p))) return ctx.redirect('/membership');
  return next();
});
