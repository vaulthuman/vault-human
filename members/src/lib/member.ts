// What the pages show for a member on a given day.
import { chamberFor } from './chamber';
import { DEFAULT_TZ, isValidTz, localDay } from './dates';
import { logsFor, type Db, type Member } from './db';
import { receivedKeys } from './keys';
import { streak } from './streak';

export async function memberState(db: Db, member: Member, now = new Date()) {
  const today = localDay(now, member.tz);
  const logs = await logsFor(db, member.id);
  const received = receivedKeys(member.started_on, today);
  return {
    today,
    logs,
    todayLog: logs.find((l) => l.day === today) ?? null,
    key: received[0],
    received,
    streak: streak(logs.map((l) => l.day), today),
    chamber: chamberFor(member.started_on, today),
    keysTurned: new Set(logs.map((l) => l.key_id)).size,
    /** The current Key's place in the member's own sequence: their 1st, 2nd, ... Key. */
    keyNumber: received.length,
    greeting: greeting(now, member.tz, member.name),
  };
}

export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null;
}

/** "Good evening, Russ." in the member's time zone; no name, no comma. */
export function greeting(now: Date, tz: string, name: string | null | undefined): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: isValidTz(tz) ? tz : DEFAULT_TZ, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const part = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = firstName(name);
  return first ? `${part}, ${first}.` : `${part}.`;
}

export const daysInARow = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} in a row`;
