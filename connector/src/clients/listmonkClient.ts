import type { ContactRecord } from '../types/index.js';
import { quoteSqlString } from '../utils.js';

export type ListmonkClientConfig = {
  baseUrl: string;
  authMode?: 'basic' | 'token' | 'bearer';
  authUser?: string;
  authPassword?: string;
  authToken?: string;
  apiUser?: string;
  apiPassword?: string;
  retryCount?: number;
  retryDelayMs?: number;
};

export type ListmonkList = {
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

export class ListmonkClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'ListmonkClientError';
  }
}

export class ListmonkClient {
  constructor(private readonly config: ListmonkClientConfig) {}

  async health(): Promise<{ ok: true; reachable: true }> {
    await this.request('/api/lists?per_page=1&minimal=true');
    return { ok: true, reachable: true };
  }

  async info(): Promise<{ baseUrl: string; authMode: string; supportsCampaignTestSend: true }> {
    return {
      baseUrl: this.config.baseUrl,
      authMode: this.resolveAuthMode(),
      supportsCampaignTestSend: true,
    };
  }

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

  async findListByName(name: string): Promise<ListmonkList | null> {
    return (await this.listLists()).find((list) => list.name === name) ?? null;
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
    const name =
      input.contact.fullName ||
      [input.contact.firstName, input.contact.lastName].filter(Boolean).join(' ') ||
      input.contact.email;

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

  async addSubscriberToLists(subscriberId: number, listIds: number[], status: 'confirmed' | 'unconfirmed' = 'confirmed'): Promise<void> {
    if (listIds.length === 0) return;
    await this.request('/api/subscribers/lists', {
      method: 'PUT',
      body: {
        ids: [subscriberId],
        action: 'add',
        target_list_ids: listIds,
        status,
      },
    });
  }

  async removeSubscriberFromLists(subscriberId: number, listIds: number[]): Promise<void> {
    if (listIds.length === 0) return;
    await this.request('/api/subscribers/lists', {
      method: 'PUT',
      body: {
        ids: [subscriberId],
        action: 'remove',
        target_list_ids: listIds,
      },
    });
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

  async sendCampaignTest(
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
  ): Promise<void> {
    await this.request(`/api/campaigns/${campaignId}/test`, {
      method: 'POST',
      body: {
        subscribers: input.subscribers,
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

  private async request<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    return this.requestWithRetry<T>(path, init, this.config.retryCount ?? 2);
  }

  private async requestWithRetry<T>(
    path: string,
    init: { method?: string; body?: unknown } | undefined,
    retriesRemaining: number,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';

    const authHeader = this.buildAuthHeader();
    if (authHeader) headers.Authorization = authHeader;

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: init?.method ?? 'GET',
        headers,
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (error) {
      if (retriesRemaining > 0) {
        await this.delay(this.config.retryDelayMs ?? 150);
        return this.requestWithRetry(path, init, retriesRemaining - 1);
      }
      throw new ListmonkClientError(
        `listmonk network error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        path,
      );
    }

    const text = await response.text();
    let json: { data?: T; message?: string } | Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as { data?: T; message?: string };
      } catch {
        json = { raw: text };
      }
    }

    if (!response.ok) {
      if (response.status >= 500 && retriesRemaining > 0) {
        await this.delay(this.config.retryDelayMs ?? 150);
        return this.requestWithRetry(path, init, retriesRemaining - 1);
      }
      const message =
        (json as { message?: string }).message ??
        (typeof (json as { error?: unknown }).error === 'string' ? ((json as { error: string }).error) : text) ??
        'request failed';
      throw new ListmonkClientError(`listmonk ${response.status}: ${message}`, response.status, path, json);
    }

    return (json.data ?? (json as unknown)) as T;
  }

  private resolveAuthMode(): 'basic' | 'token' | 'bearer' | 'none' {
    if (this.config.authMode) return this.config.authMode;
    if (this.config.authToken && this.config.authUser) return 'token';
    if (this.config.authUser && this.config.authPassword) return 'basic';
    if (this.config.apiUser && this.config.apiPassword) return 'basic';
    return 'none';
  }

  private buildAuthHeader(): string | undefined {
    const mode = this.resolveAuthMode();
    if (mode === 'none') return undefined;

    // listmonk commonly uses Basic auth where "password" may be an API token.
    if (mode === 'token') {
      const user = this.config.authUser ?? this.config.apiUser;
      const token = this.config.authToken;
      if (!user || !token) return undefined;
      return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
    }

    if (mode === 'bearer') {
      const token = this.config.authToken;
      return token ? `Bearer ${token}` : undefined;
    }

    const user = this.config.authUser ?? this.config.apiUser;
    const password = this.config.authPassword ?? this.config.apiPassword;
    if (!user || !password) return undefined;
    return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
