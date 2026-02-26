import type { AppConfig } from './config.js';
import { MemoryStore } from './memory-store.js';
import type { ContactRecord, EngagementEvent, SyncResult, TwentyWebhookPayload, VerticalPack } from './types.js';
import { createIdempotencyKey, extractContactFromTwentyWebhook, getString, nowIso } from './utils.js';
import { buildSubscriberAttribs } from './vertical.js';

export type ConnectorDeps = {
  config: AppConfig;
  store: MemoryStore;
  vertical: VerticalPack;
  twenty: {
    fetchPersonById(id: string): Promise<Record<string, unknown>>;
    writeEngagement(event: EngagementEvent): Promise<void>;
  };
  listmonk: {
    listLists(): Promise<Array<{ id: number; name: string }>>;
    ensureList(input: {
      name: string;
      type: 'private' | 'public';
      optin: 'single' | 'double';
      tags?: string[];
      description?: string;
    }): Promise<{ id: number; name: string }>;
    upsertSubscriber(input: {
      contact: ContactRecord;
      listId: number;
      attribs: Record<string, unknown>;
    }): Promise<{ subscriberId: number }>;
    createCampaign(input: {
      name: string;
      subject: string;
      listIds: number[];
      body: string;
      fromEmail?: string;
      tags?: string[];
    }): Promise<{ id: number; uuid?: string }>;
    sendCampaignTest(campaignId: number, subscribers: string[]): Promise<void>;
  };
};

export class ConnectorService {
  constructor(private readonly deps: ConnectorDeps) {}

  getRecentEvents(limit = 50) {
    return this.deps.store.listEvents(limit);
  }

  async bootstrapDefaultList(): Promise<{ id: number; name: string }> {
    const cached = this.deps.store.getState<{ id: number; name: string }>('listmonk.defaultList');
    if (cached) return cached;

    const list = await this.deps.listmonk.ensureList({
      name: this.deps.config.listmonk.defaultListName || this.deps.vertical.defaultList.name,
      type: this.deps.vertical.defaultList.type,
      optin: this.deps.vertical.defaultList.optin,
      tags: this.deps.vertical.defaultList.tags,
      description: this.deps.vertical.defaultList.description,
    });

    const state = { id: list.id, name: list.name };
    this.deps.store.setState('listmonk.defaultList', state);
    return state;
  }

  async listLists() {
    return this.deps.listmonk.listLists();
  }

  async syncLists(): Promise<Array<{ id: number; name: string }>> {
    const list = await this.bootstrapDefaultList();

    this.deps.store.addEvent({
      kind: 'sync',
      status: 'ok',
      message: `Ensured list ${list.name}`,
      detail: { listId: list.id, source: 'sync-lists' },
    });

    return [list];
  }

  async syncContact(contact: ContactRecord, source: string): Promise<SyncResult> {
    const list = await this.bootstrapDefaultList();

    const attribs = buildSubscriberAttribs(this.deps.vertical, contact);
    const result = await this.deps.listmonk.upsertSubscriber({ contact, listId: list.id, attribs });

    this.deps.store.addEvent({
      kind: 'sync',
      status: 'ok',
      message: `Synced ${contact.email} to list ${list.name}`,
      detail: {
        source,
        subscriberId: result.subscriberId,
        listId: list.id,
        personId: contact.crmId,
        email: contact.email,
      },
    });

    return {
      ok: true,
      subscriberId: result.subscriberId,
      listId: list.id,
      message: `Synced ${contact.email}`,
    };
  }

  async handleTwentyWebhook(payload: TwentyWebhookPayload): Promise<{ accepted: boolean; duplicate?: boolean; synced?: boolean; reason?: string }> {
    const key = createIdempotencyKey(payload);
    if (this.deps.store.hasSeen(key)) {
      return { accepted: true, duplicate: true, reason: 'duplicate webhook' };
    }
    this.deps.store.remember(key);

    const contact = extractContactFromTwentyWebhook(payload);
    if (!contact) {
      return { accepted: true, synced: false, reason: 'ignored (not a person.* event with email)' };
    }

    await this.syncContact(contact, 'twenty-webhook');
    return { accepted: true, synced: true };
  }

  async handleListmonkWebhook(payload: Record<string, unknown>): Promise<{ accepted: true }> {
    this.deps.store.addEvent({
      kind: 'engagement',
      status: 'ok',
      message: 'Received listmonk webhook payload',
      detail: { source: 'listmonk-webhook', payload },
    });
    return { accepted: true };
  }

  async syncPersonById(id: string): Promise<SyncResult> {
    const person = await this.deps.twenty.fetchPersonById(id);
    const email = getString(person.email) ?? getString(person.primaryEmail);
    if (!email) {
      throw new Error('Person record has no email');
    }
    const contact: ContactRecord = {
      crmId: getString(person.id) ?? id,
      email: email.toLowerCase(),
      firstName: getString(person.firstName) ?? undefined,
      lastName: getString(person.lastName) ?? undefined,
      fullName: [getString(person.firstName), getString(person.lastName)].filter(Boolean).join(' ') || undefined,
      raw: person,
    };
    return this.syncContact(contact, 'manual-person-sync');
  }

  async sendTestCampaign(input: {
    to: string;
    subject: string;
    bodyHtml?: string;
    personId?: string;
    campaignName?: string;
  }): Promise<{ campaignId: number; testRecipient: string }> {
    const list = await this.bootstrapDefaultList();

    const trackingBase = this.deps.config.publicTrackingBaseUrl;
    const openUrl = new URL('/track/open.gif', trackingBase);
    openUrl.searchParams.set('email', input.to);
    if (input.personId) openUrl.searchParams.set('personId', input.personId);

    const clickUrl = new URL('/track/click', trackingBase);
    clickUrl.searchParams.set('url', 'https://example.com');
    clickUrl.searchParams.set('email', input.to);
    if (input.personId) clickUrl.searchParams.set('personId', input.personId);

    const html = input.bodyHtml ?? `<p>Hello from CRM + listmonk connector.</p><p><a href="${clickUrl.toString()}">Tracked link</a></p><img src="${openUrl.toString()}" alt="" width="1" height="1" />`;

    const campaign = await this.deps.listmonk.createCampaign({
      name: input.campaignName ?? `Connector Test ${new Date().toISOString()}`,
      subject: input.subject,
      listIds: [list.id],
      body: html,
      tags: [...this.deps.vertical.defaultList.tags, 'connector-test'],
    });

    await this.deps.listmonk.sendCampaignTest(campaign.id, [input.to]);

    this.deps.store.addEvent({
      kind: 'campaign',
      status: 'ok',
      message: `Sent test campaign ${campaign.id} to ${input.to}`,
      detail: { campaignId: campaign.id, to: input.to, listId: list.id },
    });

    return { campaignId: campaign.id, testRecipient: input.to };
  }

  async recordEngagement(event: Omit<EngagementEvent, 'timestamp'> & { timestamp?: string }) {
    const full: EngagementEvent = { ...event, timestamp: event.timestamp ?? nowIso() };

    try {
      await this.deps.twenty.writeEngagement(full);
      this.deps.store.addEvent({
        kind: 'engagement',
        status: 'ok',
        message: `Recorded ${full.type} engagement${full.email ? ` for ${full.email}` : ''}`,
        detail: {
          type: full.type,
          personId: full.personId,
          email: full.email,
          campaignId: full.campaignId,
          targetUrl: full.targetUrl,
          source: full.source,
        },
      });
      return { ok: true };
    } catch (error) {
      this.deps.store.addEvent({
        kind: 'error',
        status: 'error',
        message: `Engagement writeback failed: ${error instanceof Error ? error.message : String(error)}`,
        detail: { type: full.type, personId: full.personId, email: full.email },
      });
      throw error;
    }
  }
}
