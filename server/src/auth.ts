import { Router, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { DB } from './db.js';
import { HttpError } from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-encurta-troque-em-producao';
const TOKEN_TTL = '7d';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
}

/** Provedores aceitos no cadastro: evita contas com domínios inventados (ex.: @nmdiosa.com). */
export const EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.com.br', 'hotmail.com', 'hotmail.com.br', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.com.br', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br',
  'aol.com', 'gmx.com', 'zoho.com',
];

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome precisa ter ao menos 2 letras').max(60),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail inválido')
    .refine((e) => EMAIL_DOMAINS.includes(e.split('@')[1]), 'Use um e-mail de um provedor comum (Gmail, Outlook, Hotmail, iCloud, Yahoo…)'),
  password: z
    .string()
    .min(10, 'A senha precisa ter ao menos 10 caracteres')
    .max(100, 'A senha pode ter no máximo 100 caracteres')
    .regex(/[a-z]/, 'A senha precisa de uma letra minúscula')
    .regex(/[A-Z]/, 'A senha precisa de uma letra maiúscula')
    .regex(/\d/, 'A senha precisa de um número')
    .regex(/[^A-Za-z0-9]/, 'A senha precisa de um símbolo (ex.: ! @ # $)'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const signToken = (userId: number) => jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: TOKEN_TTL });
const publicUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email });

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  // EventSource (SSE) não permite cabeçalhos, então o painel ao vivo manda o token na query.
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const token = header.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!token) throw new HttpError(401, 'Token ausente');
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    req.userId = Number(payload.sub);
    next();
  } catch {
    throw new HttpError(401, 'Token inválido ou expirado');
  }
};

export function authRouter(db: DB) {
  const router = Router();

  router.post('/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    // Mostra a regra que falhou (ex.: "A senha precisa de um número"), não só "Dados inválidos".
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const data = parsed.data;
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email);
    if (exists) throw new HttpError(409, 'E-mail já cadastrado');

    const hash = bcrypt.hashSync(data.password, 10);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(data.name, data.email, hash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid) as unknown as UserRow;

    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  });

  router.post('/login', (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email) as unknown as UserRow | undefined;
    if (!user || !bcrypt.compareSync(data.password, user.password_hash)) {
      throw new HttpError(401, 'E-mail ou senha incorretos');
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as unknown as UserRow | undefined;
    if (!user) throw new HttpError(401, 'Usuário não existe mais');
    res.json({ user: publicUser(user) });
  });

  return router;
}
