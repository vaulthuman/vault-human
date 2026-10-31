import keys from '../data/keys.json';
import { daysBetween } from './dates';

export type Key = {
  id: string;
  title: string;
  /** When the Key arrives: morning Keys say "Today's step", evening Keys "Tonight's step". */
  time: 'morning' | 'evening';
  video: string;
  poster: string;
  paragraphs: string[];
  steps: string[];
  note?: string;
  source: string;
};

export const KEYS = keys as Key[];

export const stepLabel = (k: Pick<Key, 'time'>) => (k.time === 'morning' ? "Today's step" : "Tonight's step");

export function keyById(id: string): Key | undefined {
  return KEYS.find((k) => k.id.toLowerCase() === id.toLowerCase());
}

/**
 * Keys received so far, newest first. v1 schedule: one Key a day, in keys.json order,
 * starting on the member's first day. When the list runs out, the last Key stays current.
 */
export function receivedKeys(startedOn: string, today: string): Key[] {
  const count = Math.min(Math.max(daysBetween(startedOn, today) + 1, 1), KEYS.length);
  return KEYS.slice(0, count).reverse();
}

export function currentKey(startedOn: string, today: string): Key {
  return receivedKeys(startedOn, today)[0];
}
