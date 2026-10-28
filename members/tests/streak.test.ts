import { describe, expect, it } from 'vitest';
import { chamberFor } from '../src/lib/chamber';
import { addDays, localDay } from '../src/lib/dates';
import { currentKey, receivedKeys } from '../src/lib/keys';
import { streak } from '../src/lib/streak';

const T = '2026-10-28';

describe('streak', () => {
  it('is 0 with no lines', () => expect(streak([], T)).toBe(0));
  it('is 1 after the first line today', () => expect(streak([T], T)).toBe(1));
  it('counts consecutive days ending today', () =>
    expect(streak([T, addDays(T, -1), addDays(T, -2)], T)).toBe(3));
  it('keeps yesterday’s run alive until today is over', () =>
    expect(streak([addDays(T, -1), addDays(T, -2)], T)).toBe(2));
  it('resets after a missed day', () => expect(streak([addDays(T, -2), addDays(T, -3)], T)).toBe(0));
  it('stops at the first gap', () =>
    expect(streak([T, addDays(T, -1), addDays(T, -3), addDays(T, -4)], T)).toBe(2));
  it('ignores duplicates and order', () => expect(streak([addDays(T, -1), T, T], T)).toBe(2));
  it('crosses month and year ends', () =>
    expect(streak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3));
  it('crosses a leap day', () => expect(streak(['2028-03-01', '2028-02-29', '2028-02-28'], '2028-03-01')).toBe(3));
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

describe('keys received', () => {
  it('gives one Key a day, newest first', () => {
    expect(receivedKeys(T, T).map((k) => k.id)).toEqual(['B001']);
    expect(receivedKeys(addDays(T, -2), T).map((k) => k.id)).toEqual(['H001', 'M001', 'B001']);
  });
  it('keeps the last Key current when the list runs out', () =>
    expect(currentKey(addDays(T, -30), T).id).toBe('B003'));
});
