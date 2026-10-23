import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { parseUserAgent, referrerHost } from '../src/useragent.js';
import { rateLimit } from '../src/ratelimit.js';
import { errorHandler } from '../src/errors.js';
import { randomCode } from '../src/links.js';
import { visitorId } from '../src/redirect.js';

const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  samsungTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  whatsapp: 'WhatsApp/2.23.20.0',
};

describe('parseUserAgent', () => {
  it.each([
    ['chromeWin', 'Chrome', 'Windows', 'desktop'],
    ['edgeWin', 'Edge', 'Windows', 'desktop'],
    ['safariIphone', 'Safari', 'iOS', 'mobile'],
    ['firefoxMac', 'Firefox', 'macOS', 'desktop'],
    ['chromeAndroid', 'Chrome', 'Android', 'mobile'],
    ['samsungTablet', 'Samsung Internet', 'Android', 'tablet'],
    ['ipad', 'Safari', 'iOS', 'tablet'],
  ] as const)('%s → %s / %s / %s', (key, browser, os, device) => {
    expect(parseUserAgent(UA[key])).toEqual({ browser, os, device, bot: false });
  });

  it('marca robôs e prévias de link como bot (não contam como clique)', () => {
    expect(parseUserAgent(UA.googlebot).bot).toBe(true);
    expect(parseUserAgent(UA.whatsapp).bot).toBe(true);
    expect(parseUserAgent('').bot).toBe(true);
  });
});

describe('referrerHost', () => {
  it('extrai só o domínio, sem www', () => {
    expect(referrerHost('https://www.google.com/search?q=encurta')).toBe('google.com');
    expect(referrerHost('https://t.co/abc')).toBe('t.co');
    expect(referrerHost(undefined)).toBe('direto');
    expect(referrerHost('lixo')).toBe('direto');
  });
});

describe('randomCode', () => {
  it('gera códigos sem caracteres ambíguos', () => {
    const codes = Array.from({ length: 500 }, () => randomCode());
    expect(codes.every((c) => /^[a-zA-Z2-9]{6}$/.test(c) && !/[0O1lI]/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(500);
  });
});

describe('visitorId', () => {
  it('é estável no mesmo dia e muda no dia seguinte', () => {
    const a = visitorId('1.2.3.4', 'ua', '2026-10-19');
    expect(visitorId('1.2.3.4', 'ua', '2026-10-19')).toBe(a);
    expect(visitorId('1.2.3.4', 'ua', '2026-10-20')).not.toBe(a);
    expect(visitorId('1.2.3.5', 'ua', '2026-10-19')).not.toBe(a);
    expect(a).not.toContain('1.2.3.4');
  });
});

describe('rateLimit', () => {
  it('bloqueia acima do limite e libera quando a janela passa', async () => {
    let now = 0;
    const app = express();
    app.get('/', rateLimit({ limit: 2, windowMs: 1000, key: () => 'k', now: () => now }), (_req, res) => {
      res.send('ok');
    });
    app.use(errorHandler);

    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(200);
    const blocked = await request(app).get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('1');

    now = 1001;
    expect((await request(app).get('/')).status).toBe(200);
  });
});
