import express from 'express';
import cors from 'cors';
import type { DB } from './db.js';
import { authRouter } from './auth.js';
import { linksRouter } from './links.js';
import { redirectRouter } from './redirect.js';
import { errorHandler } from './errors.js';

export function createApp(db: DB, { publicUrl }: { publicUrl: string }) {
  const app = express();
  app.set('trust proxy', 'loopback'); // req.ip correto atrás do proxy do Vite em desenvolvimento
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter(db));
  app.use('/api', linksRouter(db, publicUrl));
  app.use(redirectRouter(db));

  app.use(errorHandler);
  return app;
}
