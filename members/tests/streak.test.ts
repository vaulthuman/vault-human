import { describe, expect, it } from 'vitest';
import { chamberFor } from '../src/lib/chamber';
import { addDays, localDay } from '../src/lib/dates';
import { currentKey, KEYS, receivedKeys, stepLabel } from '../src/lib/keys';
import { streak } from '../src/lib/streak';

const T = '2026-10-28';

describe('streak', () => {
  it('is 0 with no lines', () => expect(streak([], T)).toBe(0));
  it('is 1 after the first line today', () => expect(streak([T], T)).toBe(1));
  it('counts consecutive days ending today', () =>
    expect(streak([T, addDays(T, -1), addDays(T, -2)], T)).toBe(3));
  it('keeps yesterday’s run alive until today is over', () =>
    expect(streak([addDays(T, -1), addDays(T, -2)], T)).toBe(2));
  it('resets after two missed days in a row', () => expect(streak([addDays(T, -3), addDays(T, -4)], T)).toBe(0));
  it('stops at a double gap', () =>
    expect(streak([T, addDays(T, -1), addDays(T, -4), addDays(T, -5)], T)).toBe(2));
  it('ignores duplicates and order', () => expect(streak([addDays(T, -1), T, T], T)).toBe(2));
  it('crosses month and year ends', () =>
    expect(streak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3));
  it('crosses a leap day', () => expect(streak(['2028-03-01', '2028-02-29', '2028-02-28'], '2028-03-01')).toBe(3));
});

describe('streak grace day (one per rolling 7 days)', () => {
  const d = (...offsets: number[]) => offsets.map((o) => addDays(T, -o));
  it('forgives a single missed day and counts only logged days', () =>
    expect(streak(d(0, 2, 3, 4), T)).toBe(4));
  it('forgives a missed yesterday while today is still open', () =>
    expect(streak(d(2, 3), T)).toBe(2));
  it('does not forgive yesterday and today together once today has ended', () =>
    expect(streak(d(2, 3), addDays(T, 1))).toBe(0));
  it('ends the run on a second gap within 7 days', () =>
    expect(streak(d(0, 2, 3, 5, 6), T)).toBe(3)); // gaps at 1 and 4: only the first is forgiven
  it('ends the run on a second gap 6 days later', () =>
    expect(streak(d(0, 2, 3, 4, 5, 6, 8, 9), T)).toBe(6)); // gaps at 1 and 7
  it('forgives two gaps exactly 7 days apart', () =>
    expect(streak(d(0, 2, 3, 4, 5, 6, 7, 9, 10), T)).toBe(9)); // gaps at 1 and 8
  it('carries a long run with one gap every week', () => {
    const logged = Array.from({ length: 70 }, (_, i) => i).filter((i) => i % 7 !== 3);
    expect(streak(d(...logged), T)).toBe(60);
  });
  it('never forgives the day before the first line', () => expect(streak(d(0), T)).toBe(1));
  it('is still 0 with nothing logged', () => expect(streak([], T)).toBe(0));
});

describe('localDay', () => {
  it('uses the member’s time zone', () => {
    const late = new Date('2026-10-29T03:30:00Z'); // 10:30 p.m. in Chicago
    expect(localDay(late, 'America/Chicago')).toBe('2026-10-28');
    expect(localDay(late, 'Europe/London')).toBe('2026-10-29');
  });
  it('falls back to the default zone for a bad value', () =>
    expect(localDay(new Date('2026-10-28T12:00:00Z'), 'Not/AZone')).toBe('2026-10-28'));
});

describe('chamber', () => {
  it('starts in Chamber 1', () => expect(chamberFor(T, T)).toMatchObject({ n: 1, name: 'You', pause: false }));
  it('moves on each whole month', () => {
    expect(chamberFor('2026-01-15', '2026-02-14').n).toBe(1);
    expect(chamberFor('2026-01-15', '2026-02-15').n).toBe(2);
  });
  it('pauses for Integration in month six', () =>
    expect(chamberFor('2026-01-01', '2026-06-10')).toMatchObject({ name: 'Integration', pause: true }));
  it('resumes with Chamber 6 in month seven and ends at 11', () => {
    expect(chamberFor('2026-01-01', '2026-07-01').n).toBe(6);
    expect(chamberFor('2026-01-01', '2026-12-31').n).toBe(11);
    expect(chamberFor('2026-01-01', '2027-06-01').n).toBe(11);
  });
});

describe('step label follows the Key’s time', () => {
  it('every Key has a time', () => KEYS.forEach((k) => expect(['morning', 'evening']).toContain(k.time)));
  it('morning says Today’s step, evening says Tonight’s step', () => {
    expect(stepLabel({ time: 'morning' })).toBe("Today's step");
    expect(stepLabel({ time: 'evening' })).toBe("Tonight's step");
    expect(KEYS.map((k) => `${k.id}:${k.time}`)).toEqual(['B001:morning', 'M001:morning', 'H001:evening', 'B002:evening', 'B003:evening']);
  });
});

describe('keys received', () => {
  it('gives one Key a day, newest first', () => {
    expect(receivedKeys(T, T).map((k) => k.id)).toEqual(['B001']);
    expect(receivedKeys(addDays(T, -2), T).map((k) => k.id)).toEqual(['H001', 'M001', 'B001']);
  });
  it('keeps the last Key current when the list runs out', () =>
    expect(currentKey(addDays(T, -30), T).id).toBe('B003'));
});
