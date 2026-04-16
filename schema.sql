CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  received_at TEXT NOT NULL
);

CREATE INDEX idx_emails_sender ON emails(sender);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_recipient ON emails(recipient);
CREATE INDEX idx_emails_recipient_subject ON emails(recipient, subject);
