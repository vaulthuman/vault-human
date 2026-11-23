import chambers from '../data/chambers.json';

export type Chamber = { n: number; name: string; month: number; title: string };

/** The year runs 12 months: chambers 1 to 5, the Integration pause, then chambers 6 to 11. */
export const YEAR: Chamber[] = [...chambers].sort((a, b) => a.month - b.month);

/** Month of membership (1-12) on `today`, counting whole calendar months from `startedOn`. */
export function memberMonth(startedOn: string, today: string): number {
  const [sy, sm, sd] = startedOn.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - sy) * 12 + (tm - sm);
  if (td < sd) months--;
  return Math.min(Math.max(months + 1, 1), 12);
}

export function chamberFor(startedOn: string, today: string): Chamber & { pause: boolean } {
  const c = YEAR[memberMonth(startedOn, today) - 1];
  return { ...c, pause: c.n === 0 };
}
