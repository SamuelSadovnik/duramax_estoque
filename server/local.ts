// Servidor para rodar no computador da empresa (npm start / npm run dev)
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import app from './app';

const servidor = express();
servidor.disable('x-powered-by');
servidor.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
const dist = join(process.cwd(), 'dist');
servidor.use(app);
if (existsSync(dist)) {
  servidor.use(express.static(dist));
  servidor.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

const PORTA = Number(process.env.PORT ?? 3000);
servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`\n  Duramax · Estoque SAC rodando em http://localhost:${PORTA}`);
  console.log(`  Banco: ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'local (pasta data/)'}\n`);
});
