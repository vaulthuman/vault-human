import { addDays } from './dates';

/**
 * Days in a row with a logged line, ending today.
 * If today has no line yet, a run that ended yesterday still counts: the day isn't over.
 */
export function streak(loggedDays: Iterable<string>, today: string): number {
  const days = new Set(loggedDays);
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
