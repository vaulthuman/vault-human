import { describe, expect, it } from 'vitest';
import type { Member } from '../src/lib/db';
import { type Bucket, FILE_LINK_TTL_MS, parseRange, serveFile, signedFileUrl, verifyFileSig } from '../src/lib/files';

const S = 'test-secret';
const NOW = 1_800_000_000_000;
const member = (over: Partial<Member> = {}): Member => ({
  id: 7, email: 'a@example.com', name: 'Ann', started_on: '2026-10-01', tz: 'America/Chicago', access: 1,
  stripe_customer_id: null, stripe_subscription_id: null, subscription_status: 'active', ...over,
});
const bytes = new TextEncoder().encode('%PDF-1.4 placeholder');
const bucket: Bucket = {
  head: async (k) => (k.startsWith('guides/') ? { size: bytes.length } : null),
  get: async (k, o) =>
    k.startsWith('guides/')
      ? {
          body: new Response(o?.range ? bytes.slice(o.range.offset, o.range.offset + o.range.length) : bytes).body!,
          size: bytes.length,
          httpEtag: '"e1"',
        }
      : null,
};
const serve = async (href: string, over: Partial<Parameters<typeof serveFile>[0]> = {}) => {
  const url = new URL(href, 'https://members.vaulthuman.com');
  return serveFile({ secret: S, bucket, member: member(), id: decodeURIComponent(url.pathname.split('/').pop()!), url, headers: new Headers(), now: NOW, ...over });
};

describe('signed file links', () => {
  it('are bound to the file, the member and the expiry', async () => {
    const url = new URL(await signedFileUrl(S, 'guide', 7, NOW), 'https://x');
    const [x, s] = [url.searchParams.get('x'), url.searchParams.get('s')];
    expect(url.pathname).toBe('/files/guide');
    expect(await verifyFileSig(S, 'guide', 7, x, s, NOW)).toBe(true);
    expect(await verifyFileSig(S, 'guide', 8, x, s, NOW)).toBe(false);
    expect(await verifyFileSig(S, 'b003-video', 7, x, s, NOW)).toBe(false);
    expect(await verifyFileSig('other', 'guide', 7, x, s, NOW)).toBe(false);
    expect(await verifyFileSig(S, 'guide', 7, String(Number(x) + 1000), s, NOW)).toBe(false);
    expect(await verifyFileSig(S, 'guide', 7, x, s, NOW + FILE_LINK_TTL_MS + 1)).toBe(false);
    expect(await verifyFileSig(S, 'guide', 7, null, null, NOW)).toBe(false);
  });
});

describe('range parsing', () => {
  it('handles the three single-range forms', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=990-5000', 1000)).toEqual({ start: 990, end: 999 });
  });
  it('rejects what it cannot satisfy', () => {
    expect(parseRange('bytes=1000-', 1000)).toBeNull();
    expect(parseRange('bytes=5-2', 1000)).toBeNull();
    expect(parseRange('bytes=0-1,5-6', 1000)).toBeNull();
    expect(parseRange('items=0-1', 1000)).toBeNull();
  });
});

describe('serving files', () => {
  it('streams the file to the member it was signed for', async () => {
    const res = await serve(await signedFileUrl(S, 'guide', 7, NOW));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('vault-human-member-guide.pdf');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.text()).toBe('%PDF-1.4 placeholder');
  });
  it('answers range requests with 206', async () => {
    const res = await serve(await signedFileUrl(S, 'guide', 7, NOW), { headers: new Headers({ range: 'bytes=0-3' }) });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes 0-3/${bytes.length}`);
    expect(await res.text()).toBe('%PDF');
  });
  it('answers an unsatisfiable range with 416', async () => {
    const res = await serve(await signedFileUrl(S, 'guide', 7, NOW), { headers: new Headers({ range: 'bytes=999-' }) });
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe(`bytes */${bytes.length}`);
  });
  it('refuses anyone signed out', async () =>
    expect((await serve(await signedFileUrl(S, 'guide', 7, NOW), { member: null })).status).toBe(401));
  it('refuses a member without access', async () =>
    expect((await serve(await signedFileUrl(S, 'guide', 7, NOW), { member: member({ access: 0 }) })).status).toBe(403));
  it('refuses a link signed for someone else', async () =>
    expect((await serve(await signedFileUrl(S, 'guide', 8, NOW))).status).toBe(403));
  it('refuses an expired or unsigned link', async () => {
    expect((await serve(await signedFileUrl(S, 'guide', 7, NOW - FILE_LINK_TTL_MS - 1))).status).toBe(403);
    expect((await serve('/files/guide')).status).toBe(403);
  });
  it('404s unknown files and files not uploaded yet', async () => {
    expect((await serve(await signedFileUrl(S, 'nope', 7, NOW))).status).toBe(404);
    expect((await serve(await signedFileUrl(S, 'b003-video', 7, NOW))).status).toBe(404);
  });
  it('says so when storage is not set up', async () =>
    expect((await serve(await signedFileUrl(S, 'guide', 7, NOW), { bucket: undefined })).status).toBe(503));
});
