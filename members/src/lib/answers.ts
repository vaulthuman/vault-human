// Each Key's own boxes (from keys.json "prompts"), how a filled-in form is read, and whether a Key is done.
import type { AnswerRow, Log } from './db';
import type { Key } from './keys';

export type Prompt = { id: string; kind: 'check' | 'scale' | 'text' | 'long'; label: string };
export type Status = 'done' | 'started' | 'open';
export const MAX = { text: 280, long: 1200 } as const;

export const promptsOf = (k: Key) => ((k as Key & { prompts?: Prompt[] }).prompts ?? []) as Prompt[];

/** Cleans one value for its box; '' means empty. */
export function cleanValue(p: Prompt, raw: unknown): string {
  const v = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  if (p.kind === 'check') return v === 'yes' || v === 'on' || v === 'true' ? 'yes' : '';
  if (p.kind === 'scale') return /^(10|[1-9])$/.test(v.trim()) ? v.trim() : '';
  if (p.kind === 'text') return v.replace(/\s+/g, ' ').trim().slice(0, MAX.text);
  return v.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX.long);
}

/** Every box of the Key, read from a submitted form or JSON object (missing = empty). */
export function readEntries(k: Key, get: (name: string) => unknown) {
  return promptsOf(k).map((p) => ({ prompt: p.id, value: cleanValue(p, get(p.id)) }));
}

/** Answers grouped by Key, then by box. */
export function byKey(rows: AnswerRow[]) {
  const m = new Map<string, Record<string, string>>();
  for (const r of rows) {
    if (!m.has(r.key_id)) m.set(r.key_id, {});
    m.get(r.key_id)![r.prompt_id] = r.value;
  }
  return m;
}

/** Done when every box is filled; started when some are (or an earlier one-line note exists); otherwise open. */
export function statusOf(k: Key, answers: Record<string, string> | undefined, legacy: Log[] = []): Status {
  const ps = promptsOf(k);
  const filled = ps.filter((p) => answers?.[p.id]).length;
  if (ps.length && filled === ps.length) return 'done';
  if (filled > 0 || legacy.some((l) => l.key_id === k.id)) return 'started';
  return 'open';
}

export const STATUS_WORD: Record<Status, string> = { done: 'Done', started: 'Started', open: 'To do' };
