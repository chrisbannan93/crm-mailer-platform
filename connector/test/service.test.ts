import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '../src/memory-store.js';
import { ConnectorService } from '../src/service.js';
import type { AppConfig } from '../src/config.js';
import type { VerticalPack } from '../src/types.js';

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

const vertical: VerticalPack = {
  name: 'generic',
  version: 1,
  defaultList: { name: 'CRM Synced Contacts', type: 'private', optin: 'single', tags: ['crm'] },
  subscriberAttribs: { includeTwentyPersonId: true, static: { vertical: 'generic' } },
  notes: [],
};

describe('ConnectorService', () => {
  it('deduplicates twenty webhooks', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi.fn().mockResolvedValue({ id: 1, name: 'CRM Synced Contacts' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 10 }),
      createCampaign: vi.fn(),
      sendCampaignTest: vi.fn(),
    };

    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      twenty: { fetchPersonById: vi.fn(), writeEngagement: vi.fn() },
      listmonk,
    });

    const payload = {
      event: 'person.created',
      timestamp: '2025-02-10T15:30:50Z',
      data: { id: 'abc123', email: 'alice@example.com', firstName: 'Alice' },
    };

    const first = await service.handleTwentyWebhook(payload);
    const second = await service.handleTwentyWebhook(payload);

    expect(first.synced).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(listmonk.upsertSubscriber).toHaveBeenCalledTimes(1);
  });
});
