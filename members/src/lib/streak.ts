import { addDays, daysBetween } from './dates';

/** A missed day is forgiven when no other forgiven day falls within the same rolling 7 days. */
export const GRACE_WINDOW_DAYS = 7;

/**
 * Days in a row with a logged line, ending today. Counts logged days only.
 * - If today has no line yet, the run that ended yesterday still counts: the day isn't over.
 * - One missed day per rolling 7 days is forgiven, so a single gap doesn't reset the run.
 *   Two missed days in a row, or two gaps less than 7 days apart, end it.
 */
export function streak(loggedDays: Iterable<string>, today: string): number {
  const days = new Set(loggedDays);
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  let lastGrace: string | null = null;
  for (;;) {
    if (days.has(day)) {
      count++;
    } else {
      const prev = addDays(day, -1);
      const graceFree = lastGrace === null || daysBetween(day, lastGrace) >= GRACE_WINDOW_DAYS;
      if (!graceFree || !days.has(prev)) break;
      lastGrace = day;
    }
    day = addDays(day, -1);
  }
  return count;
}
