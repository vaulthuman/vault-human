// Member documents live in a private Cloudflare R2 bucket (binding FILES) and have no public URL.
// They are read on the site, never downloaded: each document is stored as page images
// (<folder>/p1.png, p2.png, ...), shown on /documents/<id> with the member's email over each page.
// Page links are signed for one member and expire after FILE_LINK_TTL_MS; /files/<id>?p=<n> checks the
// signature, the session and access before streaming the page inline. No PDF is ever served.
import documents from '../data/documents.json';
import { hmacHex, safeEqual } from './crypto';
import type { Member } from './db';

export const FILE_LINK_TTL_MS = 30 * 60 * 1000;

export type Doc = (typeof documents)[number];
export const DOCUMENTS: Doc[] = documents;
export const documentById = (id: string) => DOCUMENTS.find((d) => d.id === id);
export const pageObject = (d: Doc, page: number) => `${d.folder}/p${page}.png`;

/** The subset of an R2 bucket binding we use; local dev gets Wrangler's on-disk R2. */
export interface Bucket {
  head(key: string): Promise<{ size: number } | null>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpEtag?: string } | null>;
}

const payload = (id: string, page: number, memberId: number, expires: number) => `page|${id}|${page}|${memberId}|${expires}`;

export async function signedPageUrl(secret: string, id: string, page: number, memberId: number, now = Date.now()): Promise<string> {
  const x = now + FILE_LINK_TTL_MS;
  return `/files/${encodeURIComponent(id)}?p=${page}&x=${x}&s=${await hmacHex(secret, payload(id, page, memberId, x))}`;
}

export async function verifyPageSig(secret: string, id: string, page: number, memberId: number, x: string | null, s: string | null, now = Date.now()) {
  const expires = Number(x);
  if (!x || !s || !Number.isFinite(expires) || expires < now) return false;
  return safeEqual(s, await hmacHex(secret, payload(id, page, memberId, expires)));
}

const deny = (status: number, text: string) =>
  new Response(text, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

export async function servePage(opts: {
  secret: string;
  bucket: Bucket | undefined;
  member: Member | null;
  id: string;
  url: URL;
  now?: number;
}): Promise<Response> {
  const { member, id, url } = opts;
  if (!member) return deny(401, 'Sign in to read member documents.');
  if (!member.access) return deny(403, 'Your membership is paused.');
  const doc = documentById(id);
  if (!doc) return deny(404, 'No such document.');
  const page = Number(url.searchParams.get('p'));
  if (!Number.isInteger(page) || page < 1 || page > doc.pages) return deny(404, 'No such page.');
  if (!(await verifyPageSig(opts.secret, id, page, member.id, url.searchParams.get('x'), url.searchParams.get('s'), opts.now))) {
    return deny(403, 'This page link has expired. Open Documents again.');
  }
  if (!opts.bucket) return deny(503, 'File storage is not set up yet.');
  const obj = await opts.bucket.get(pageObject(doc, page));
  if (!obj) return deny(404, 'This document has not been uploaded yet.');

  const headers = new Headers({
    'Content-Type': 'image/png',
    'Content-Disposition': 'inline',
    'Content-Length': String(obj.size),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, noimageindex',
  });
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { status: 200, headers });
}
