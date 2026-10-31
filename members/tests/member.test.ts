import { describe, expect, it } from 'vitest';
import { firstName, greeting } from '../src/lib/member';

describe('first name', () => {
  it('takes the first word', () => expect(firstName('Russ Michaels')).toBe('Russ'));
  it('capitalises and trims', () => expect(firstName('  ann lee ')).toBe('Ann'));
  it('is null with no name', () => {
    expect(firstName(null)).toBeNull();
    expect(firstName('   ')).toBeNull();
  });
});

describe('greeting', () => {
  const at = (iso: string) => new Date(iso);
  it('follows the member’s clock', () => {
    expect(greeting(at('2026-10-28T13:00:00Z'), 'America/Chicago', 'Test Member')).toBe('Good morning, Test.');
    expect(greeting(at('2026-10-28T19:00:00Z'), 'America/Chicago', 'Test Member')).toBe('Good afternoon, Test.');
    expect(greeting(at('2026-10-29T01:00:00Z'), 'America/Chicago', 'Test Member')).toBe('Good evening, Test.');
    expect(greeting(at('2026-10-29T07:00:00Z'), 'America/Chicago', 'Test Member')).toBe('Good evening, Test.');
  });
  it('works without a name', () => expect(greeting(at('2026-10-28T13:00:00Z'), 'America/Chicago', null)).toBe('Good morning.'));
});
