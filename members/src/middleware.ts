import { defineMiddleware } from 'astro:middleware';
import { memberById } from './lib/db';
import { COOKIE } from './lib/session';
import { readSessionToken } from './lib/tokens';

const PUBLIC = ['/signin', '/auth/', '/api/', '/install'];
const NEEDS_ACCESS = ['/today', '/keys', '/progress', '/downloads', '/files/'];

// Locked-down browser rules for every page the app serves.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://www.vaulthuman.com",
  "media-src 'self' blob: https://www.vaulthuman.com",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://billing.stripe.com",
].join('; ');

function harden(res: Response): Response {
  try {
    res.headers.set('Content-Security-Policy', CSP);
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (!res.headers.has('Cache-Control')) res.headers.set('Cache-Control', 'private, no-store');
    return res;
  } catch {
    // Some responses (e.g. redirects) have immutable headers; copy them.
    const copy = new Response(res.body, res);
    copy.headers.set('Content-Security-Policy', CSP);
    copy.headers.set('X-Content-Type-Options', 'nosniff');
    copy.headers.set('X-Frame-Options', 'DENY');
    return copy;
  }
}

export const onRequest = defineMiddleware(async (ctx, next) => harden(await route(ctx, next)));

const route = async (ctx: Parameters<Parameters<typeof defineMiddleware>[0]>[0], next: () => Promise<Response>): Promise<Response> => {
  const env = ctx.locals.runtime.env;
  const path = ctx.url.pathname;
  ctx.locals.member = null;

  // Form posts must come from this site. Stripe's webhook is checked by signature, the push sender by its secret,
  // and the phone app's API by a Bearer token (never the cookie, so a cross-site page can't act for a member).
  if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD' && !path.startsWith('/api/stripe/') && path !== '/api/push/send' && !path.startsWith('/api/app/')) {
    const origin = ctx.request.headers.get('origin');
    if (origin !== ctx.url.origin) return new Response('Cross-site request refused', { status: 403 });
  }
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set. Copy .dev.vars.example to .dev.vars.');

  if (path.startsWith('/api/app/')) {
    const bearer = /^Bearer (.+)$/.exec(ctx.request.headers.get('authorization') ?? '')?.[1];
    const s = bearer ? await readSessionToken(env.SESSION_SECRET, bearer) : null;
    ctx.locals.member = s ? await memberById(env.DB, s.m) : null;
    return next();
  }

  const token = ctx.cookies.get(COOKIE)?.value;
  const session = token ? await readSessionToken(env.SESSION_SECRET, token) : null;
  if (session) ctx.locals.member = await memberById(env.DB, session.m);

  if (PUBLIC.some((p) => path.startsWith(p))) return next();
  const member = ctx.locals.member;
  if (!member) return ctx.redirect('/signin');
  if (path === '/') return ctx.redirect('/today');
  if (!member.access && NEEDS_ACCESS.some((p) => path.startsWith(p))) return ctx.redirect('/membership');
  return next();
};
