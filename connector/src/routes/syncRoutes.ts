import type { Express, Request } from 'express';
import { SyncService } from '../services/syncService.js';
import type { ConnectorService } from '../service.js';

function getBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export function registerSyncRoutes(app: Express, connectorService: ConnectorService): void {
  const syncService = new SyncService(connectorService);

  app.post('/sync/contacts', async (req, res, next) => {
    try {
      const body = getBody(req);
      const contacts = Array.isArray(body.contacts) ? body.contacts : [];
      const normalized = contacts
        .map((item) => item as { email?: string; crmId?: string; firstName?: string; lastName?: string; fullName?: string })
        .filter((c) => Boolean(c.email))
        .map((c) => ({
          crmId: c.crmId,
          email: c.email as string,
          firstName: c.firstName,
          lastName: c.lastName,
          fullName: c.fullName,
          raw: c,
        }));

      const results = await syncService.syncContacts(normalized);
      res.json({ ok: true, count: results.length, data: results });
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
