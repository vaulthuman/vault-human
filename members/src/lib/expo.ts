// Phone app notifications through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
// Expo tokens live in push_subs with an "expo:" prefix on the endpoint, next to the browsers' Web Push subscriptions.
import type { PushSub } from './webpush';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

/** "expo:<token>" for a well-formed Expo push token, else null. */
export const expoEndpoint = (token: unknown) => (typeof token === 'string' && TOKEN.test(token) ? `expo:${token}` : null);

export const isExpo = (sub: Pick<PushSub, 'endpoint'>) => sub.endpoint.startsWith('expo:');

/** Sends one message. Returns 410 when Expo says the device is gone, like a Web Push service would. */
export async function sendExpo(sub: Pick<PushSub, 'endpoint'>, message: { title: string; body: string; url?: string }, f: typeof fetch = fetch): Promise<number> {
  const to = sub.endpoint.slice('expo:'.length);
  if (!TOKEN.test(to)) return 410;
  const res = await f(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to, title: message.title, body: message.body, data: { url: message.url ?? '/today' }, sound: 'default' }),
  });
  if (!res.ok) return res.status;
  const ticket = (await res.json().catch(() => null)) as any;
  if (ticket?.data?.status === 'error') return ticket.data.details?.error === 'DeviceNotRegistered' ? 410 : 502;
  return 200;
}
