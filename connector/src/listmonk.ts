import type { ContactRecord } from './types.js';
import { quoteSqlString } from './utils.js';

type ListmonkConfig = {
  baseUrl: string;
  apiUser?: string;
  apiPassword?: string;
};

type ListmonkList = {
  id: number;
  name: string;
  type: 'private' | 'public';
  optin: 'single' | 'double';
  status?: string;
  tags?: string[];
  description?: string;
};

type Subscriber = {
  id: number;
  email: string;
  name: string;
  lists?: Array<{ id: number }>;
};

export class ListmonkClient {
  constructor(private readonly config: ListmonkConfig) {}

  async listLists(): Promise<ListmonkList[]> {
    const data = await this.request<{ results: ListmonkList[] }>('/api/lists?per_page=all&minimal=true');
    return data.results ?? [];
  }

  async ensureList(input: {
    name: string;
    type: 'private' | 'public';
    optin: 'single' | 'double';
    tags?: string[];
    description?: string;
  }): Promise<ListmonkList> {
    const existing = (await this.listLists()).find((list) => list.name === input.name);
    if (existing) return existing;

    return this.request<ListmonkList>('/api/lists', {
      method: 'POST',
      body: {
        name: input.name,
        type: input.type,
        optin: input.optin,
        status: 'active',
        tags: input.tags ?? [],
        description: input.description ?? '',
      },
    });
  }

  async findSubscriberByEmail(email: string): Promise<Subscriber | null> {
    const sql = `subscribers.email = ${quoteSqlString(email)}`;
    const query = new URLSearchParams({ query: sql, per_page: '100', page: '1' });
    const data = await this.request<{ results: Subscriber[] }>(`/api/subscribers?${query.toString()}`);
    return (data.results ?? []).find((subscriber) => subscriber.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async upsertSubscriber(input: {
    contact: ContactRecord;
    listId: number;
    attribs: Record<string, unknown>;
  }): Promise<{ subscriberId: number }> {
    const existing = await this.findSubscriberByEmail(input.contact.email);
    const name = input.contact.fullName || [input.contact.firstName, input.contact.lastName].filter(Boolean).join(' ') || input.contact.email;

    const payload = {
      email: input.contact.email,
      name,
      status: 'enabled',
      lists: [input.listId],
      attribs: input.attribs,
      preconfirm_subscriptions: true,
    };

    if (!existing) {
      const created = await this.request<{ id: number }>('/api/subscribers', { method: 'POST', body: payload });
      return { subscriberId: created.id };
    }

    await this.request(`/api/subscribers/${existing.id}`, { method: 'PUT', body: payload });
    return { subscriberId: existing.id };
  }

  async createCampaign(input: {
    name: string;
    subject: string;
    listIds: number[];
    body: string;
    fromEmail?: string;
    tags?: string[];
  }): Promise<{ id: number; uuid?: string }> {
    return this.request<{ id: number; uuid?: string }>('/api/campaigns', {
      method: 'POST',
      body: {
        name: input.name,
        subject: input.subject,
        lists: input.listIds,
        type: 'regular',
        content_type: 'html',
        body: input.body,
        messenger: 'email',
        from_email: input.fromEmail,
        tags: input.tags ?? ['crm-connector'],
      },
    });
  }

  async sendCampaignTest(campaignId: number, subscribers: string[]): Promise<void> {
    await this.request(`/api/campaigns/${campaignId}/test`, {
      method: 'POST',
      body: { subscribers },
    });
  }

  private async request<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.config.apiUser && this.config.apiPassword) {
      headers.Authorization = `Basic ${Buffer.from(`${this.config.apiUser}:${this.config.apiPassword}`).toString('base64')}`;
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });

    const text = await response.text();
    const json = text ? (JSON.parse(text) as { data?: T; message?: string }) : {};

    if (!response.ok) {
      throw new Error(`listmonk ${response.status}: ${json.message ?? text}`);
    }

    return (json.data ?? (json as unknown)) as T;
  }
}
