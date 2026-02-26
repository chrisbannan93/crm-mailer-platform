import type { Express } from 'express';
import type { AppConfig } from '../config/index.js';

export function registerHealthRoutes(app: Express, config: AppConfig): void {
  const handler = (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ ok: true, service: 'connector', vertical: config.vertical });
  };

  app.get('/health', handler as never);
  app.get('/healthz', handler as never);
}
