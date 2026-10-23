import { Router } from 'express';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { DB } from './db.js';
import { HttpError, notFound } from './errors.js';
import { requireAuth } from './auth.js';
import { rateLimit } from './ratelimit.js';
import { clickBus } from './redirect.js';

export interface LinkRow {
  id: number;
  user_id: number;
  code: string;
  url: string;
  title: string | null;
  expires_at: string | null;
  created_at: string;
}

// ---------- Códigos curtos ----------

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/l/I
const RESERVED = new Set(['api', 'app', 'login', 'admin', 'assets', 'static', 'health', 'favicon.ico']);

export function randomCode(length = 6) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

// ---------- Validação ----------

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url('URL inválida')
  .refine((u) => {
    try {
      return /^https?:$/.test(new URL(u).protocol);
    } catch {
      return false; // já reportado por .url()
    }
  }, 'Use um link http:// ou https://');

const alias = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{3,30}$/, 'Use 3 a 30 letras, números, - ou _')
  .refine((a) => !RESERVED.has(a.toLowerCase()), 'Esse apelido é reservado');

const futureDate = z
  .string()
  .datetime({ offset: true, message: 'Data inválida' })
  .refine((d) => new Date(d).getTime() > Date.now(), 'A expiração precisa ser no futuro');

const createSchema = z.object({
  url: httpUrl,
  alias: alias.optional(),
  title: z.string().trim().max(100).optional(),
  expiresAt: futureDate.optional(),
});

const updateSchema = z.object({
  url: httpUrl.optional(),
  title: z.string().trim().max(100).nullable().optional(),
  expiresAt: futureDate.nullable().optional(),
});

const RANGES = { '7': 7, '30': 30, '90': 90 } as const;

// ---------- Rotas ----------

export function linksRouter(db: DB, publicUrl: string) {
  const router = Router();
  router.use(requireAuth);

  const withShortUrl = <T extends { code: string }>(row: T) => ({ ...row, short_url: `${publicUrl}/${row.code}` });

  const findLink = (id: number, userId: number) => {
    const row = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) throw notFound('Link');
    return row as unknown as LinkRow;
  };

  const createLimit = rateLimit({ limit: 20, windowMs: 60_000, key: (req) => `create:${req.userId}` });

  router.get('/links', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = db
      .prepare(
        `SELECT l.*, COUNT(c.id) AS clicks, MAX(c.at) AS last_click
         FROM links l LEFT JOIN clicks c ON c.link_id = l.id
         WHERE l.user_id = ? AND (? = '' OR l.url LIKE ? OR l.code LIKE ? OR l.title LIKE ?)
         GROUP BY l.id ORDER BY l.created_at DESC, l.id DESC`,
      )
      .all(req.userId, q, `%${q}%`, `%${q}%`, `%${q}%`) as unknown as (LinkRow & { clicks: number })[];
    res.json(rows.map(withShortUrl));
  });

  router.post('/links', createLimit, (req, res) => {
    const data = createSchema.parse(req.body);
    const insert = db.prepare('INSERT INTO links (user_id, code, url, title, expires_at) VALUES (?, ?, ?, ?, ?)');
    const expires = data.expiresAt ? new Date(data.expiresAt).toISOString() : null;

    const tryInsert = (code: string) => {
      try {
        return Number(insert.run(req.userId, code, data.url, data.title || null, expires).lastInsertRowid);
      } catch (err) {
        if (String(err).includes('UNIQUE')) return null;
        throw err;
      }
    };

    let id: number | null;
    if (data.alias) {
      id = tryInsert(data.alias);
      if (id === null) throw new HttpError(409, 'Esse apelido já está em uso');
    } else {
      // 57^6 ≈ 34 bilhões de combinações: colisão é rara, mas tratamos mesmo assim.
      let attempts = 0;
      do id = tryInsert(randomCode());
      while (id === null && ++attempts < 5);
      if (id === null) throw new HttpError(503, 'Não foi possível gerar um código. Tente de novo.');
    }
    res.status(201).json(withShortUrl({ ...findLink(id, req.userId), clicks: 0, last_click: null }));
  });

  router.patch('/links/:id', (req, res) => {
    const link = findLink(Number(req.params.id), req.userId);
    const data = updateSchema.parse(req.body);
    const expires =
      data.expiresAt === undefined ? link.expires_at : data.expiresAt && new Date(data.expiresAt).toISOString();
    db.prepare('UPDATE links SET url = ?, title = ?, expires_at = ? WHERE id = ?').run(
      data.url ?? link.url,
      data.title === undefined ? link.title : data.title || null,
      expires,
      link.id,
    );
    res.json(withShortUrl(findLink(link.id, req.userId)));
  });

  router.delete('/links/:id', (req, res) => {
    const link = findLink(Number(req.params.id), req.userId);
    db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
    res.status(204).end();
  });

  // ---------- Analytics ----------

  router.get('/links/:id/stats', (req, res) => {
    const link = findLink(Number(req.params.id), req.userId);
    const days = RANGES[String(req.query.days ?? '30') as keyof typeof RANGES];
    if (!days) throw new HttpError(400, 'Use days=7, 30 ou 90');

    const today = new Date();
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i)));
      return d.toISOString().slice(0, 10);
    });
    const since = `${dates[0]}T00:00:00.000Z`;

    const totals = db
      .prepare('SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS unique_visitors FROM clicks WHERE link_id = ? AND at >= ?')
      .get(link.id, since) as { clicks: number; unique_visitors: number };

    const perDay = db
      .prepare(
        `SELECT substr(at, 1, 10) AS date, COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS unique_visitors
         FROM clicks WHERE link_id = ? AND at >= ? GROUP BY date`,
      )
      .all(link.id, since) as { date: string; clicks: number; unique_visitors: number }[];
    const byDate = new Map(perDay.map((r) => [r.date, r]));
    // Dias sem clique entram com zero: o gráfico precisa de todos os pontos.
    const series = dates.map((date) => byDate.get(date) ?? { date, clicks: 0, unique_visitors: 0 });

    const breakdown = (column: 'referrer' | 'browser' | 'os' | 'device', limit = 6) =>
      db
        .prepare(
          `SELECT ${column} AS name, COUNT(*) AS count FROM clicks
           WHERE link_id = ? AND at >= ? GROUP BY ${column} ORDER BY count DESC, name LIMIT ?`,
        )
        .all(link.id, since, limit);

    const recent = db
      .prepare('SELECT at, referrer, browser, os, device FROM clicks WHERE link_id = ? ORDER BY at DESC, id DESC LIMIT 15')
      .all(link.id);

    res.json({
      link: withShortUrl(link),
      days,
      clicks: totals.clicks,
      unique_visitors: totals.unique_visitors,
      series,
      referrers: breakdown('referrer'),
      browsers: breakdown('browser'),
      os: breakdown('os'),
      devices: breakdown('device', 3),
      recent,
    });
  });

  router.get('/links/:id/qr.svg', async (req, res) => {
    const link = findLink(Number(req.params.id), req.userId);
    const svg = await QRCode.toString(`${publicUrl}/${link.code}`, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    });
    res.type('image/svg+xml').send(svg);
  });

  /** Server-Sent Events: empurra cada clique novo para o painel em tempo real. */
  router.get('/links/:id/live', (req, res) => {
    const link = findLink(Number(req.params.id), req.userId);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const onClick = (click: unknown) => res.write(`event: click\ndata: ${JSON.stringify(click)}\n\n`);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    clickBus.on(`link:${link.id}`, onClick);
    req.on('close', () => {
      clearInterval(heartbeat);
      clickBus.off(`link:${link.id}`, onClick);
    });
  });

  // ---------- Visão geral (cabeçalho do painel) ----------

  router.get('/overview', (req, res) => {
    const row = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM links WHERE user_id = ?) AS links,
           (SELECT COUNT(*) FROM clicks c JOIN links l ON l.id = c.link_id WHERE l.user_id = ?) AS clicks,
           (SELECT COUNT(*) FROM clicks c JOIN links l ON l.id = c.link_id
              WHERE l.user_id = ? AND c.at >= ?) AS clicks_today`,
      )
      .get(req.userId, req.userId, req.userId, `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    res.json(row);
  });

  return router;
}
