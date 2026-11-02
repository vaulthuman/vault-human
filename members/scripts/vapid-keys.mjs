// Prints a fresh VAPID key pair and a send secret for push reminders. Nothing is written to disk.
// Put them in production with:  npx wrangler secret put VAPID_PUBLIC_KEY / VAPID_PRIVATE_JWK / PUSH_SEND_SECRET
import { randomBytes, webcrypto as c } from 'node:crypto';
const pair = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await c.subtle.exportKey('jwk', pair.privateKey);
const pub = Buffer.from(await c.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${pub}`);
console.log(`VAPID_PRIVATE_JWK=${JSON.stringify(jwk)}`);
console.log(`PUSH_SEND_SECRET=${randomBytes(32).toString('hex')}`);
