import type { Express, Request } from 'express';
import { SyncService } from '../services/syncService.js';
import type { ConnectorService } from '../service.js';

function getBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

function parseMax(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.floor(n), 500);
}

export function registerSyncRoutes(app: Express, connectorService: ConnectorService): void {
  const syncService = new SyncService(connectorService);

  app.post('/sync/contacts', async (req, res, next) => {
    try {
      const body = getBody(req);
      const max = parseMax(req.query.max) ?? parseMax(body.max);
      const result = await syncService.syncContactsFromTwenty(max);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/sync/lists', async (_req, res, next) => {
    try {
      const result = await syncService.syncLists();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
