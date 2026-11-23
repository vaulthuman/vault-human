import keys from '../data/keys.json';
import { daysBetween } from './dates';

export type Key = {
  id: string;
  /** The member's day (1 = the day they joined) on which this Key opens. */
  day: number;
  /** Morning Keys open at 8 a.m. and say "Today's step"; evening Keys open at 8 p.m. and say "Tonight's step". */
  time: 'morning' | 'evening';
  title: string;
  video: string;
  poster: string;
  paragraphs: string[];
  steps: string[];
  note?: string;
  source: string;
};

export const KEYS = keys as Key[];

/** Local hours at which morning and evening Keys open. */
export const OPENS_AT = { morning: 8, evening: 20 } as const;

export const stepLabel = (k: Pick<Key, 'time'>) => (k.time === 'morning' ? "Today's step" : "Tonight's step");

export function keyById(id: string): Key | undefined {
  return KEYS.find((k) => k.id.toLowerCase() === id.toLowerCase());
}

/** The member's day number: 1 on the day they joined. */
export const memberDay = (startedOn: string, today: string) => Math.max(daysBetween(startedOn, today) + 1, 1);

/**
 * Is this Key open on member day `day` at local hour `hour`?
 * Earlier days are open. On the day itself, morning Keys open at 8 a.m. and evening Keys at 8 p.m.
 * The first morning opens the moment someone joins, whatever the hour: nobody waits to start.
 */
export function isOpen(k: Pick<Key, 'day' | 'time'>, day: number, hour: number): boolean {
  if (k.day < day) return true;
  if (k.day > day) return false;
  if (k.time === 'morning') return k.day === 1 || hour >= OPENS_AT.morning;
  return hour >= OPENS_AT.evening;
}

/** Keys open so far, newest first. */
export function receivedKeys(startedOn: string, today: string, hour: number): Key[] {
  const day = memberDay(startedOn, today);
  return KEYS.filter((k) => isOpen(k, day, hour)).reverse();
}

/**
 * The Key on Today: the first Key of the most recent opening (so the first morning starts at the door, B001).
 * When every Key is open, the last opening stays current.
 */
export function currentKey(startedOn: string, today: string, hour: number): Key {
  const open = receivedKeys(startedOn, today, hour);
  const newest = open[0];
  return KEYS.find((k) => k.day === newest.day && k.time === newest.time)!;
}

/** Other Keys that opened at the same time as the current one (the first morning has two). */
export function alsoOpen(current: Key): Key[] {
  return KEYS.filter((k) => k.day === current.day && k.time === current.time && k.id !== current.id);
}

/** The next Key to open and when, as words that never date the page: "tonight at 8" or "tomorrow at 8 a.m.". */
export function nextKey(startedOn: string, today: string, hour: number): { key: Key; when: string } | null {
  const day = memberDay(startedOn, today);
  const next = KEYS.find((k) => !isOpen(k, day, hour));
  if (!next) return null;
  const when =
    next.day === day
      ? next.time === 'morning' ? 'this morning at 8' : 'tonight at 8'
      : next.day === day + 1 && next.time === 'morning' ? 'tomorrow at 8 a.m.' : next.time === 'morning' ? 'at 8 a.m.' : 'at 8 p.m.';
  return { key: next, when };
}
