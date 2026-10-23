/**
 * Cria um usuário de demonstração com links e 30 dias de cliques realistas.
 * Uso: npm run seed   →   login: demo@encurta.test / demo123
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import bcrypt from 'bcryptjs';
import { openDatabase } from './db.js';
import { visitorId } from './redirect.js';

const DB_FILE = process.env.DB_FILE ?? 'data/encurta.db';
const EMAIL = 'demo@encurta.test';

mkdirSync(dirname(DB_FILE), { recursive: true });
const db = openDatabase(DB_FILE);

let state = 7;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(weighted: [T, number][]): T => {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of weighted) if ((r -= w) <= 0) return v;
  return weighted[0][0];
};

const LINKS: [string, string, string, number][] = [
  ['portfolio', 'https://github.com', 'Meu portfólio', 26],
  ['tcc-2026', 'https://example.com/tcc/apresentacao-final', 'Slides do TCC', 12],
  ['curriculo', 'https://example.com/curriculo.pdf', 'Currículo', 9],
  ['live-js', 'https://example.com/eventos/live-javascript-moderno', 'Live de JavaScript', 5],
];

const REFERRERS: [string, number][] = [['linkedin.com', 40], ['direto', 25], ['google.com', 15], ['instagram.com', 10], ['github.com', 7], ['t.co', 3]];
const AGENTS: [[string, string, string], number][] = [
  [['Chrome', 'Windows', 'desktop'], 34],
  [['Safari', 'iOS', 'mobile'], 22],
  [['Chrome', 'Android', 'mobile'], 20],
  [['Edge', 'Windows', 'desktop'], 9],
  [['Safari', 'macOS', 'desktop'], 7],
  [['Firefox', 'Linux', 'desktop'], 5],
  [['Samsung Internet', 'Android', 'tablet'], 3],
];

db.exec('BEGIN');
db.prepare('DELETE FROM users WHERE email = ?').run(EMAIL);
const userId = Number(
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Demo', EMAIL, bcrypt.hashSync('demo123', 10))
    .lastInsertRowid,
);

const insertLink = db.prepare('INSERT INTO links (user_id, code, url, title, created_at) VALUES (?, ?, ?, ?, ?)');
const insertClick = db.prepare(
  'INSERT INTO clicks (link_id, at, visitor, referrer, browser, os, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
);

const now = Date.now();
for (const [code, url, title, perDay] of LINKS) {
  db.prepare('DELETE FROM links WHERE code = ?').run(code);
  const created = new Date(now - 31 * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  const linkId = Number(insertLink.run(userId, code, url, title, created).lastInsertRowid);

  for (let d = 29; d >= 0; d--) {
    // tendência de alta + fim de semana mais fraco + ruído
    const date = new Date(now - d * 86_400_000);
    const weekend = [0, 6].includes(date.getUTCDay()) ? 0.55 : 1;
    const n = Math.round(perDay * (0.5 + (30 - d) / 40) * weekend * (0.6 + rand() * 0.8));
    for (let i = 0; i < n; i++) {
      const at = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 8 + Math.floor(rand() * 14), Math.floor(rand() * 60)));
      if (at.getTime() > now) continue;
      const [browser, os, device] = pick(AGENTS);
      // pool menor que o nº de cliques: parte das pessoas clica mais de uma vez no dia
      const pool = Math.max(2, Math.round(n * 0.65));
      const visitor = visitorId(`10.0.0.${Math.floor(rand() * pool)}`, browser + os, at.toISOString().slice(0, 10));
      insertClick.run(linkId, at.toISOString(), visitor, pick(REFERRERS), browser, os, device);
    }
  }
}
db.exec('COMMIT');

console.log(`Seed concluído em ${DB_FILE} — login: ${EMAIL} / demo123`);
