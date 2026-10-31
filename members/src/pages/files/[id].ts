// Streams a member file from R2. Needs a signed-in member with access and a fresh signed link.
import type { APIRoute } from 'astro';
import { serveFile } from '../../lib/files';

export const GET: APIRoute = ({ params, url, request, locals }) =>
  serveFile({
    secret: locals.runtime.env.SESSION_SECRET,
    bucket: locals.runtime.env.FILES,
    member: locals.member,
    id: params.id ?? '',
    url,
    headers: request.headers,
  });
