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

  it('maps Twenty REST people shape with nested emails and name fields', () => {
    const mapped = mapTwentyContactToContactRecord({
      id: 'tw_2',
      name: {
        firstName: 'Proof',
        lastName: 'One',
      },
      emails: {
        primaryEmail: 'ChrisBannan93@gmail.com',
        additionalEmails: [],
      },
      phones: {
        primaryPhoneNumber: '0400000000',
      },
      updatedAt: '2026-02-28T07:17:07.329Z',
    });

    expect(mapped).toMatchObject({
      crmId: 'tw_2',
      email: 'chrisbannan93@gmail.com',
      firstName: 'Proof',
      lastName: 'One',
      fullName: 'Proof One',
      phone: '0400000000',
      updatedAt: '2026-02-28T07:17:07.329Z',
    });
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

  it('preserves multiple segment memberships for one subscriber during list sync', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi
        .fn()
        .mockResolvedValueOnce({ id: 1, name: 'CRM Synced Contacts' })
        .mockResolvedValueOnce({ id: 2, name: 'Retail' })
        .mockResolvedValueOnce({ id: 3, name: 'Docs Pending' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 42 }),
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn(),
      sendCampaignTest: vi.fn(),
    };
    const twenty = {
      listContacts: vi.fn().mockResolvedValue({
        contacts: [{ id: 'p1', email: 'a@example.com', firstName: 'Ava' }],
      }),
      listMortgageSegmentProfilesByEmail: vi
        .fn()
        .mockResolvedValue(new Map([['a@example.com', { segmentKeys: ['retail_home_loans', 'docs_pending'] }]])),
      getContactByEmail: vi.fn(),
      fetchPersonById: vi.fn(),
      writeEngagement: vi.fn(),
    };

    const service = new ConnectorService({
      config: { ...makeConfig(), vertical: 'mortgage_au' },
      store: new MemoryStore(),
      vertical: { ...vertical, name: 'mortgage_au' },
      segments: [
        {
          key: 'retail_home_loans',
          name: 'Retail',
          listName: 'Retail',
          rules: [{ field: 'segmentKeys', op: 'includes', value: 'retail_home_loans' }],
        },
        {
          key: 'docs_pending',
          name: 'Docs Pending',
          listName: 'Docs Pending',
          rules: [{ field: 'segmentKeys', op: 'includes', value: 'docs_pending' }],
        },
      ],
      // @ts-expect-error partial mock shape is sufficient for test
      twenty,
      // @ts-expect-error partial mock shape is sufficient for test
      listmonk,
    });

    await service.syncLists();

    expect(listmonk.upsertSubscriber).toHaveBeenCalledTimes(1);
    expect(listmonk.addSubscriberToLists).toHaveBeenCalledTimes(1);
    expect(listmonk.addSubscriberToLists).toHaveBeenCalledWith(42, [2, 3]);
  });

  it('validates and deduplicates listmonk webhook events before writing to Twenty', async () => {
    const twenty = {
      listContacts: vi.fn(),
      getContactByEmail: vi.fn().mockResolvedValue({ id: 'person_1' }),
      fetchPersonById: vi.fn(),
      writeEngagement: vi.fn().mockResolvedValue(undefined),
    };
    const listmonk = {
      listLists: vi.fn(),
      ensureList: vi.fn(),
      upsertSubscriber: vi.fn(),
      findSubscriberByEmail: vi.fn(),
      addSubscriberToLists: vi.fn(),
      removeSubscriberFromLists: vi.fn(),
      createCampaign: vi.fn(),
      sendCampaignTest: vi.fn(),
    };
    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      // @ts-expect-error partial mock shape is sufficient for test
      twenty,
      // @ts-expect-error partial mock shape is sufficient for test
      listmonk,
    });

    const payload = {
      event: 'email.click',
      timestamp: '2026-02-26T10:00:00Z',
      email: 'lead@example.com',
      campaign_id: 123,
      url: 'https://example.com/offer',
      reason: 'test',
    };

    const first = await service.handleListmonkWebhook(payload);
    const second = await service.handleListmonkWebhook(payload);
    const invalid = await service.handleListmonkWebhook({ hello: 'world' });

    expect(first.accepted).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(invalid.ignored).toBe(true);
    expect(twenty.getContactByEmail).toHaveBeenCalledWith('lead@example.com');
    expect(twenty.writeEngagement).toHaveBeenCalledTimes(1);
    expect(twenty.writeEngagement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'click',
        crmActivityType: 'EMAIL_CLICK',
        personId: 'person_1',
        email: 'lead@example.com',
        campaignId: '123',
        targetUrl: 'https://example.com/offer',
      }),
    );
  });

  it('uses a safe bounded campaign name for test sends', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi.fn().mockResolvedValue({ id: 1, name: 'CRM Synced Contacts' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 10 }),
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn().mockResolvedValue({ id: 77 }),
      sendCampaignTest: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      twenty: { listContacts: vi.fn(), fetchPersonById: vi.fn(), writeEngagement: vi.fn() },
      // @ts-expect-error partial mock for this test
      listmonk,
    });

    await service.sendTestCampaign({
      to: 'proof@example.com',
      subject: 'Connector proof',
      campaignName: 'Connector Test 2026-02-28T06:55:38.742Z',
    });

    expect(listmonk.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Connector Test 2026-02-28T065538742Z',
      }),
    );
    expect(listmonk.sendCampaignTest).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        subscribers: ['proof@example.com'],
        name: 'Connector Test 2026-02-28T065538742Z',
        subject: 'Connector proof',
        listIds: [1],
      }),
    );
  });

  it('renders and sends a vertical email template with application metadata', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi.fn().mockResolvedValue({ id: 1, name: 'CRM Synced Contacts' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 10 }),
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn().mockResolvedValue({ id: 88 }),
      sendCampaignTest: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      emailTemplates: [
        {
          key: 'retail_documents_request',
          name: 'Retail documents request',
          subject: 'Docs needed for {{application.applicationId}}',
          bodyHtml: '<p>Hello {{contact.firstName}}</p>',
        },
      ],
      twenty: { listContacts: vi.fn(), fetchPersonById: vi.fn(), writeEngagement: vi.fn() },
      // @ts-expect-error partial mock for this test
      listmonk,
    });

    const preview = service.renderEmailTemplate({
      templateKey: 'retail_documents_request',
      context: {
        contact: { firstName: 'Chris' },
        application: { applicationId: 'APP-123', applicationType: 'retail_home_loan', pipelineStage: 'docs_requested' },
      },
    });

    expect(preview.subject).toBe('Docs needed for APP-123');

    const sent = await service.sendTemplateCampaign({
      templateKey: 'retail_documents_request',
      to: 'proof@example.com',
      personId: 'person_1',
      context: {
        contact: { firstName: 'Chris' },
        application: { applicationId: 'APP-123', applicationType: 'retail_home_loan', pipelineStage: 'docs_requested' },
      },
    });

    expect(sent.templateKey).toBe('retail_documents_request');
    expect(listmonk.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Retail documents request',
        subject: 'Docs needed for APP-123',
      }),
    );
    expect(listmonk.sendCampaignTest).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        subscribers: ['proof@example.com'],
      }),
    );
  });
});
