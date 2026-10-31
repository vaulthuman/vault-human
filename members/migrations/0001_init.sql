-- Members, their daily lines, and the Stripe events already handled.
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  started_on TEXT NOT NULL,              -- YYYY-MM-DD, first day of membership
  tz TEXT NOT NULL DEFAULT 'America/Chicago',
  access INTEGER NOT NULL DEFAULT 0,     -- 1 = may use the app
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  key_id TEXT NOT NULL,
  day TEXT NOT NULL,                     -- YYYY-MM-DD in the member's time zone
  line TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, day)
);

-- Single-use sign-in links: the nonce is recorded when the link is used.
CREATE TABLE used_links (
  nonce TEXT PRIMARY KEY,
  used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
