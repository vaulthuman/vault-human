-- What members write in each Key's boxes: one row per Key per box, so any Key can be filled in or finished later.
CREATE TABLE answers (
  member_id INTEGER NOT NULL REFERENCES members(id),
  key_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  value TEXT NOT NULL,
  day TEXT NOT NULL,                     -- YYYY-MM-DD in the member's time zone, when last saved
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, key_id, prompt_id)
);
CREATE INDEX answers_member_day ON answers (member_id, day);
