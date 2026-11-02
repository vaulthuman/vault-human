// Web Push: a message encrypted for a browser decrypts with the browser's keys, and the VAPID token verifies.
import { describe, expect, it } from 'vitest';
import { savePushSub } from '../src/lib/db';
import { broadcast, messageFrom, REMINDERS } from '../src/lib/reminders';
import { deriveKeys, encryptPayload, fromB64u, toB64u, validEndpoint, vapidAuth } from '../src/lib/webpush';
import { testDb } from './sqlite-d1';

async function browserKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const pub = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, p256dh: toB64u(pub), auth: toB64u(auth), pub, authBytes: auth };
}

// What the browser does on receipt (RFC 8291), written independently of the sender.
async function decrypt(body: Uint8Array, ua: Awaited<ReturnType<typeof browserKeys>>) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey } as any, ua.pair.privateKey, 256));
  const { cek, nonce } = await deriveKeys(secret, ua.authBytes, ua.pub, asPublic, salt);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  expect(plain[plain.length - 1]).toBe(2);
  return { rs, idlen, text: new TextDecoder().decode(plain.slice(0, -1)) };
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
  const pub = toB64u(new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer));
  return { pair, jwk, pub };
}

describe('payload encryption (aes128gcm)', () => {
  it('round-trips through the browser side', async () => {
    const ua = await browserKeys();
    const msg = JSON.stringify(REMINDERS.morning);
    const out = await decrypt(await encryptPayload(msg, ua.p256dh, ua.auth), ua);
    expect(out).toEqual({ rs: 4096, idlen: 65, text: msg });
  });

  it('uses a fresh key and salt for every message', async () => {
    const ua = await browserKeys();
    const a = await encryptPayload('x', ua.p256dh, ua.auth);
    const b = await encryptPayload('x', ua.p256dh, ua.auth);
    expect(toB64u(a.slice(0, 86))).not.toBe(toB64u(b.slice(0, 86)));
  });

  it('cannot be read with another browser’s keys', async () => {
    const ua = await browserKeys();
    const other = await browserKeys();
    const body = await encryptPayload('secret', ua.p256dh, ua.auth);
    await expect(decrypt(body, other)).rejects.toThrow();
  });

  it('refuses malformed keys and oversized payloads', async () => {
    const ua = await browserKeys();
    await expect(encryptPayload('x', toB64u(new Uint8Array(10)), ua.auth)).rejects.toThrow();
    await expect(encryptPayload('x', ua.p256dh, toB64u(new Uint8Array(8)))).rejects.toThrow();
    await expect(encryptPayload('x'.repeat(4000), ua.p256dh, ua.auth)).rejects.toThrow();
  });
});

describe('VAPID', () => {
  it('signs a token for the push service origin that verifies with the public key', async () => {
    const v = await vapidKeys();
    const now = 1_800_000_000_000;
    const header = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', v.jwk, v.pub, 'mailto:vault@vaulthuman.com', now);
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(m[4]).toBe(v.pub);
    const claims = JSON.parse(new TextDecoder().decode(fromB64u(m[2])));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: now / 1000 + 43200, sub: 'mailto:vault@vaulthuman.com' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, v.pair.publicKey, fromB64u(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });
});

describe('push endpoints', () => {
  it('accepts only the browsers’ push services over https', () => {
    expect(validEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(validEndpoint('https://web.push.apple.com/QO_x')).toBe(true);
    expect(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(validEndpoint('https://wns2-by3p.notify.windows.com/w/?token=x')).toBe(true);
    expect(validEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(validEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(validEndpoint('https://evil.example.com/push.apple.com')).toBe(false);
    expect(validEndpoint('https://push.apple.com.evil.example/x')).toBe(false);
    expect(validEndpoint('https://169.254.169.254/latest')).toBe(false);
    expect(validEndpoint(42)).toBe(false);
  });
});

describe('reminders', () => {
  it('builds named and custom messages, keeping links on this site', () => {
    expect(messageFrom({ kind: 'evening' })).toBe(REMINDERS.evening);
    expect(messageFrom({ title: 'Hi', body: 'There', url: '/keys' })).toMatchObject({ url: '/keys' });
    expect(messageFrom({ title: 'Hi', body: 'There', url: '//evil.example' })).toMatchObject({ url: '/today' });
    expect(messageFrom({ title: 'Hi', body: 'There', url: 'https://evil.example' })).toMatchObject({ url: '/today' });
    expect(messageFrom({ title: 'Hi' })).toBeNull();
    expect(messageFrom(null)).toBeNull();
  });

  it('sends only to open members and drops devices that are gone', async () => {
    const db = testDb();
    db.raw.exec("INSERT INTO members (id, email, started_on, access) VALUES (1, 'open@example.com', '2026-01-01', 1), (2, 'closed@example.com', '2026-01-01', 0)");
    await savePushSub(db, 1, 'https://fcm.googleapis.com/a', 'k', 'a');
    await savePushSub(db, 1, 'https://fcm.googleapis.com/gone', 'k', 'a');
    await savePushSub(db, 2, 'https://fcm.googleapis.com/b', 'k', 'a');
    const sent: string[] = [];
    const fake = async (_env: any, s: any) => { sent.push(s.endpoint); return s.endpoint.endsWith('gone') ? 410 : 201; };
    expect(await broadcast(db, {}, REMINDERS.morning, fake)).toEqual({ devices: 2, sent: 1, removed: 1, failed: 0 });
    expect(sent).not.toContain('https://fcm.googleapis.com/b');
    const left = (db.raw.prepare('SELECT endpoint FROM push_subs ORDER BY id').all() as any[]).map((r) => r.endpoint);
    expect(left).toEqual(['https://fcm.googleapis.com/a', 'https://fcm.googleapis.com/b']);
  });

  it('moves a device to whoever signs in on it last', async () => {
    const db = testDb();
    db.raw.exec("INSERT INTO members (id, email, started_on, access) VALUES (1, 'a@example.com', '2026-01-01', 1), (2, 'b@example.com', '2026-01-01', 1)");
    await savePushSub(db, 1, 'https://fcm.googleapis.com/a', 'k', 'a');
    await savePushSub(db, 2, 'https://fcm.googleapis.com/a', 'k2', 'a2');
    expect(db.raw.prepare('SELECT member_id, p256dh FROM push_subs').all()).toEqual([{ member_id: 2, p256dh: 'k2' }]);
  });
});
