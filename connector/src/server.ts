import express from 'express';
import type { Request } from 'express';
import type { AppConfig } from './config.js';
import { registerHealthRoutes, registerSyncRoutes, registerWebhookRoutes } from './routes/index.js';
import { logger } from './logger.js';
import { ConnectorService } from './service.js';
import { renderPublicSite } from './publicSite.js';
import { renderSidecarUi } from './ui.js';
import { toTransparentGif } from './utils.js';
import { z } from 'zod';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: string;
  }
}

function getBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

const publicLeadSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  loanType: z.string().trim().optional(),
  message: z.string().trim().max(2000).optional(),
});

export function createServer(config: AppConfig, service: ConnectorService, publicSiteContent?: import('./types/index.js').WebsiteContent | null) {
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

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - started,
        },
        'http request',
      );
    });
    next();
  });

  registerHealthRoutes(app, config);
  registerSyncRoutes(app, service);
  registerWebhookRoutes(app, config, service);

  app.get('/', (_req, res) => {
    if (publicSiteContent) {
      res.type('html').send(renderPublicSite(publicSiteContent));
      return;
    }
    res.redirect(302, '/studio');
  });

  app.get('/studio', (_req, res) => {
    res.type('html').send(renderSidecarUi(config));
  });

  app.get('/studio/context/application/:applicationId', async (req, res, next) => {
    try {
      const data = await service.getStudioContextForApplication(req.params.applicationId);
      res.json({ ok: true, data, suggestedTemplateKey: service.recommendTemplateKey(data) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/studio/context/person/:personId', async (req, res, next) => {
    try {
      const data = await service.getStudioContextForPerson(req.params.personId);
      res.json({ ok: true, data, suggestedTemplateKey: service.recommendTemplateKey(data) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/studio/open/application/:applicationId', async (req, res, next) => {
    try {
      const context = await service.getStudioContextForApplication(req.params.applicationId);
      const templateKey = typeof req.query.template === 'string' ? req.query.template : undefined;
      res.redirect(302, service.buildStudioLaunchUrl(context, templateKey));
    } catch (error) {
      next(error);
    }
  });

  app.get('/studio/open/person/:personId', async (req, res, next) => {
    try {
      const context = await service.getStudioContextForPerson(req.params.personId);
      const templateKey = typeof req.query.template === 'string' ? req.query.template : undefined;
      res.redirect(302, service.buildStudioLaunchUrl(context, templateKey));
    } catch (error) {
      next(error);
    }
  });

  app.post('/public/leads', async (req, res, next) => {
    try {
      const lead = publicLeadSchema.parse(getBody(req));
      const result = await service.createPublicLead({
        ...lead,
        source: 'public-site',
      });
      res.status(201).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.get('/events/recent', (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    const parsedLimit = Number.isFinite(limit) ? limit : 50;
    const kind =
      req.query.kind === 'sync' || req.query.kind === 'engagement' || req.query.kind === 'campaign' || req.query.kind === 'error'
        ? req.query.kind
        : undefined;
    res.json({ data: kind ? service.getRecentEventsByKind(kind, parsedLimit) : service.getRecentEvents(parsedLimit) });
  });

  app.get('/studio/status', async (_req, res, next) => {
    try {
      res.json(await service.getStudioStatus());
    } catch (error) {
      next(error);
    }
  });

  app.get('/studio/dashboard', async (_req, res, next) => {
    try {
      res.json({ ok: true, data: await service.getStudioDashboard() });
    } catch (error) {
      next(error);
    }
  });

  app.get('/lists', async (_req, res, next) => {
    try {
      res.json({ data: await service.listLists() });
    } catch (error) {
      next(error);
    }
  });

  app.get('/templates/email', (_req, res) => {
    res.json({ data: service.listEmailTemplates() });
  });

  app.post('/templates/email/render', (req, res, next) => {
    try {
      const body = getBody(req);
      const templateKey = String(body.templateKey ?? '').trim();
      if (!templateKey) {
        res.status(400).json({ error: 'Missing `templateKey`' });
        return;
      }
      const context =
        typeof body.context === 'object' && body.context
          ? (body.context as Record<string, unknown>)
          : {};
      res.json({ ok: true, data: service.renderEmailTemplate({ templateKey, context }) });
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

  app.post('/campaigns/send-template', async (req, res, next) => {
    try {
      const body = getBody(req);
      const to = String(body.to ?? '').trim();
      const templateKey = String(body.templateKey ?? '').trim();
      if (!to || !templateKey) {
        res.status(400).json({ error: 'Missing `to` or `templateKey`' });
        return;
      }
      const context =
        typeof body.context === 'object' && body.context
          ? (body.context as Record<string, unknown>)
          : {};
      const result = await service.sendTemplateCampaign({
        templateKey,
        to,
        personId: typeof body.personId === 'string' ? body.personId : undefined,
        context,
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/campaigns/send-for-application', async (req, res, next) => {
    try {
      const body = getBody(req);
      const applicationId = String(body.applicationId ?? '').trim();
      if (!applicationId) {
        res.status(400).json({ error: 'Missing `applicationId`' });
        return;
      }
      const result = await service.sendTemplateForApplication({
        applicationId,
        templateKey: typeof body.templateKey === 'string' ? body.templateKey : undefined,
        to: typeof body.to === 'string' ? body.to : undefined,
        personId: typeof body.personId === 'string' ? body.personId : undefined,
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/workflows/docs-chase', async (req, res, next) => {
    try {
      const body = getBody(req);
      const applicationIds = Array.isArray(body.applicationIds) ? body.applicationIds.map(String) : undefined;
      const result = await service.runDocsChaseWorkflow({
        applicationIds,
        limit: typeof body.limit === 'number' ? body.limit : undefined,
        createTasks: typeof body.createTasks === 'boolean' ? body.createTasks : undefined,
        sendEmail: typeof body.sendEmail === 'boolean' ? body.sendEmail : undefined,
        dryRun: typeof body.dryRun === 'boolean' ? body.dryRun : undefined,
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/workflows/review-sweep', async (req, res, next) => {
    try {
      const body = getBody(req);
      const applicationIds = Array.isArray(body.applicationIds) ? body.applicationIds.map(String) : undefined;
      const result = await service.runReviewSweepWorkflow({
        applicationIds,
        limit: typeof body.limit === 'number' ? body.limit : undefined,
        createTasks: typeof body.createTasks === 'boolean' ? body.createTasks : undefined,
        sendEmail: typeof body.sendEmail === 'boolean' ? body.sendEmail : undefined,
        dryRun: typeof body.dryRun === 'boolean' ? body.dryRun : undefined,
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
        metadata:
          typeof req.query.applicationId === 'string'
            ? { applicationId: req.query.applicationId }
            : undefined,
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
        metadata:
          typeof req.query.applicationId === 'string'
            ? { applicationId: req.query.applicationId }
            : undefined,
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
    logger.error({ err: message }, 'request failed');
    res.status(500).json({ error: message });
  });

  return app;
}
