import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS links (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    url        TEXT    NOT NULL,
    title      TEXT,
    expires_at TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Cada clique guarda só dados agregáveis: nada de IP em texto puro.
  CREATE TABLE IF NOT EXISTS clicks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id    INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    visitor    TEXT    NOT NULL,         -- hash diário de IP + user-agent (visitantes únicos)
    referrer   TEXT    NOT NULL,         -- só o domínio de origem, ou "direto"
    browser    TEXT    NOT NULL,
    os         TEXT    NOT NULL,
    device     TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_links_user  ON links(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id, at);
`;

export function openDatabase(file = ':memory:'): DB {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}
