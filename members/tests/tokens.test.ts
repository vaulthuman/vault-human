import { describe, expect, it } from 'vitest';
import { LINK_TTL_MS, makeLinkToken, makeSessionToken, readLinkToken, readSessionToken } from '../src/lib/tokens';

const S = 'test-secret';

describe('sign-in links', () => {
  it('round-trips and lowercases the email', async () => {
    const t = await makeLinkToken(S, 'Test@Example.com', 1000);
    expect(await readLinkToken(S, t, 1000)).toMatchObject({ e: 'test@example.com' });
  });
  it('expires', async () => {
    const t = await makeLinkToken(S, 'a@example.com', 1000);
    expect(await readLinkToken(S, t, 1000 + LINK_TTL_MS + 1)).toBeNull();
  });
  it('rejects another secret, tampering, and session tokens', async () => {
    const t = await makeLinkToken(S, 'a@example.com');
    expect(await readLinkToken('other', t)).toBeNull();
    expect(await readLinkToken(S, 'x' + t)).toBeNull();
    expect(await readLinkToken(S, await makeSessionToken(S, 1))).toBeNull();
    expect(await readSessionToken(S, t)).toBeNull();
  });
});
