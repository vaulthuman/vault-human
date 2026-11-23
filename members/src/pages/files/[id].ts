// Streams one page image of a member document from R2. Needs a signed-in member with access and a fresh signed link.
import type { APIRoute } from 'astro';
import { servePage } from '../../lib/files';

export const GET: APIRoute = ({ params, url, locals }) =>
  servePage({
    secret: locals.runtime.env.SESSION_SECRET,
    bucket: locals.runtime.env.FILES,
    member: locals.member,
    id: params.id ?? '',
    url,
  });
