import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { openDatabase, type DB } from '../src/db.js';

const PUBLIC = 'https://enc.ur';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let app: Express;
let db: DB;
let auth: Record<string, string>;

async function signUp(email = 'ana@gmail.com') {
  const res = await request(app).post('/api/auth/register').send({ name: 'Ana', email, password: 'Segredo#2026' });
  return { Authorization: `Bearer ${res.body.token}` };
}

const createLink = (body: object, headers = auth) => request(app).post('/api/links').set(headers).send(body);

const visit = (code: string, ua = CHROME, referer?: string, ip = '10.0.0.1') => {
  const r = request(app).get(`/${code}`).set('User-Agent', ua).set('X-Forwarded-For', ip);
  return referer ? r.set('Referer', referer) : r;
};

beforeEach(async () => {
  db = openDatabase(':memory:');
  app = createApp(db, { publicUrl: PUBLIC });
  app.set('trust proxy', true); // permite simular IPs diferentes nos testes
  auth = await signUp();
});

describe('criação de links', () => {
  it('gera código aleatório e devolve o link curto', async () => {
    const res = await createLink({ url: 'https://example.com/um/caminho/bem/longo' });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[a-zA-Z2-9]{6}$/);
    expect(res.body.short_url).toBe(`${PUBLIC}/${res.body.code}`);
  });

  it('aceita apelido personalizado e recusa duplicado (sem diferenciar maiúsculas)', async () => {
    expect((await createLink({ url: 'https://a.com', alias: 'meu-tcc' })).status).toBe(201);
    expect((await createLink({ url: 'https://b.com', alias: 'MEU-TCC' })).status).toBe(409);
  });

  it('valida cadastro, URL, apelido e expiração', async () => {
    const register = (email: string, password: string) =>
      request(app).post('/api/auth/register').send({ name: 'Caio', email, password });
    expect((await register('caio@nmdiosa.com', 'Segredo#2026')).body.error).toContain('provedor comum');
    expect((await register('caio@gmail.com', 'segredo123')).body.error).toContain('maiúscula');
    expect((await register('caio@gmail.com', 'Curta#1')).body.error).toContain('10 caracteres');
    expect((await register('caio@gmail.com', 'Segredo#2026')).status).toBe(201);

    const cases = [
      { url: 'javascript:alert(1)' },
      { url: 'ftp://arquivos.com' },
      { url: 'nem-url' },
      { url: 'https://a.com', alias: 'api' },
      { url: 'https://a.com', alias: 'a b' },
      { url: 'https://a.com', expiresAt: '2000-01-01T00:00:00Z' },
    ];
    for (const body of cases) expect((await createLink(body)).status, JSON.stringify(body)).toBe(400);
  });

  it('limita a 20 criações por minuto por usuário', async () => {
    for (let i = 0; i < 20; i++) await createLink({ url: `https://a.com/${i}` });
    const res = await createLink({ url: 'https://a.com/21' });
    expect(res.status).toBe(429);
    // outro usuário não é afetado
    expect((await createLink({ url: 'https://a.com' }, await signUp('bia@gmail.com'))).status).toBe(201);
  });
});

describe('redirecionamento', () => {
  it('redireciona com 302 sem cache e conta o clique', async () => {
    const { body: link } = await createLink({ url: 'https://example.com/destino', alias: 'ola' });
    const res = await visit('ola');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/destino');
    expect(res.headers['cache-control']).toBe('no-store');

    const list = await request(app).get('/api/links').set(auth);
    expect(list.body[0]).toMatchObject({ id: link.id, clicks: 1 });
  });

  it('não conta robôs nem prévias de link', async () => {
    await createLink({ url: 'https://example.com', alias: 'bot' });
    expect((await visit('bot', 'WhatsApp/2.23')).status).toBe(302);
    expect((await visit('bot', 'Googlebot/2.1')).status).toBe(302);
    const list = await request(app).get('/api/links').set(auth);
    expect(list.body[0].clicks).toBe(0);
  });

  it('responde 404 para código inexistente e 410 para link expirado', async () => {
    expect((await visit('naoexiste')).status).toBe(404);

    const { body } = await createLink({ url: 'https://a.com', alias: 'velho', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    db.prepare('UPDATE links SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', body.id);
    const res = await visit('velho');
    expect(res.status).toBe(410);
    expect(res.text).toContain('expirou');
  });
});

describe('analytics', () => {
  it('agrega cliques, visitantes únicos, origens, navegadores e dispositivos', async () => {
    const { body: link } = await createLink({ url: 'https://example.com', alias: 'stats' });
    await visit('stats', CHROME, 'https://www.google.com/search?q=x', '1.1.1.1');
    await visit('stats', CHROME, 'https://www.google.com/', '1.1.1.1'); // mesmo visitante
    await visit('stats', IPHONE, 'https://t.co/abc', '2.2.2.2');
    await visit('stats', IPHONE, undefined, '3.3.3.3');

    const { body } = await request(app).get(`/api/links/${link.id}/stats?days=7`).set(auth);
    expect(body.clicks).toBe(4);
    expect(body.unique_visitors).toBe(3);
    expect(body.series).toHaveLength(7);
    expect(body.series.at(-1)).toMatchObject({ clicks: 4, unique_visitors: 3 });
    expect(body.series[0].clicks).toBe(0);
    expect(body.referrers).toEqual([
      { name: 'google.com', count: 2 },
      { name: 'direto', count: 1 },
      { name: 't.co', count: 1 },
    ]);
    expect(body.browsers).toEqual([
      { name: 'Chrome', count: 2 },
      { name: 'Safari', count: 2 },
    ]);
    expect(body.devices).toEqual([
      { name: 'desktop', count: 2 },
      { name: 'mobile', count: 2 },
    ]);
    expect(body.recent).toHaveLength(4);

    const overview = await request(app).get('/api/overview').set(auth);
    expect(overview.body).toEqual({ links: 1, clicks: 4, clicks_today: 4 });
  });

  it('rejeita intervalo inválido e protege dados de outros usuários', async () => {
    const { body: link } = await createLink({ url: 'https://example.com' });
    expect((await request(app).get(`/api/links/${link.id}/stats?days=5`).set(auth)).status).toBe(400);
    const other = await signUp('bia@gmail.com');
    expect((await request(app).get(`/api/links/${link.id}/stats`).set(other)).status).toBe(404);
    expect((await request(app).delete(`/api/links/${link.id}`).set(other)).status).toBe(404);
  });

  it('gera QR code em SVG', async () => {
    const { body: link } = await createLink({ url: 'https://example.com' });
    const res = await request(app).get(`/api/links/${link.id}/qr.svg`).set(auth).buffer(true).parse((r, cb) => {
      let data = '';
      r.on('data', (c: Buffer) => (data += c));
      r.on('end', () => cb(null, data));
    });
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toMatch(/^<svg/);
  });

  it('edita destino e remove expiração', async () => {
    const { body: link } = await createLink({ url: 'https://a.com', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    const res = await request(app).patch(`/api/links/${link.id}`).set(auth).send({ url: 'https://b.com', expiresAt: null, title: 'Novo' });
    expect(res.body).toMatchObject({ url: 'https://b.com', expires_at: null, title: 'Novo' });
  });
});

describe('tempo real (SSE)', () => {
  it('envia o clique para quem está assistindo o painel', async () => {
    const { body: link } = await createLink({ url: 'https://example.com', alias: 'aovivo' });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const token = auth.Authorization.slice(7);

    try {
      const ctrl = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/api/links/${link.id}/live?token=${token}`, { signal: ctrl.signal });
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      const reader = res.body!.getReader();
      await reader.read(); // "retry: 3000"

      await fetch(`http://127.0.0.1:${port}/aovivo`, { redirect: 'manual', headers: { 'User-Agent': IPHONE } });

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('event: click');
      expect(JSON.parse(text.split('data: ')[1])).toMatchObject({ browser: 'Safari', os: 'iOS', device: 'mobile', referrer: 'direto' });
      ctrl.abort();
    } finally {
      server.close();
    }
  });

  it('exige token para assistir', async () => {
    const { body: link } = await createLink({ url: 'https://example.com' });
    expect((await request(app).get(`/api/links/${link.id}/live`)).status).toBe(401);
  });
});
