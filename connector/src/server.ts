import express from 'express';
import type { AppConfig } from './config.js';

export function createServer(config: AppConfig) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'connector', vertical: config.vertical });
  });

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Connector</title></head>
  <body>
    <h1>CRM + Mailer Connector</h1>
    <p>Status: OK</p>
    <p>Vertical: <strong>${config.vertical}</strong></p>
    <p>Phase 1 endpoints will be added in the next commit.</p>
    <ul>
      <li><a href="/healthz">/healthz</a></li>
    </ul>
  </body>
</html>`);
  });

  return app;
}
