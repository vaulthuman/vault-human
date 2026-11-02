import { describe, expect, it } from 'vitest';
import { chamberFor } from '../src/lib/chamber';
import { addDays, localDay } from '../src/lib/dates';
import { alsoOpen, currentKey, isOpen, KEYS, memberDay, nextKey, receivedKeys, stepLabel } from '../src/lib/keys';
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
  it('every Key has a time and a day', () => KEYS.forEach((k) => {
    expect(['morning', 'evening']).toContain(k.time);
    expect(k.day).toBeGreaterThanOrEqual(1);
  }));
  it('morning says Today’s step, evening says Tonight’s step', () => {
    expect(stepLabel({ time: 'morning' })).toBe("Today's step");
    expect(stepLabel({ time: 'evening' })).toBe("Tonight's step");
  });
});

describe('the member week', () => {
  it('is the free week in full: a morning and an evening Key for seven days, starting at the door', () => {
    expect(KEYS.map((k) => `${k.day}${k.time[0]}:${k.id}`)).toEqual([
      '1m:B001', '1m:M001', '1e:H001', '2m:M002', '2e:B002', '3m:M003', '3e:H002', '4m:M004',
      '4e:B003', '5m:M005', '5e:H003', '6m:M006', '6e:B004', '7m:M007', '7e:H004',
    ]);
  });
  it('every Key has a video, a poster, three or four steps and a www source', () => KEYS.forEach((k) => {
    expect(k.video).toMatch(/^https:\/\/www\.vaulthuman\.com\/video\/.+\.mp4$/);
    expect(k.poster).toMatch(/^https:\/\/www\.vaulthuman\.com\/img\/keys\/.+\.jpg$/);
    expect(k.steps.length).toBeGreaterThanOrEqual(3);
    expect(k.source).toBe(`https://www.vaulthuman.com/key/${k.id.toLowerCase()}/`);
  }));
  it('keeps free-week-only wording out of the member Keys', () => {
    const all = JSON.stringify(KEYS);
    expect(all).not.toMatch(/free week/i);
    expect(all).not.toMatch(/\bfilms?\b/i);
  });
});

describe('keys open on time', () => {
  it('opens the first morning the moment someone joins, at any hour', () => {
    expect(receivedKeys(T, T, 3).map((k) => k.id)).toEqual(['M001', 'B001']);
    expect(currentKey(T, T, 3).id).toBe('B001');
    expect(alsoOpen(currentKey(T, T, 3)).map((k) => k.id)).toEqual(['M001']);
  });
  it('opens the evening Key at 8 p.m.', () => {
    expect(currentKey(T, T, 19).id).toBe('B001');
    expect(currentKey(T, T, 20).id).toBe('H001');
  });
  it('opens later mornings at 8 a.m., not before', () => {
    const start = addDays(T, -1);
    expect(currentKey(start, T, 7).id).toBe('H001');
    expect(currentKey(start, T, 8).id).toBe('M002');
    expect(receivedKeys(start, T, 7).map((k) => k.id)).not.toContain('M002');
  });
  it('never opens a Key ahead of its time', () => {
    for (let d = 1; d <= 9; d++) for (let h = 0; h < 24; h++) {
      const day = memberDay(T, addDays(T, d - 1));
      receivedKeys(T, addDays(T, d - 1), h).forEach((k) => expect(isOpen(k, day, h)).toBe(true));
      KEYS.filter((k) => k.day > d).forEach((k) => expect(isOpen(k, day, h)).toBe(false));
    }
  });
  it('says when the next Key opens, in words that never date the page', () => {
    expect(nextKey(T, T, 10)).toMatchObject({ key: { id: 'H001' }, when: 'tonight at 8' });
    expect(nextKey(T, T, 21)).toMatchObject({ key: { id: 'M002' }, when: 'tomorrow at 8 a.m.' });
    expect(nextKey(addDays(T, -1), T, 6)).toMatchObject({ key: { id: 'M002' }, when: 'this morning at 8' });
  });
  it('keeps the last Key current once every Key is open, with nothing next', () => {
    expect(currentKey(addDays(T, -30), T, 12).id).toBe('H004');
    expect(nextKey(addDays(T, -30), T, 12)).toBeNull();
    expect(receivedKeys(addDays(T, -30), T, 12)).toHaveLength(KEYS.length);
  });
});
