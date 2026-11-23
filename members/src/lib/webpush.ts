// Web Push on Web Crypto: VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291 / RFC 8188).
// No dependencies, so it runs the same in Workers, Node and tests.

const enc = new TextEncoder();
type Bytes = Uint8Array<ArrayBuffer>;

export const toB64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromB64u = (s: string): Bytes => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** Derives the content key and nonce shared by sender and receiver (RFC 8291 section 3.4). */
export async function deriveKeys(ecdhSecret: Bytes, authSecret: Bytes, uaPublic: Bytes, asPublic: Bytes, salt: Bytes) {
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  return { cek, nonce };
}

/** Encrypts one push message for a subscription's p256dh and auth keys. Returns the aes128gcm body. */
export async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Bytes> {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Bad p256dh key');
  if (authSecret.length !== 16) throw new Error('Bad auth secret');
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', as.publicKey)) as ArrayBuffer);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, as.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { cek, nonce } = await deriveKeys(ecdhSecret, authSecret, uaPublic, asPublic, salt);
  const body = enc.encode(payload);
  if (body.length > 3800) throw new Error('Push payload too large');
  const plain = concat(body, new Uint8Array([2])); // single, final record
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** Signs a VAPID JWT for the push service's origin with the private key (a P-256 JWK). */
export async function vapidAuth(endpoint: string, privateJwk: string, publicKey: string, subject: string, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = toB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toB64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(privateJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${toB64u(sig)}, k=${publicKey}`;
}

// Only the browsers' own push services. Anything else is refused, so a member can't point the server at other hosts.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.services\.mozilla\.com$/];

export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushEnv = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_JWK?: string };

/** Sends one message. Returns the push service's status; 404 and 410 mean the subscription is gone. */
export async function sendPush(env: PushEnv, sub: PushSub, message: { title: string; body: string; url?: string; tag?: string }, ttl = 6 * 3600): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) throw new Error('VAPID keys are not set');
  if (!validEndpoint(sub.endpoint)) return 410;
  const body = await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, env.VAPID_PRIVATE_JWK, env.VAPID_PUBLIC_KEY, 'mailto:vault@vaulthuman.com'),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
}
