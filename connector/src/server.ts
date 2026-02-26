import express from 'express';
import type { Request } from 'express';
import type { AppConfig } from './config.js';
import { ConnectorService } from './service.js';
import { renderSidecarUi } from './ui.js';
import { toTransparentGif, verifyTwentyWebhookSignature } from './utils.js';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: string;
  }
}

function getBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export function createServer(config: AppConfig, service: ConnectorService) {
  const app = express();
  const pixel = toTransparentGif();

  app.use(
    express.json({
      limit: '1mb',
      verify(req, _res, buf) {
        (req as Request).rawBody = buf.toString('utf8');
      },
    }),
  );

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'connector', vertical: config.vertical });
  });

  app.get('/', (_req, res) => {
    res.type('html').send(renderSidecarUi(config));
  });

  app.get('/events/recent', (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json({ data: service.getRecentEvents(Number.isFinite(limit) ? limit : 50) });
  });

  app.get('/lists', async (_req, res, next) => {
    try {
      res.json({ data: await service.listLists() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/twenty', async (req, res, next) => {
    try {
      const isValid = verifyTwentyWebhookSignature({
        secret: config.twentyWebhookSecret,
        rawBody: req.rawBody ?? JSON.stringify(req.body ?? {}),
        signatureHeader: req.header('X-Twenty-Webhook-Signature') ?? undefined,
        timestampHeader: req.header('X-Twenty-Webhook-Timestamp') ?? undefined,
      });

      if (!isValid) {
        res.status(401).json({ error: 'Invalid Twenty webhook signature' });
        return;
      }

      const result = await service.handleTwentyWebhook(req.body ?? {});
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/sync/contacts', async (req, res, next) => {
    try {
      const body = getBody(req);
      const contacts = Array.isArray(body.contacts) ? body.contacts : [];
      const results = [] as unknown[];
      for (const item of contacts) {
        const contact = item as { email?: string; crmId?: string; firstName?: string; lastName?: string; fullName?: string };
        if (!contact.email) continue;
        results.push(
          await service.syncContact(
            {
              crmId: contact.crmId,
              email: contact.email,
              firstName: contact.firstName,
              lastName: contact.lastName,
              fullName: contact.fullName,
              raw: item,
            },
            'manual-batch',
          ),
        );
      }
      res.json({ ok: true, count: results.length, data: results });
    } catch (error) {
      next(error);
    }
  });

  app.post('/sync/person/:id', async (req, res, next) => {
    try {
      const result = await service.syncPersonById(req.params.id);
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/campaigns/send-test', async (req, res, next) => {
    try {
      const body = getBody(req);
      const to = String(body.to ?? '').trim();
      const subject = String(body.subject ?? 'Connector test campaign').trim();
      if (!to) {
        res.status(400).json({ error: 'Missing `to` email' });
        return;
      }

      const result = await service.sendTestCampaign({
        to,
        subject,
        personId: typeof body.personId === 'string' ? body.personId : undefined,
        bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : undefined,
        campaignName: typeof body.campaignName === 'string' ? body.campaignName : undefined,
      });

      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.get('/track/open.gif', async (req, res, next) => {
    try {
      await service.recordEngagement({
        type: 'open',
        personId: typeof req.query.personId === 'string' ? req.query.personId : undefined,
        email: typeof req.query.email === 'string' ? req.query.email : undefined,
        campaignId: typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined,
        source: 'tracking-pixel',
      });
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.end(pixel);
    } catch (error) {
      next(error);
    }
  });

  app.get('/track/click', async (req, res, next) => {
    try {
      const targetUrl = typeof req.query.url === 'string' ? req.query.url : undefined;
      if (!targetUrl) {
        res.status(400).json({ error: 'Missing `url` query param' });
        return;
      }

      await service.recordEngagement({
        type: 'click',
        personId: typeof req.query.personId === 'string' ? req.query.personId : undefined,
        email: typeof req.query.email === 'string' ? req.query.email : undefined,
        campaignId: typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined,
        source: 'tracking-click',
        targetUrl,
      });

      res.redirect(302, targetUrl);
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/engagement', async (req, res, next) => {
    try {
      const body = getBody(req);
      const type = body.type === 'open' || body.type === 'click' ? body.type : 'manual';
      await service.recordEngagement({
        type,
        personId: typeof body.personId === 'string' ? body.personId : undefined,
        email: typeof body.email === 'string' ? body.email : undefined,
        campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
        targetUrl: typeof body.targetUrl === 'string' ? body.targetUrl : undefined,
        source: typeof body.source === 'string' ? body.source : 'manual-webhook',
        metadata: typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : undefined,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  });

  return app;
}
