// The phone app's API: sign-in by emailed code, Bearer-only access, Today, the daily line, Keys and push tokens.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCode, makeCode, makeCodeChallenge, makeSessionToken } from '../src/lib/tokens';
import { expoEndpoint, sendExpo } from '../src/lib/expo';
import { POST as code } from '../src/pages/api/app/code';
import { POST as verify } from '../src/pages/api/app/verify';
import { GET as today } from '../src/pages/api/app/today';
import { POST as log } from '../src/pages/api/app/log';
import { GET as keys } from '../src/pages/api/app/keys';
import { POST as push } from '../src/pages/api/app/push';
import { onRequest } from '../src/middleware';
import { testDb } from './sqlite-d1';

const SECRET = 'test-secret-for-app-api-0123456789';
const setup = () => {
  const db = testDb();
  db.raw.exec("INSERT INTO members (id, email, name, started_on, tz, access) VALUES (1, 'm@example.com', 'Mo Example', date('now'), 'America/Chicago', 1), (2, 'closed@example.com', NULL, date('now'), 'America/Chicago', 0)");
  const logs: string[] = [];
  const env = { DB: db, SESSION_SECRET: SECRET, DEV_LOG_LINKS: '1' } as any;
  return { db, env, logs };
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://members.example/api/app/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ctx = (env: any, request: Request, member: any = null) => ({ request, locals: { runtime: { env, ctx: undefined }, member } }) as any;

afterEach(() => vi.restoreAllMocks());

describe('emailed codes', () => {
  it('are six digits', () => { for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^\d{6}$/); });
  it('check against their challenge, email and time', async () => {
    const ch = await makeCodeChallenge(SECRET, 'M@Example.com', '123456', 1_000);
    expect(await checkCode(SECRET, ch, 'm@example.com', '123456', 2_000)).toBeTruthy();
    expect(await checkCode(SECRET, ch, 'm@example.com', '654321', 2_000)).toBeNull();
    expect(await checkCode(SECRET, ch, 'other@example.com', '123456', 2_000)).toBeNull();
    expect(await checkCode(SECRET, ch, 'm@example.com', '123456', 1_000 + 10 * 60_000 + 1)).toBeNull();
    expect(await checkCode('other-secret', ch, 'm@example.com', '123456', 2_000)).toBeNull();
  });
});

describe('sign-in by code', () => {
  it('emails a member a code and signs in once with it', async () => {
    const { env } = setup();
    const said: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => { said.push(a.join(' ')); });
    const r = await code(ctx(env, post({ email: 'M@example.com' })));
    expect(r.status).toBe(200);
    const { challenge } = await r.json();
    const sent = said.join('\n').match(/\[sign-in code for m@example.com\] (\d{6})/)![1];
    const ok = await verify(ctx(env, post({ email: 'm@example.com', code: sent, challenge })));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ token: expect.any(String), member: { email: 'm@example.com', access: true } });
    const again = await verify(ctx(env, post({ email: 'm@example.com', code: sent, challenge })));
    expect(again.status).toBe(401);
  });

  it('answers a stranger exactly like a member, and emails nothing', async () => {
    const { env } = setup();
    const said: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => { said.push(a.join(' ')); });
    const r = await code(ctx(env, post({ email: 'nobody@example.com' })));
    expect(r.status).toBe(200);
    expect(Object.keys(await r.json())).toEqual(['challenge']);
    expect(said.join('\n')).not.toMatch(/sign-in code/);
  });

  it('allows ten guesses a day per address, then refuses even the right code', async () => {
    const { env } = setup();
    const challenge = await makeCodeChallenge(SECRET, 'm@example.com', '111111');
    const statuses = [];
    for (let i = 0; i < 10; i++) statuses.push((await verify(ctx(env, post({ email: 'm@example.com', code: '000000', challenge })))).status);
    expect(statuses).toEqual(Array(10).fill(401));
    expect((await verify(ctx(env, post({ email: 'm@example.com', code: '111111', challenge })))).status).toBe(429);
  });

  it('sends app codes from their own bucket, so the app can’t lock someone out of website links', async () => {
    const { env } = setup();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (let i = 0; i < 6; i++) await code(ctx(env, post({ email: 'm@example.com' })));
    expect((await code(ctx(env, post({ email: 'm@example.com' })))).status).toBe(429);
    const { allowSignIn } = await import('../src/lib/ratelimit');
    expect(await allowSignIn(env.DB, 'm@example.com', 'ip-web')).toBe(true);
  });

  it('refuses anything but a JSON body, so web pages can’t post to it without a preflight', async () => {
    const { env } = setup();
    const sneaky = new Request('https://x/', { method: 'POST', headers: { 'content-type': 'text/plain; x=application/json' }, body: JSON.stringify({ email: 'm@example.com' }) });
    expect((await code(ctx(env, sneaky))).status).toBe(400);
  });

  it('lets a code work once even when two requests race', async () => {
    const { env } = setup();
    const challenge = await makeCodeChallenge(SECRET, 'm@example.com', '222222');
    const [a, b] = await Promise.all([0, 1].map(() => verify(ctx(env, post({ email: 'm@example.com', code: '222222', challenge })))));
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });
});

describe('Bearer only', () => {
  const run = async (env: any, headers: Record<string, string>) => {
    const c: any = { request: new Request('https://members.example/api/app/today', { headers }), url: new URL('https://members.example/api/app/today'),
      locals: { runtime: { env } }, cookies: { get: () => ({ value: headers.cookieToken }) }, redirect: (p: string) => new Response(null, { status: 302, headers: { location: p } }) };
    await onRequest(c, async () => new Response('ok'));
    return c.locals.member;
  };
  it('reads the member from the Authorization header', async () => {
    const { env } = setup();
    expect(await run(env, { authorization: `Bearer ${await makeSessionToken(SECRET, 1)}` })).toMatchObject({ id: 1 });
  });
  it('ignores the website cookie on the app API', async () => {
    const { env } = setup();
    expect(await run(env, { cookieToken: await makeSessionToken(SECRET, 1) })).toBeNull();
    expect(await run(env, { authorization: 'Bearer forged.token' })).toBeNull();
  });
});

describe('app endpoints', () => {
  const member = (db: any, id = 1) => db.raw.prepare('SELECT * FROM members WHERE id = ?').get(id);
  it('refuses without a member, and shows no Keys to a closed membership', async () => {
    const { db, env } = setup();
    expect((await today(ctx(env, new Request('https://x/')))).status).toBe(401);
    const closed = await (await today(ctx(env, new Request('https://x/'), member(db, 2)))).json();
    expect(closed).toMatchObject({ member: { access: false }, today: null });
    expect((await keys(ctx(env, new Request('https://x/'), member(db, 2)))).status).toBe(403);
  });
  it('gives Today with the door Key first on day one', async () => {
    const { db, env } = setup();
    const t = await (await today(ctx(env, new Request('https://x/'), member(db)))).json();
    expect(t.today.key.id).toBe('B001');
    expect(t.today.also.map((k: any) => k.id)).toEqual(['M001']);
    expect(t.today.firstWeek).toMatchObject({ bookingUrl: expect.stringMatching(/^https:\/\//) });
  });
  it('saves one line a day and refuses empty or long lines', async () => {
    const { db, env } = setup();
    expect((await log(ctx(env, post({ line: '  ' }), member(db)))).status).toBe(400);
    expect((await log(ctx(env, post({ line: 'x'.repeat(281) }), member(db)))).status).toBe(400);
    const r = await (await log(ctx(env, post({ line: 'Walked to the creek.', tz: 'America/Chicago' }), member(db)))).json();
    expect(r.today.todayLine).toBe('Walked to the creek.');
    const k = await (await keys(ctx(env, new Request('https://x/'), member(db)))).json();
    expect(k.keys.find((x: any) => x.id === 'B001').lines).toHaveLength(1);
  });
  it('accepts only real Expo push tokens', async () => {
    const { db, env } = setup();
    expect((await push(ctx(env, post({ token: 'https://evil.example' }), member(db)))).status).toBe(400);
    expect((await push(ctx(env, post({ token: 'ExponentPushToken[abcdefghijkl]' }), member(db)))).status).toBe(200);
    expect(db.raw.prepare('SELECT endpoint FROM push_subs').all()).toEqual([{ endpoint: 'expo:ExponentPushToken[abcdefghijkl]' }]);
  });
});

describe('Expo delivery', () => {
  it('recognises tokens and reports gone devices as 410', async () => {
    expect(expoEndpoint('ExponentPushToken[abcdefghijkl]')).toBe('expo:ExponentPushToken[abcdefghijkl]');
    expect(expoEndpoint('ExponentPushToken[]')).toBeNull();
    const gone = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } })));
    expect(await sendExpo({ endpoint: 'expo:ExponentPushToken[abcdefghijkl]' }, { title: 't', body: 'b' }, gone as any)).toBe(410);
    const ok = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'ok', id: 'x' } })));
    expect(await sendExpo({ endpoint: 'expo:ExponentPushToken[abcdefghijkl]' }, { title: 't', body: 'b' }, ok as any)).toBe(200);
    expect(JSON.parse((ok.mock.calls[0] as any)[1].body)).toMatchObject({ to: 'ExponentPushToken[abcdefghijkl]', title: 't', data: { url: '/today' } });
  });
});
