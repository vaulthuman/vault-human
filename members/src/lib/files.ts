// Member files live in a private Cloudflare R2 bucket (binding FILES) and have no public URL.
// The Downloads page hands out links signed for one member that expire after FILE_LINK_TTL_MS;
// /files/<id> checks the signature, the session and access before streaming the object.
import downloads from '../data/downloads.json';
import { hmacHex, safeEqual } from './crypto';
import type { Member } from './db';

export const FILE_LINK_TTL_MS = 10 * 60 * 1000;

export type Download = (typeof downloads)[number];
export const DOWNLOADS: Download[] = downloads;
export const downloadById = (id: string) => DOWNLOADS.find((d) => d.id === id);

/** The subset of an R2 bucket binding we use; local dev gets Wrangler's on-disk R2. */
export interface Bucket {
  head(key: string): Promise<{ size: number } | null>;
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<{
    body: ReadableStream;
    size: number;
    httpEtag?: string;
  } | null>;
}

/** One "bytes=a-b" / "bytes=a-" / "bytes=-n" range against a file of `size` bytes; null = unsatisfiable. */
export function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2]) || size === 0) return null;
  let start: number, end: number;
  if (!m[1]) {
    start = Math.max(size - Number(m[2]), 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start <= end && start < size ? { start, end } : null;
}

const payload = (id: string, memberId: number, expires: number) => `file|${id}|${memberId}|${expires}`;

export async function signedFileUrl(secret: string, id: string, memberId: number, now = Date.now()): Promise<string> {
  const x = now + FILE_LINK_TTL_MS;
  return `/files/${encodeURIComponent(id)}?x=${x}&s=${await hmacHex(secret, payload(id, memberId, x))}`;
}

export async function verifyFileSig(secret: string, id: string, memberId: number, x: string | null, s: string | null, now = Date.now()) {
  const expires = Number(x);
  if (!x || !s || !Number.isFinite(expires) || expires < now) return false;
  return safeEqual(s, await hmacHex(secret, payload(id, memberId, expires)));
}

const deny = (status: number, text: string) =>
  new Response(text, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

export async function serveFile(opts: {
  secret: string;
  bucket: Bucket | undefined;
  member: Member | null;
  id: string;
  url: URL;
  headers: Headers;
  now?: number;
}): Promise<Response> {
  const { member, id, url } = opts;
  if (!member) return deny(401, 'Sign in to download member files.');
  if (!member.access) return deny(403, 'Your membership is paused.');
  const file = downloadById(id);
  if (!file) return deny(404, 'No such file.');
  if (!(await verifyFileSig(opts.secret, id, member.id, url.searchParams.get('x'), url.searchParams.get('s'), opts.now))) {
    return deny(403, 'This download link has expired. Open Downloads again for a fresh one.');
  }
  if (!opts.bucket) return deny(503, 'File storage is not set up yet.');

  const rangeHeader = opts.headers.get('range');
  let range: { start: number; end: number } | null = null;
  if (rangeHeader) {
    const head = await opts.bucket.head(file.object);
    if (!head) return deny(404, 'This file has not been uploaded yet.');
    range = parseRange(rangeHeader, head.size);
    if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
  }
  const obj = await opts.bucket.get(
    file.object,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
  );
  if (!obj) return deny(404, 'This file has not been uploaded yet.');

  const headers = new Headers({
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    'Accept-Ranges': 'bytes',
  });
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  if (range) {
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${obj.size}`);
    headers.set('Content-Length', String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}
