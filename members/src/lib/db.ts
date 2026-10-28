// Every query the app makes. `Db` is the subset of Cloudflare D1 we use, so tests can pass a SQLite stand-in.

export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Db {
  prepare(sql: string): Stmt;
}

export type Member = {
  id: number;
  email: string;
  name: string | null;
  started_on: string;
  tz: string;
  access: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};

export type Log = { key_id: string; day: string; line: string };

export const memberById = (db: Db, id: number) =>
  db.prepare('SELECT * FROM members WHERE id = ?').bind(id).first<Member>();

export const memberByEmail = (db: Db, email: string) =>
  db.prepare('SELECT * FROM members WHERE email = ?').bind(email.trim().toLowerCase()).first<Member>();

export const memberByCustomer = (db: Db, customerId: string) =>
  db.prepare('SELECT * FROM members WHERE stripe_customer_id = ?').bind(customerId).first<Member>();

export async function createMember(db: Db, email: string, startedOn: string, name?: string | null): Promise<Member> {
  await db
    .prepare('INSERT INTO members (email, started_on, name) VALUES (?, ?, ?)')
    .bind(email.trim().toLowerCase(), startedOn, name?.trim() || null)
    .run();
  return (await memberByEmail(db, email))!;
}

export const setTz = (db: Db, id: number, tz: string) =>
  db.prepare('UPDATE members SET tz = ? WHERE id = ?').bind(tz, id).run();

export const setBilling = (
  db: Db,
  id: number,
  b: { access: boolean; customer?: string | null; subscription?: string | null; status?: string | null },
) =>
  db
    .prepare(
      `UPDATE members SET access = ?,
         stripe_customer_id = COALESCE(?, stripe_customer_id),
         stripe_subscription_id = COALESCE(?, stripe_subscription_id),
         subscription_status = COALESCE(?, subscription_status)
       WHERE id = ?`,
    )
    .bind(b.access ? 1 : 0, b.customer ?? null, b.subscription ?? null, b.status ?? null, id)
    .run();

export const logsFor = async (db: Db, memberId: number) =>
  (await db.prepare('SELECT key_id, day, line FROM logs WHERE member_id = ? ORDER BY day DESC').bind(memberId).all<Log>())
    .results;

export const saveLog = (db: Db, memberId: number, keyId: string, day: string, line: string) =>
  db
    .prepare(
      `INSERT INTO logs (member_id, key_id, day, line) VALUES (?, ?, ?, ?)
       ON CONFLICT (member_id, day) DO UPDATE SET line = excluded.line, key_id = excluded.key_id`,
    )
    .bind(memberId, keyId, day, line)
    .run();

/** Marks a sign-in link as used. Returns false if it had been used already. */
export async function useLinkNonce(db: Db, nonce: string): Promise<boolean> {
  const seen = await db.prepare('SELECT nonce FROM used_links WHERE nonce = ?').bind(nonce).first();
  if (seen) return false;
  await db.prepare('INSERT INTO used_links (nonce) VALUES (?)').bind(nonce).run();
  return true;
}

export const eventSeen = async (db: Db, id: string) =>
  !!(await db.prepare('SELECT id FROM stripe_events WHERE id = ?').bind(id).first());

export const recordEvent = (db: Db, id: string, type: string) =>
  db.prepare('INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)').bind(id, type).run();
