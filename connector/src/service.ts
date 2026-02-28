import type { AppConfig } from './config.js';
import { z } from 'zod';
import { MemoryStore } from './memory-store.js';
import type {
  ContactRecord,
  ContactsSyncCursor,
  ContactsSyncRunResult,
  EngagementEvent,
  SegmentDefinition,
  SyncResult,
  TwentyWebhookPayload,
  VerticalPack,
} from './types.js';
import { createIdempotencyKey, extractContactFromTwentyWebhook, getString, nowIso, sha256Hex } from './utils.js';
import { buildSubscriberAttribs } from './vertical.js';

function buildSafeCampaignName(input?: string): string {
  const fallback = `CRM Test ${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const raw = (input ?? fallback).trim();
  const normalized = raw.replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const candidate = (normalized || fallback).slice(0, 48).trim();
  return candidate.length >= 3 ? candidate : fallback;
}

export type ConnectorDeps = {
  config: AppConfig;
  store: MemoryStore;
  vertical: VerticalPack;
  segments?: SegmentDefinition[];
  twenty: {
    listContacts(updatedSince?: string, pageCursor?: string): Promise<{ contacts: Array<Record<string, unknown>>; nextCursor?: string }>;
    getContactByEmail?(email: string): Promise<Record<string, unknown> | null>;
    fetchPersonById(id: string): Promise<Record<string, unknown>>;
    writeEngagement(event: EngagementEvent): Promise<void>;
  };
  listmonk: {
    health?(): Promise<unknown>;
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
    findSubscriberByEmail(email: string): Promise<{ id: number; email: string } | null>;
    addSubscriberToLists(subscriberId: number, listIds: number[], status?: 'confirmed' | 'unconfirmed'): Promise<void>;
    removeSubscriberFromLists(subscriberId: number, listIds: number[]): Promise<void>;
    createCampaign(input: {
      name: string;
      subject: string;
      listIds: number[];
      body: string;
      fromEmail?: string;
      tags?: string[];
    }): Promise<{ id: number; uuid?: string }>;
    sendCampaignTest(
      campaignId: number,
      input: {
        subscribers: string[];
        name: string;
        subject: string;
        listIds: number[];
        body: string;
        fromEmail?: string;
        tags?: string[];
      },
    ): Promise<void>;
  };
  logger?: {
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown>, msg?: string): void;
  };
};

export class ConnectorService {
  private contactsSyncInProgress = false;

  constructor(private readonly deps: ConnectorDeps) {}

  getRecentEvents(limit = 50) {
    return this.deps.store.listEvents(limit);
  }

  getRecentEventsByKind(kind: 'sync' | 'engagement' | 'campaign' | 'error', limit = 50) {
    return this.deps.store
      .listEvents(limit * 3)
      .filter((event) => event.kind === kind)
      .slice(0, limit);
  }

  async getStudioStatus(): Promise<{
    connector: { ok: true; vertical: string };
    services: {
      twenty: { ok: boolean; detail?: string };
      listmonk: { ok: boolean; detail?: string };
    };
    lastSync: {
      contactsAt?: string;
      listsAt?: string;
    };
    urls: {
      twenty: string;
      listmonk: string;
      connector: string;
    };
  }> {
    const contactsAt = this.deps.store.getState<string>('sync.contacts.lastRunAt');
    const listsAt = this.deps.store.getState<string>('sync.lists.lastRunAt');
    let twentyOk = false;
    let twentyDetail: string | undefined;
    let listmonkOk = false;
    let listmonkDetail: string | undefined;

    try {
      await this.deps.twenty.listContacts(undefined, undefined);
      twentyOk = true;
    } catch (error) {
      twentyDetail = error instanceof Error ? error.message : String(error);
    }

    try {
      if (typeof this.deps.listmonk.health === 'function') {
        await this.deps.listmonk.health();
      } else {
        await this.deps.listmonk.listLists();
      }
      listmonkOk = true;
    } catch (error) {
      listmonkDetail = error instanceof Error ? error.message : String(error);
    }

    return {
      connector: { ok: true, vertical: this.deps.vertical.name },
      services: {
        twenty: { ok: twentyOk, detail: twentyDetail },
        listmonk: { ok: listmonkOk, detail: listmonkDetail },
      },
      lastSync: { contactsAt: contactsAt ?? undefined, listsAt: listsAt ?? undefined },
      urls: {
        twenty: this.deps.config.twenty.baseUrl,
        listmonk: this.deps.config.listmonk.baseUrl,
        connector: this.deps.config.publicTrackingBaseUrl,
      },
    };
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
    const defaultList = await this.bootstrapDefaultList();
    const segments = this.deps.segments ?? [];
    if (segments.length === 0) {
      this.deps.store.addEvent({
        kind: 'sync',
        status: 'ok',
        message: `No segments configured; ensured default list ${defaultList.name}`,
        detail: { listId: defaultList.id, source: 'sync-lists' },
      });
      this.deps.store.setState('sync.contacts.lastRunAt', nowIso());
      return [defaultList];
    }

    const segmentLists = await Promise.all(
      segments.map(async (segment) => ({
        segment,
        list: await this.deps.listmonk.ensureList({
          name: segment.listName,
          type: segment.list?.type ?? this.deps.vertical.defaultList.type,
          optin: segment.list?.optin ?? this.deps.vertical.defaultList.optin,
          tags: segment.list?.tags ?? [...this.deps.vertical.defaultList.tags, `segment:${segment.key}`],
          description: segment.list?.description ?? segment.description ?? `Segment sync for ${segment.name}`,
        }),
      })),
    );

    const desiredBySegment = new Map<string, Map<string, { contact: ContactRecord; subscriberId?: number }>>();
    for (const entry of segmentLists) {
      desiredBySegment.set(entry.segment.key, new Map());
    }

    let cursor: string | undefined;
    let fetched = 0;
    let considered = 0;
    let skippedNoEmail = 0;

    do {
      const page = await this.deps.twenty.listContacts(undefined, cursor);
      const pageContacts = page.contacts ?? [];
      fetched += pageContacts.length;

      for (const rawContact of pageContacts) {
        const contact = mapTwentyContactToContactRecord(rawContact);
        if (!contact) {
          skippedNoEmail += 1;
          continue;
        }
        considered += 1;
        for (const entry of segmentLists) {
          if (matchesSegment(entry.segment, contact)) {
            desiredBySegment.get(entry.segment.key)!.set(contact.email, { contact });
          }
        }
      }

      cursor = page.nextCursor;
    } while (cursor);

    const snapshotKey = `sync.lists.membershipSnapshot.${this.deps.vertical.name}`;
    const previousSnapshot =
      this.deps.store.getState<Record<string, Record<string, { subscriberId?: number }>>>(snapshotKey) ?? {};
    const nextSnapshot: Record<string, Record<string, { subscriberId?: number }>> = {};
    const listResults: Array<{ id: number; name: string }> = [defaultList, ...segmentLists.map((entry) => entry.list)];
    let adds = 0;
    let removes = 0;

    for (const entry of segmentLists) {
      const segmentKey = entry.segment.key;
      const desiredMap = desiredBySegment.get(segmentKey) ?? new Map();
      const previousMap = previousSnapshot[segmentKey] ?? {};
      nextSnapshot[segmentKey] = {};

      for (const [email, desired] of desiredMap.entries()) {
        const attribs = buildSubscriberAttribs(this.deps.vertical, desired.contact);
        const upsert = await this.deps.listmonk.upsertSubscriber({
          contact: desired.contact,
          listId: defaultList.id,
          attribs,
        });
        await this.deps.listmonk.addSubscriberToLists(upsert.subscriberId, [entry.list.id]);
        nextSnapshot[segmentKey][email] = { subscriberId: upsert.subscriberId };
        if (!(email in previousMap)) adds += 1;
      }

      for (const [email, previous] of Object.entries(previousMap)) {
        if (desiredMap.has(email)) continue;
        let subscriberId = previous.subscriberId;
        if (!subscriberId) {
          const found = await this.deps.listmonk.findSubscriberByEmail(email);
          subscriberId = found?.id;
        }
        if (subscriberId) {
          await this.deps.listmonk.removeSubscriberFromLists(subscriberId, [entry.list.id]);
          removes += 1;
        }
      }
    }

    this.deps.store.setState(snapshotKey, nextSnapshot);
    this.deps.store.setState('sync.lists.lastRunAt', nowIso());
    this.deps.store.addEvent({
      kind: 'sync',
      status: 'ok',
      message: `Segment list sync complete (${segmentLists.length} segments)`,
      detail: { fetched, considered, skippedNoEmail, adds, removes, segments: segmentLists.map((s) => s.segment.key) },
    });
    this.deps.logger?.info(
      { fetched, considered, skippedNoEmail, adds, removes, segments: segmentLists.map((s) => s.segment.key) },
      'segment list sync completed',
    );

    return listResults;
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

  async syncContactsFromTwenty(options?: { maxContacts?: number }): Promise<ContactsSyncRunResult> {
    if (this.contactsSyncInProgress) {
      throw new Error('contacts sync already in progress');
    }
    this.contactsSyncInProgress = true;

    const maxContacts = Math.min(Math.max(options?.maxContacts ?? this.deps.config.sync.maxContactsPerRun, 1), 500);
    const cursorState = this.deps.store.getState<ContactsSyncCursor>('sync.contacts.cursor') ?? {};
    let pageCursor = cursorState.pageCursor;
    const updatedSince = cursorState.updatedSince;

    let fetched = 0;
    let processed = 0;
    let skippedNoEmail = 0;
    let maxSeenUpdatedAt = updatedSince;
    let maxReached = false;

    this.deps.logger?.info({ maxContacts, cursorState }, 'starting contacts sync');

    try {
      while (fetched < maxContacts) {
        const requestCursor = pageCursor;
        const page = await this.deps.twenty.listContacts(updatedSince, requestCursor);
        const contacts = page.contacts ?? [];
        if (contacts.length === 0) {
          pageCursor = undefined;
          break;
        }

        const remaining = maxContacts - fetched;
        const truncated = contacts.length > remaining;
        const batch = truncated ? contacts.slice(0, remaining) : contacts;

        fetched += batch.length;
        for (const rawContact of batch) {
          const mapped = mapTwentyContactToContactRecord(rawContact);
          if (!mapped) {
            skippedNoEmail += 1;
            continue;
          }
          await this.syncContact(mapped, 'twenty-poll-sync');
          processed += 1;
          if (mapped.updatedAt && (!maxSeenUpdatedAt || new Date(mapped.updatedAt) > new Date(maxSeenUpdatedAt))) {
            maxSeenUpdatedAt = mapped.updatedAt;
          }
        }

        if (truncated) {
          // Re-run the same page cursor next time. Upserts are idempotent.
          pageCursor = requestCursor;
          maxReached = true;
          break;
        }

        if (page.nextCursor && fetched < maxContacts) {
          pageCursor = page.nextCursor;
          continue;
        }

        if (page.nextCursor && fetched >= maxContacts) {
          pageCursor = page.nextCursor;
          maxReached = true;
        } else {
          pageCursor = undefined;
        }
        break;
      }

      const nextState: ContactsSyncCursor = maxReached
        ? { updatedSince, pageCursor }
        : { updatedSince: maxSeenUpdatedAt ?? nowIso(), pageCursor: undefined };
      this.deps.store.setState('sync.contacts.cursor', nextState);

      this.deps.store.addEvent({
        kind: 'sync',
        status: 'ok',
        message: `Twenty contacts sync finished (processed=${processed}, skippedNoEmail=${skippedNoEmail})`,
        detail: { fetched, processed, skippedNoEmail, nextState, maxReached },
      });

      this.deps.logger?.info({ fetched, processed, skippedNoEmail, nextState, maxReached }, 'contacts sync completed');

      return {
        ok: true,
        fetched,
        processed,
        skippedNoEmail,
        nextCursor: nextState.pageCursor,
        updatedSince: nextState.updatedSince,
        maxReached,
      };
    } catch (error) {
      this.deps.logger?.error(
        { err: error instanceof Error ? error.message : String(error), fetched, processed, skippedNoEmail, updatedSince, pageCursor },
        'contacts sync failed',
      );
      throw error;
    } finally {
      this.contactsSyncInProgress = false;
    }
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

  async handleListmonkWebhook(
    payload: Record<string, unknown>,
  ): Promise<{ accepted: true; ignored?: boolean; duplicate?: boolean; reason?: string }> {
    const normalized = parseListmonkWebhookPayload(payload);
    if (!normalized) {
      return { accepted: true, ignored: true, reason: 'unsupported webhook payload' };
    }

    const dedupKey = sha256Hex(
      [
        normalized.eventType,
        normalized.timestamp,
        normalized.email ?? '',
        normalized.twentyId ?? '',
        normalized.campaignId ?? '',
        normalized.url ?? '',
        normalized.reason ?? '',
      ].join('|'),
    );
    const ttlMs = this.deps.config.listmonkWebhookDedupTtlSeconds * 1000;
    if (this.deps.store.hasRecentKey(dedupKey)) {
      return { accepted: true, duplicate: true, reason: 'duplicate listmonk webhook event' };
    }
    this.deps.store.rememberKeyWithTtl(dedupKey, ttlMs);

    let personId = normalized.twentyId;
    if (!personId && normalized.email && this.deps.twenty.getContactByEmail) {
      const contact = await this.deps.twenty.getContactByEmail(normalized.email);
      personId = getString(contact?.id) ?? undefined;
    }

    const mapped = mapListmonkEventToEngagement(normalized);
    await this.recordEngagement({
      type: mapped.type,
      crmActivityType: mapped.crmActivityType,
      timestamp: normalized.timestamp,
      personId: personId ?? undefined,
      email: normalized.email ?? undefined,
      campaignId: normalized.campaignId ?? undefined,
      campaignName: normalized.campaignName ?? undefined,
      targetUrl: normalized.url ?? undefined,
      source: 'listmonk-webhook',
      metadata: {
        reason: normalized.reason,
        rawEventType: normalized.eventType,
        campaignName: normalized.campaignName,
      },
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

    const campaignName = buildSafeCampaignName(input.campaignName);

    const campaign = await this.deps.listmonk.createCampaign({
      name: campaignName,
      subject: input.subject,
      listIds: [list.id],
      body: html,
      tags: [...this.deps.vertical.defaultList.tags, 'connector-test'],
    });

    await this.deps.listmonk.sendCampaignTest(campaign.id, {
      subscribers: [input.to],
      name: campaignName,
      subject: input.subject,
      listIds: [list.id],
      body: html,
      tags: [...this.deps.vertical.defaultList.tags, 'connector-test'],
    });

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
          campaignName: full.campaignName,
          targetUrl: full.targetUrl,
          crmActivityType: full.crmActivityType,
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

const listmonkWebhookEventSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  eventType: z.string().optional(),
  timestamp: z.string().optional(),
  ts: z.string().optional(),
  campaign: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string().optional(),
    })
    .partial()
    .optional(),
  campaign_id: z.union([z.string(), z.number()]).optional(),
  campaignId: z.union([z.string(), z.number()]).optional(),
  campaign_name: z.string().optional(),
  campaignName: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  reason: z.string().optional(),
  subscriber: z
    .object({
      email: z.string().optional(),
      attribs: z.record(z.unknown()).optional(),
    })
    .partial()
    .optional(),
  email: z.string().optional(),
  attribs: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
});

type NormalizedListmonkWebhook = {
  eventType: string;
  timestamp: string;
  email?: string;
  twentyId?: string;
  campaignId?: string;
  campaignName?: string;
  url?: string;
  reason?: string;
};

function parseListmonkWebhookPayload(payload: Record<string, unknown>): NormalizedListmonkWebhook | null {
  const parsed = listmonkWebhookEventSchema.safeParse(payload);
  if (!parsed.success) return null;

  const p = parsed.data;
  const data = (p.data ?? {}) as Record<string, unknown>;
  const eventType = normalizeListmonkEventType(
    getString(p.event) ??
      getString(p.type) ??
      getString(p.eventType) ??
      getString(data.event) ??
      getString(data.type) ??
      '',
  );
  if (!eventType) return null;

  const subscriberAttribs =
    (p.subscriber?.attribs as Record<string, unknown> | undefined) ??
    (p.attribs as Record<string, unknown> | undefined) ??
    ((data.subscriber as Record<string, unknown> | undefined)?.attribs as Record<string, unknown> | undefined) ??
    (data.attribs as Record<string, unknown> | undefined);
  const subscriber =
    (p.subscriber as Record<string, unknown> | undefined) ??
    ((data.subscriber as Record<string, unknown> | undefined) ?? undefined);

  const email =
    getString(p.email) ??
    getString(subscriber?.email) ??
    getString(data.email) ??
    getString((data.subscriber as Record<string, unknown> | undefined)?.email);

  const twentyId =
    getString(subscriberAttribs?.twentyId) ??
    getString(subscriberAttribs?.twentyPersonId) ??
    getString(data.twentyId) ??
    getString(data.personId);

  const campaignIdValue =
    p.campaign?.id ?? p.campaignId ?? p.campaign_id ?? data.campaignId ?? data.campaign_id ?? (data.campaign as Record<string, unknown> | undefined)?.id;
  const campaignId = campaignIdValue !== undefined && campaignIdValue !== null ? String(campaignIdValue) : undefined;

  const campaignName =
    getString(p.campaign?.name) ??
    getString(p.campaignName) ??
    getString(p.campaign_name) ??
    getString((data.campaign as Record<string, unknown> | undefined)?.name) ??
    getString(data.campaignName);

  const url = getString(p.url) ?? getString(p.link) ?? getString(data.url) ?? getString(data.link);
  const reason = getString(p.reason) ?? getString(data.reason);
  const timestamp = getString(p.timestamp) ?? getString(p.ts) ?? getString(data.timestamp) ?? nowIso();

  return {
    eventType,
    timestamp,
    email: email?.toLowerCase(),
    twentyId: twentyId ?? undefined,
    campaignId,
    campaignName: campaignName ?? undefined,
    url: url ?? undefined,
    reason: reason ?? undefined,
  };
}

function normalizeListmonkEventType(raw: string): 'open' | 'click' | 'bounce' | 'unsubscribe' | null {
  const value = raw.toLowerCase();
  if (value.includes('open')) return 'open';
  if (value.includes('click')) return 'click';
  if (value.includes('bounce')) return 'bounce';
  if (value.includes('unsub')) return 'unsubscribe';
  return null;
}

function mapListmonkEventToEngagement(input: NormalizedListmonkWebhook): {
  type: EngagementEvent['type'];
  crmActivityType: NonNullable<EngagementEvent['crmActivityType']>;
} {
  if (input.eventType === 'open') return { type: 'open', crmActivityType: 'EMAIL_OPEN' };
  if (input.eventType === 'click') return { type: 'click', crmActivityType: 'EMAIL_CLICK' };
  if (input.eventType === 'bounce') return { type: 'bounce', crmActivityType: 'EMAIL_BOUNCE' };
  return { type: 'unsubscribe', crmActivityType: 'EMAIL_UNSUB' };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      const items = value
        .map((entry) => {
          if (typeof entry === 'string') return entry.trim();
          if (entry && typeof entry === 'object') {
            const rec = entry as Record<string, unknown>;
            return getString(rec.name) ?? getString(rec.label) ?? getString(rec.value) ?? '';
          }
          return '';
        })
        .filter(Boolean);
      if (items.length > 0) return Array.from(new Set(items));
    }
    if (typeof value === 'string' && value.trim()) {
      return Array.from(
        new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      );
    }
  }
  return [];
}

export function mapTwentyContactToContactRecord(raw: Record<string, unknown>): ContactRecord | null {
  const email = pickString(raw, ['email', 'primaryEmail']);
  if (!email) return null;

  const firstName = pickString(raw, ['firstName']);
  const lastName = pickString(raw, ['lastName']);
  const fullName =
    pickString(raw, ['name', 'fullName']) ?? ([firstName, lastName].filter(Boolean).join(' ').trim() || undefined);

  return {
    crmId: pickString(raw, ['id']),
    email: email.toLowerCase(),
    firstName,
    lastName,
    fullName,
    phone: pickString(raw, ['phone', 'phoneNumber', 'mobilePhone']),
    tags: pickStringArray(raw, ['tags', 'tagNames', 'labels']),
    updatedAt: pickString(raw, ['updatedAt']),
    raw,
  };
}

function matchesSegment(segment: SegmentDefinition, contact: ContactRecord): boolean {
  const mode = segment.match ?? 'all';
  const checks = segment.rules.map((rule) => evaluateSegmentRule(rule, contact));
  return mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}

function evaluateSegmentRule(
  rule: SegmentDefinition['rules'][number],
  contact: ContactRecord,
): boolean {
  const value = readContactField(contact, rule.field);
  if (rule.op === 'exists') {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && `${value}`.trim() !== '';
  }

  if (rule.op === 'includes') {
    if (Array.isArray(value)) {
      return value.some((item) => `${item}`.toLowerCase() === `${rule.value ?? ''}`.toLowerCase());
    }
    if (typeof value === 'string') {
      return value.toLowerCase().includes(`${rule.value ?? ''}`.toLowerCase());
    }
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => `${item}` === `${rule.value ?? ''}`);
  }
  return `${value ?? ''}` === `${rule.value ?? ''}`;
}

function readContactField(contact: ContactRecord, field: string): unknown {
  if (field === 'tags') return contact.tags ?? [];
  if (field === 'email') return contact.email;
  if (field === 'phone') return contact.phone;
  if (field === 'firstName') return contact.firstName;
  if (field === 'lastName') return contact.lastName;
  if (field === 'fullName') return contact.fullName;
  if (field === 'crmId' || field === 'twentyId') return contact.crmId;

  const raw = (contact.raw ?? {}) as Record<string, unknown>;
  return raw[field];
}
