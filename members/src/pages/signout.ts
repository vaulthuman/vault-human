import type { APIRoute } from 'astro';
import { endSession } from '../lib/session';

export const POST: APIRoute = ({ cookies, redirect }) => {
  endSession(cookies);
  return redirect('/signin');
};
