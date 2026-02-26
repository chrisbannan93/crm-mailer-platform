import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '../src/memory-store.js';
import { ConnectorService, mapTwentyContactToContactRecord } from '../src/service.js';
import type { AppConfig } from '../src/config.js';
import type { VerticalPack } from '../src/types.js';
import { buildSubscriberAttribs } from '../src/services/verticalLoader.js';

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
    sync: {
      maxContactsPerRun: 500,
      stateFile: './data/test-state.json',
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
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn(),
      sendCampaignTest: vi.fn(),
    };

    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      twenty: { listContacts: vi.fn(), fetchPersonById: vi.fn(), writeEngagement: vi.fn() },
      // @ts-expect-error partial mock for this test
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

  it('maps contacts and includes required attribs fields', () => {
    const mapped = mapTwentyContactToContactRecord({
      id: 'tw_1',
      email: 'Test@Example.com',
      firstName: 'Test',
      phoneNumber: '+61123',
      tags: ['vip', 'lead'],
      updatedAt: '2026-02-26T00:00:00Z',
    });

    expect(mapped).toMatchObject({
      crmId: 'tw_1',
      email: 'test@example.com',
      firstName: 'Test',
      phone: '+61123',
      tags: ['vip', 'lead'],
      updatedAt: '2026-02-26T00:00:00Z',
    });

    const attribs = buildSubscriberAttribs(vertical, mapped!);
    expect(attribs.twentyId).toBe('tw_1');
    expect(attribs.phone).toBe('+61123');
    expect(attribs.tags).toEqual(['vip', 'lead']);
  });

  it('bounded sync skips contacts without email and updates cursor state', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi.fn().mockResolvedValue({ id: 1, name: 'CRM Synced Contacts' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 10 }),
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn(),
      sendCampaignTest: vi.fn(),
    };
    const twenty = {
      listContacts: vi
        .fn()
        .mockResolvedValueOnce({
          contacts: [
            { id: '1', email: 'a@example.com', updatedAt: '2026-02-25T10:00:00Z' },
            { id: '2', firstName: 'NoEmail', updatedAt: '2026-02-25T11:00:00Z' },
          ],
          nextCursor: undefined,
        }),
      getContactByEmail: vi.fn(),
      fetchPersonById: vi.fn(),
      writeEngagement: vi.fn(),
    };

    const store = new MemoryStore();
    const service = new ConnectorService({
      config: makeConfig(),
      store,
      vertical,
      // @ts-expect-error partial mock shape is sufficient for test
      twenty,
      // @ts-expect-error partial mock shape is sufficient for test
      listmonk,
    });

    const result = await service.syncContactsFromTwenty({ maxContacts: 500 });
    expect(result.processed).toBe(1);
    expect(result.skippedNoEmail).toBe(1);
    expect(listmonk.upsertSubscriber).toHaveBeenCalledTimes(1);
    expect(store.getState('sync.contacts.cursor')).toMatchObject({
      updatedSince: '2026-02-25T10:00:00Z',
    });
  });

  it('syncs segment lists from vertical segment definitions', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi
        .fn()
        .mockResolvedValueOnce({ id: 1, name: 'CRM Synced Contacts' })
        .mockResolvedValueOnce({ id: 2, name: 'Customers' })
        .mockResolvedValueOnce({ id: 3, name: 'VIP' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 42 }),
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn(),
      sendCampaignTest: vi.fn(),
    };
    const twenty = {
      listContacts: vi.fn().mockResolvedValue({
        contacts: [
          { id: 'p1', email: 'a@example.com', tags: ['customer'] },
          { id: 'p2', email: 'b@example.com', tags: ['vip'] },
          { id: 'p3', email: 'c@example.com', tags: ['lead'] },
        ],
      }),
      getContactByEmail: vi.fn(),
      fetchPersonById: vi.fn(),
      writeEngagement: vi.fn(),
    };

    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      segments: [
        { key: 'customers', name: 'Customers', listName: 'Customers', rules: [{ field: 'tags', op: 'includes', value: 'customer' }] },
        { key: 'vip', name: 'VIP', listName: 'VIP', rules: [{ field: 'tags', op: 'includes', value: 'vip' }] },
      ],
      // @ts-expect-error partial mock shape is sufficient for test
      twenty,
      // @ts-expect-error partial mock shape is sufficient for test
      listmonk,
    });

    const lists = await service.syncLists();
    expect(lists.map((l) => l.name)).toEqual(['CRM Synced Contacts', 'Customers', 'VIP']);
    expect(listmonk.upsertSubscriber).toHaveBeenCalledTimes(2);
    expect(listmonk.addSubscriberToLists).toHaveBeenCalledWith(42, [2]);
    expect(listmonk.addSubscriberToLists).toHaveBeenCalledWith(42, [3]);
  });
});
