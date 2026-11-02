// Shared pieces of the phone app's JSON API (/api/app/*).
import type { Member } from './db';
import type { Key } from './keys';
import type { memberState } from './member';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });

export const fail = (error: string, status: number) => json({ error }, status);

/** Reads a small JSON body; null when it is missing, too big or not JSON. */
export async function readJson(request: Request, max = 4096): Promise<any> {
  if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return null;
  const text = await request.text();
  if (text.length > max) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const keyJson = (k: Key) => ({
  id: k.id, day: k.day, time: k.time, title: k.title, video: k.video, poster: k.poster,
  paragraphs: k.paragraphs, steps: k.steps, note: k.note ?? null,
});

export const memberJson = (m: Member) => ({ name: m.name, email: m.email, access: !!m.access, startedOn: m.started_on, tz: m.tz });

/** Today, as the app shows it. */
export function todayJson(s: Awaited<ReturnType<typeof memberState>>) {
  return {
    greeting: s.greeting,
    day: s.today,
    chamber: s.chamber.pause ? { name: 'The Integration pause', n: 0 } : { name: s.chamber.name, n: s.chamber.n },
    keyNumber: s.keyNumber,
    key: keyJson(s.key),
    also: s.also.map(keyJson),
    next: s.next ? { id: s.next.key.id, title: s.next.key.title, when: s.next.when } : null,
    todayLine: s.todayLog?.line ?? null,
    streak: s.streak,
    keysTurned: s.keysTurned,
    firstWeek: s.firstWeek ? { lastDay: s.lastDayOfFirstWeek, bookingUrl: s.bookingUrl } : null,
  };
}
