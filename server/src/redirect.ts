import { Router } from 'express';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { DB } from './db.js';
import { parseUserAgent, referrerHost } from './useragent.js';
import type { LinkRow } from './links.js';

/** Canal interno: o redirecionamento publica cliques, o endpoint SSE escuta. */
export const clickBus = new EventEmitter();
clickBus.setMaxListeners(0);

const SALT = process.env.VISITOR_SALT ?? 'encurta-dev-salt';

/**
 * Identificador de visitante anônimo: hash de IP + user-agent + dia.
 * Permite contar visitantes únicos sem guardar o IP, e muda todo dia
 * (não dá para seguir alguém ao longo do tempo).
 */
export function visitorId(ip: string, ua: string, day: string) {
  return createHash('sha256').update(`${SALT}|${day}|${ip}|${ua}`).digest('hex').slice(0, 16);
}

const page = (title: string, message: string) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Encurta</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#0f0e17;color:#f4f2ff;text-align:center}
h1{font-size:64px;margin:0;color:#8b7bff}p{opacity:.7}</style></head>
<body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

export function redirectRouter(db: DB) {
  const router = Router();
  const findByCode = db.prepare('SELECT * FROM links WHERE code = ?');
  const insertClick = db.prepare(
    'INSERT INTO clicks (link_id, visitor, referrer, browser, os, device) VALUES (?, ?, ?, ?, ?, ?) RETURNING at',
  );

  router.get('/:code', (req, res, next) => {
    const { code } = req.params;
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(code)) return next();

    const link = findByCode.get(code) as unknown as LinkRow | undefined;
    if (!link) {
      res.status(404).type('html').send(page('404', 'Esse link não existe ou foi removido.'));
      return;
    }
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      res.status(410).type('html').send(page('Expirado', 'Esse link tinha data de validade e já expirou.'));
      return;
    }

    const ua = req.get('user-agent') ?? '';
    const parsed = parseUserAgent(ua);
    if (!parsed.bot) {
      const referrer = referrerHost(req.get('referer'));
      const day = new Date().toISOString().slice(0, 10);
      const { at } = insertClick.get(
        link.id,
        visitorId(req.ip ?? '', ua, day),
        referrer,
        parsed.browser,
        parsed.os,
        parsed.device,
      ) as { at: string };
      clickBus.emit(`link:${link.id}`, { at, referrer, browser: parsed.browser, os: parsed.os, device: parsed.device });
    }

    // 302 (e não 301): o navegador não guarda o redirecionamento em cache, então todo clique é contado.
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, link.url);
  });

  return router;
}
