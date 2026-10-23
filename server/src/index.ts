import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const PORT = Number(process.env.API_PORT ?? 3335);
const DB_FILE = process.env.DB_FILE ?? 'data/encurta.db';
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;

if (DB_FILE !== ':memory:') mkdirSync(dirname(DB_FILE), { recursive: true });

const app = createApp(openDatabase(DB_FILE), { publicUrl: PUBLIC_URL });
app.listen(PORT, () => {
  console.log(`API e redirecionamentos em ${PUBLIC_URL}`);
});
