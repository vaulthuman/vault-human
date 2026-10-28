// A D1-shaped wrapper around node:sqlite, with the real migrations applied, for tests.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Db, Stmt } from '../src/lib/db';

export function testDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of readdirSync(dir).sort()) raw.exec(readFileSync(new URL(f, dir), 'utf8'));
  const stmt = (sql: string, args: any[] = []): Stmt => ({
    bind: (...v) => stmt(sql, v),
    first: async () => (raw.prepare(sql).get(...args) as any) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...args) as any[] }),
    run: async () => raw.prepare(sql).run(...args),
  });
  return { raw, prepare: (sql) => stmt(sql) };
}
