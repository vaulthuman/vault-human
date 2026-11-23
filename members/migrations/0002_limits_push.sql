-- Sign-in request log (rate limits) and phone push subscriptions.
CREATE TABLE signin_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,                      -- hashed, never the raw address
  at INTEGER NOT NULL                    -- unix ms
);
CREATE INDEX signin_requests_email ON signin_requests (email, at);
CREATE INDEX signin_requests_ip ON signin_requests (ip, at);

CREATE TABLE push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
