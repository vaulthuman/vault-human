// What the pages show for a member on a given day.
import { chamberFor } from './chamber';
import { localDay } from './dates';
import { logsFor, type Db, type Member } from './db';
import { currentKey, receivedKeys } from './keys';
import { streak } from './streak';

export async function memberState(db: Db, member: Member, now = new Date()) {
  const today = localDay(now, member.tz);
  const logs = await logsFor(db, member.id);
  return {
    today,
    logs,
    todayLog: logs.find((l) => l.day === today) ?? null,
    key: currentKey(member.started_on, today),
    received: receivedKeys(member.started_on, today),
    streak: streak(logs.map((l) => l.day), today),
    chamber: chamberFor(member.started_on, today),
    keysTurned: new Set(logs.map((l) => l.key_id)).size,
  };
}

export const daysInARow = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} in a row`;
