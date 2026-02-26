import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import type { AppConfig } from '../src/config.js';

function makeConfig(): AppConfig {
  return {
    port: 4010,
    nodeEnv: 'test',
    vertical: 'generic',
    publicTrackingBaseUrl: 'http://localhost:4010',
    listmonk: { baseUrl: 'http://listmonk:9000' },
    twenty: {
      baseUrl: 'http://twenty:3000',
      graphqlPath: '/graphql',
      restPath: '/rest',
      writebackMode: 'log',
      engagementNoteEndpoint: '/rest/notes',
    },
  };
}

describe('server', () => {
  it('serves health endpoint', async () => {
    const service = {
      getRecentEvents: vi.fn().mockReturnValue([]),
      listLists: vi.fn().mockResolvedValue([]),
      handleTwentyWebhook: vi.fn(),
      syncPersonById: vi.fn(),
      sendTestCampaign: vi.fn(),
      recordEngagement: vi.fn(),
    } as any;

    const app = createServer(makeConfig(), service);
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
