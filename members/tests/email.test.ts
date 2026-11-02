import { describe, expect, it, vi } from 'vitest';
import { deliverSignInLink, FROM, RESEND_URL, SUBJECT, signInEmail } from '../src/lib/email';

const LINK = 'https://members.vaulthuman.com/auth/verify?token=abc.def';
const ok = () => vi.fn(async () => new Response('{"id":"em_1"}', { status: 200 }));

describe('sign-in email via Resend', () => {
  it('posts the link to Resend from keys@vaulthuman.com', async () => {
    const fetch = ok();
    expect(await deliverSignInLink({ RESEND_API_KEY: 're_test_placeholder' }, 'a@example.com', LINK, { fetch, log: () => {} })).toBe('sent');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_placeholder');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ from: 'Vault Human <keys@vaulthuman.com>', to: ['a@example.com'], subject: SUBJECT });
    expect(FROM).toBe('Vault Human <keys@vaulthuman.com>');
    expect(body.text).toContain(LINK);
    expect(body.html).toContain('href="https://members.vaulthuman.com/auth/verify?token=abc.def"');
  });

  it('sends even when DEV_LOG_LINKS is also set, and does not print the link', async () => {
    const fetch = ok();
    const log = vi.fn();
    expect(await deliverSignInLink({ RESEND_API_KEY: 're_x', DEV_LOG_LINKS: '1' }, 'a@example.com', LINK, { fetch, log })).toBe('sent');
    expect(log).not.toHaveBeenCalled();
  });

  it('reports a refusal without logging the link', async () => {
    const fetch = vi.fn(async () => new Response('{"message":"domain not verified"}', { status: 403 }));
    const log = vi.fn();
    expect(await deliverSignInLink({ RESEND_API_KEY: 're_x' }, 'a@example.com', LINK, { fetch, log })).toBe('failed');
    expect(String(log.mock.calls[0][0])).toContain('403');
    expect(String(log.mock.calls[0][0])).not.toContain('token=');
  });

  it('survives a network error', async () => {
    const fetch = vi.fn(async () => { throw new Error('offline'); });
    expect(await deliverSignInLink({ RESEND_API_KEY: 're_x' }, 'a@example.com', LINK, { fetch, log: () => {} })).toBe('failed');
  });
});

describe('console fallback without a key', () => {
  it('prints the link in development and calls nothing', async () => {
    const fetch = ok();
    const log = vi.fn();
    expect(await deliverSignInLink({ DEV_LOG_LINKS: '1' }, 'a@example.com', LINK, { fetch, log })).toBe('logged');
    expect(fetch).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).toContain(LINK);
  });
  it('without DEV_LOG_LINKS, neither sends nor prints the link', async () => {
    const fetch = ok();
    const log = vi.fn();
    expect(await deliverSignInLink({}, 'a@example.com', LINK, { fetch, log })).toBe('not-configured');
    expect(fetch).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).not.toContain('token=');
  });
});

describe('email content', () => {
  it('escapes the link in HTML and keeps timeless wording', () => {
    const { html, text } = signInEmail('https://x.example/?a=1&b="2"');
    expect(html).toContain('href="https://x.example/?a=1&amp;b=&quot;2&quot;"');
    expect(text + html).not.toMatch(/today|this week|day \d/i);
    expect(text + html).toContain('www.vaulthuman.com');
  });
});
