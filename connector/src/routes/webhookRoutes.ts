import type { Express, Request } from 'express';
import type { AppConfig } from '../config/index.js';
import { WebhookService } from '../services/webhookService.js';
import type { ConnectorService } from '../service.js';
import { verifyTwentyWebhookSignature } from '../utils.js';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: string;
  }
}

export function registerWebhookRoutes(app: Express, config: AppConfig, connectorService: ConnectorService): void {
  const webhookService = new WebhookService(connectorService);

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

      const result = await webhookService.handleTwentyWebhook(req.body ?? {});
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/listmonk', async (req: Request, res, next) => {
    try {
      const result = await webhookService.handleListmonkWebhook((req.body ?? {}) as Record<string, unknown>);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });
}
