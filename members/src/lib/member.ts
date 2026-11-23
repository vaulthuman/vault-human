// What the pages show for a member on a given day.
import { chamberFor } from './chamber';
import { localDay, localHour } from './dates';
import { byKey, statusOf, type Status } from './answers';
import { answersFor, logsFor, type Db, type Member } from './db';
import coaching from '../data/coaching.json';
import { alsoOpen, currentKey, memberDay, nextKey, receivedKeys } from './keys';
import { streak } from './streak';

export async function memberState(db: Db, member: Member, now = new Date()) {
  const today = localDay(now, member.tz);
  const logs = await logsFor(db, member.id);
  const answerRows = await answersFor(db, member.id);
  const answers = byKey(answerRows);
  const hour = localHour(now, member.tz);
  const received = receivedKeys(member.started_on, today, hour);
  const key = currentKey(member.started_on, today, hour);
  const day = memberDay(member.started_on, today);
  return {
    today,
    logs,
    todayLog: logs.find((l) => l.day === today) ?? null,
    /** Did the member fill in any box today? */
    activeToday: logs.some((l) => l.day === today) || answerRows.some((a) => a.day === today),
    key,
    /** Other Keys that opened with the current one (the first morning opens two). */
    also: alsoOpen(key),
    next: nextKey(member.started_on, today, hour),
    received,
    /** The member's first week: Keys twice a day and the first session with Russ. */
    firstWeek: day <= coaching.weekDays,
    lastDayOfFirstWeek: day === coaching.weekDays,
    bookingUrl: coaching.bookingUrl,
    answers,
    /** Done, started or to do, for every Key opened so far. */
    status: new Map<string, Status>(received.map((k) => [k.id, statusOf(k, answers.get(k.id), logs)])),
    streak: streak([...logs.map((l) => l.day), ...answerRows.map((a) => a.day)], today),
    chamber: chamberFor(member.started_on, today),
    keysTurned: received.filter((k) => statusOf(k, answers.get(k.id), logs) === 'done').length,
    /** The current Key's place in the member's own sequence: their 1st, 2nd, ... Key. */
    keyNumber: received.length - received.findIndex((k) => k.id === key.id),
    greeting: greeting(now, member.tz, member.name),
  };
}

export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null;
}

/** "Good evening, Russ." in the member's time zone; no name, no comma. */
export function greeting(now: Date, tz: string, name: string | null | undefined): string {
  const hour = localHour(now, tz);
  const part = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = firstName(name);
  return first ? `${part}, ${first}.` : `${part}.`;
}

export const daysInARow = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} in a row`;
