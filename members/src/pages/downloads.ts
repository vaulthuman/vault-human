// Downloads became Documents: read on the site, not downloaded. Old links land on the new page.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ redirect }) => redirect('/documents', 301);
