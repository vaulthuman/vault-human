import { describe, expect, it } from 'vitest';
import type { Member } from '../src/lib/db';
import { type Bucket, DOCUMENTS, FILE_LINK_TTL_MS, servePage, signedPageUrl, verifyPageSig } from '../src/lib/files';

const S = 'test-secret';
const NOW = 1_800_000_000_000;
const member = (over: Partial<Member> = {}): Member => ({
  id: 7, email: 'a@example.com', name: 'Ann', started_on: '2026-10-01', tz: 'America/Chicago', access: 1,
  stripe_customer_id: null, stripe_subscription_id: null, subscription_status: 'active', ...over,
});
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const bucket: Bucket = {
  head: async (k) => (k === 'documents/guide/p1.png' ? { size: png.length } : null),
  get: async (k) => (k === 'documents/guide/p1.png' ? { body: new Response(png).body!, size: png.length, httpEtag: '"e1"' } : null),
};
const serve = async (href: string, over: Partial<Parameters<typeof servePage>[0]> = {}) => {
  const url = new URL(href, 'https://members.vaulthuman.com');
  return servePage({ secret: S, bucket, member: member(), id: decodeURIComponent(url.pathname.split('/').pop()!), url, now: NOW, ...over });
};

describe('documents', () => {
  it('are page images only: no PDF or video is listed', () => {
    for (const d of DOCUMENTS) {
      expect(d.pages).toBeGreaterThan(0);
      expect(JSON.stringify(d)).not.toMatch(/\.pdf|\.mp4|filename/i);
    }
  });
});

describe('signed page links', () => {
  it('are bound to the document, the page, the member and the expiry', async () => {
    const url = new URL(await signedPageUrl(S, 'guide', 1, 7, NOW), 'https://x');
    const [x, s] = [url.searchParams.get('x'), url.searchParams.get('s')];
    expect(url.pathname).toBe('/files/guide');
    expect(url.searchParams.get('p')).toBe('1');
    expect(await verifyPageSig(S, 'guide', 1, 7, x, s, NOW)).toBe(true);
    expect(await verifyPageSig(S, 'guide', 2, 7, x, s, NOW)).toBe(false);
    expect(await verifyPageSig(S, 'guide', 1, 8, x, s, NOW)).toBe(false);
    expect(await verifyPageSig(S, 'other', 1, 7, x, s, NOW)).toBe(false);
    expect(await verifyPageSig('other', 'guide', 1, 7, x, s, NOW)).toBe(false);
    expect(await verifyPageSig(S, 'guide', 1, 7, String(Number(x) + 1000), s, NOW)).toBe(false);
    expect(await verifyPageSig(S, 'guide', 1, 7, x, s, NOW + FILE_LINK_TTL_MS + 1)).toBe(false);
    expect(await verifyPageSig(S, 'guide', 1, 7, null, null, NOW)).toBe(false);
  });
});

describe('serving pages', () => {
  it('shows the page inline to the member it was signed for, never as a download', async () => {
    const res = await serve(await signedPageUrl(S, 'guide', 1, 7, NOW));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
  });
  it('refuses anyone signed out', async () =>
    expect((await serve(await signedPageUrl(S, 'guide', 1, 7, NOW), { member: null })).status).toBe(401));
  it('refuses a member without access', async () =>
    expect((await serve(await signedPageUrl(S, 'guide', 1, 7, NOW), { member: member({ access: 0 }) })).status).toBe(403));
  it('refuses a link signed for someone else', async () =>
    expect((await serve(await signedPageUrl(S, 'guide', 1, 8, NOW))).status).toBe(403));
  it('refuses an expired, unsigned or re-pointed link', async () => {
    expect((await serve(await signedPageUrl(S, 'guide', 1, 7, NOW - FILE_LINK_TTL_MS - 1))).status).toBe(403);
    expect((await serve('/files/guide?p=1')).status).toBe(403);
    const moved = (await signedPageUrl(S, 'guide', 1, 7, NOW)).replace('p=1', 'p=2');
    expect((await serve(moved)).status).toBe(404); // the guide has one page
  });
  it('404s unknown documents and pages', async () => {
    expect((await serve(await signedPageUrl(S, 'nope', 1, 7, NOW))).status).toBe(404);
    expect((await serve(await signedPageUrl(S, 'guide', 0, 7, NOW))).status).toBe(404);
    expect((await serve('/files/guide?p=abc')).status).toBe(404);
  });
  it('says so when storage is not set up', async () =>
    expect((await serve(await signedPageUrl(S, 'guide', 1, 7, NOW), { bucket: undefined })).status).toBe(503));
});
