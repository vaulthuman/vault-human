// The members site's app API (https://members.vaulthuman.com/api/app/*). The token lives in the phone's secure store.
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API = (process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'https://members.vaulthuman.com').replace(/\/$/, '');
const TOKEN = 'vh_token';

export type Key = {
  id: string; day: number; time: 'morning' | 'evening'; title: string; video: string; poster: string;
  paragraphs: string[]; steps: string[]; note: string | null; prompts: Prompt[];
};
export type Prompt = { id: string; kind: 'check' | 'scale' | 'text' | 'long'; label: string };
export type Status = 'done' | 'started' | 'open';
export type KeyWithAnswers = Key & { answers: Record<string, string>; status: Status; lines?: { day: string; line: string }[] };
export type Member = { name: string | null; email: string; access: boolean; startedOn: string; tz: string };
export type Today = {
  greeting: string; day: string; chamber: { name: string; n: number }; keyNumber: number;
  key: KeyWithAnswers; also: KeyWithAnswers[]; next: { id: string; title: string; when: string } | null;
  todayLine: string | null; streak: number; keysTurned: number;
  firstWeek: { lastDay: boolean; bookingUrl: string } | null;
};
export type KeyWithLines = KeyWithAnswers & { lines: { day: string; line: string }[] };

// The secure store on phones; the browser's session storage only for the web preview.
const web = Platform.OS === 'web';
export const getToken = async () => (web ? globalThis.sessionStorage?.getItem(TOKEN) ?? null : SecureStore.getItemAsync(TOKEN));
export const setToken = async (t: string) => { if (web) globalThis.sessionStorage?.setItem(TOKEN, t); else await SecureStore.setItemAsync(TOKEN, t); };
export const clearToken = async () => { if (web) globalThis.sessionStorage?.removeItem(TOKEN); else await SecureStore.deleteItemAsync(TOKEN); };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth !== false) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch {
    throw new ApiError('No connection. Check your signal and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'Something went wrong. Try again.', res.status);
  return data as T;
}

export const requestCode = (email: string) => call<{ challenge: string }>('/api/app/code', { method: 'POST', body: { email }, auth: false });
export const verifyCode = (email: string, code: string, challenge: string) =>
  call<{ token: string; member: Member }>('/api/app/verify', { method: 'POST', body: { email, code, challenge }, auth: false });
export const fetchToday = () => call<{ member: Member; today: Today | null }>('/api/app/today');
export const saveLine = (line: string, tz: string) => call<{ today: Today }>('/api/app/log', { method: 'POST', body: { line, tz } });
export const saveAnswers = (keyId: string, answers: Record<string, string>, tz: string) =>
  call<{ today: Today }>('/api/app/answers', { method: 'POST', body: { keyId, answers, tz } });
export const fetchKeys = () => call<{ current: string; total: number; streak: number; next: { id: string; title: string; when: string } | null; keys: KeyWithLines[] }>('/api/app/keys');
export const savePushToken = (token: string) => call<{ ok: true }>('/api/app/push', { method: 'POST', body: { token } });
export const removePushToken = (token: string) => call<{ ok: true }>('/api/app/push', { method: 'DELETE', body: { token } });
