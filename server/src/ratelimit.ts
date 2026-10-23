import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';

interface Options {
  /** Quantas requisições cabem na janela. */
  limit: number;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
  /** Chave que identifica quem está fazendo a requisição (usuário, IP...). */
  key: (req: Parameters<RequestHandler>[0]) => string;
  now?: () => number;
}

/**
 * Limite por janela deslizante em memória. Guarda os timestamps recentes de cada chave
 * e descarta os que saíram da janela. Simples e suficiente para um único processo;
 * com várias instâncias, o lugar disso seria um Redis.
 */
export function rateLimit({ limit, windowMs, key, now = Date.now }: Options): RequestHandler {
  const hits = new Map<string, number[]>();

  return (req, res, next) => {
    const k = key(req);
    const t = now();
    const recent = (hits.get(k) ?? []).filter((ts) => t - ts < windowMs);

    if (recent.length >= limit) {
      const retryAfter = Math.ceil((recent[0] + windowMs - t) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      hits.set(k, recent);
      throw new HttpError(429, `Muitas requisições. Tente de novo em ${retryAfter}s.`);
    }

    recent.push(t);
    hits.set(k, recent);
    res.setHeader('X-RateLimit-Remaining', String(limit - recent.length));
    next();
  };
}
