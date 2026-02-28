import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import type { AppConfig } from '../src/config.js';

function makeConfig(): AppConfig {
  return {
    port: 4010,
    nodeEnv: 'test',
    vertical: 'generic',
    listmonkWebhookHeader: 'X-Webhook-Token',
    listmonkWebhookDedupTtlSeconds: 3600,
    publicTrackingBaseUrl: 'http://localhost:4010',
    listmonk: { baseUrl: 'http://listmonk:9000' },
    twenty: {
      baseUrl: 'http://twenty:3000',
      graphqlPath: '/graphql',
      restPath: '/rest',
      writebackMode: 'log',
      engagementNoteEndpoint: '/rest/notes',
    },
    sync: {
      maxContactsPerRun: 500,
      stateFile: './data/test-state.json',
    },
  };
}

describe('server', () => {
  it('serves health endpoint', async () => {
    const service = {
      getRecentEvents: vi.fn().mockReturnValue([]),
      listEmailTemplates: vi.fn().mockReturnValue([]),
      renderEmailTemplate: vi.fn(),
      listLists: vi.fn().mockResolvedValue([]),
      handleTwentyWebhook: vi.fn(),
      syncContactsFromTwenty: vi.fn().mockResolvedValue({ ok: true, fetched: 0, processed: 0, skippedNoEmail: 0, maxReached: false }),
      syncPersonById: vi.fn(),
      sendTestCampaign: vi.fn(),
      sendTemplateCampaign: vi.fn(),
      recordEngagement: vi.fn(),
    } as any;

    const app = createServer(makeConfig(), service);
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects listmonk webhook when shared header token is invalid', async () => {
    const service = {
      getRecentEvents: vi.fn().mockReturnValue([]),
      listEmailTemplates: vi.fn().mockReturnValue([]),
      renderEmailTemplate: vi.fn(),
      listLists: vi.fn().mockResolvedValue([]),
      handleTwentyWebhook: vi.fn(),
      handleListmonkWebhook: vi.fn(),
      syncContactsFromTwenty: vi.fn().mockResolvedValue({ ok: true, fetched: 0, processed: 0, skippedNoEmail: 0, maxReached: false }),
      syncPersonById: vi.fn(),
      sendTestCampaign: vi.fn(),
      sendTemplateCampaign: vi.fn(),
      recordEngagement: vi.fn(),
    } as any;

    const config = { ...makeConfig(), listmonkWebhookSecret: 'secret123' };
    const app = createServer(config, service);
    const res = await request(app).post('/webhooks/listmonk').send({ event: 'email.open', email: 'a@example.com' });

    expect(res.status).toBe(401);
    expect(service.handleListmonkWebhook).not.toHaveBeenCalled();
  });
});
