import type { AppConfig } from '../config/env.js';
import type { EngagementEvent } from '../types/index.js';

export type TwentyContact = Record<string, unknown> & {
  id?: string;
  email?: string;
  primaryEmail?: string;
  updatedAt?: string;
};

export type TwentyListContactsResult = {
  contacts: TwentyContact[];
  nextCursor?: string;
};

export class TwentyClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'TwentyClientError';
  }
}

export class TwentyClient {
  constructor(private readonly config: AppConfig['twenty']) {}

  async listContacts(updatedSince?: string, pageCursor?: string): Promise<TwentyListContactsResult> {
    const query = new URLSearchParams();
    // Twenty REST APIs are generated per workspace; these params are best-effort and may be ignored.
    if (pageCursor) query.set('cursor', pageCursor);
    if (updatedSince) {
      query.set('updatedSince', updatedSince);
      query.set('updated_at_gte', updatedSince);
    }
    query.set('limit', '100');

    const path = `${this.config.restPath}/people${query.toString() ? `?${query.toString()}` : ''}`;
    const raw = await this.request<unknown>(path);
    const contacts = this.extractContactArray(raw).filter((contact) => {
      if (!updatedSince) return true;
      const updatedAt = typeof contact.updatedAt === 'string' ? contact.updatedAt : undefined;
      if (!updatedAt) return true;
      return new Date(updatedAt).getTime() >= new Date(updatedSince).getTime();
    });

    return {
      contacts,
      nextCursor: this.extractNextCursor(raw),
    };
  }

  async getContactByEmail(email: string): Promise<TwentyContact | null> {
    const target = email.trim().toLowerCase();
    let cursor: string | undefined;
    let pages = 0;

    // Safe fallback: page through contacts and filter locally.
    do {
      const { contacts, nextCursor } = await this.listContacts(undefined, cursor);
      const found = contacts.find((contact) => {
        const candidates = [contact.email, contact.primaryEmail].filter((v): v is string => typeof v === 'string');
        return candidates.some((value) => value.trim().toLowerCase() === target);
      });
      if (found) return found;
      cursor = nextCursor;
      pages += 1;
    } while (cursor && pages < 20);

    return null;
  }

  async fetchPersonById(id: string): Promise<Record<string, unknown>> {
    if (!this.getAuthToken()) {
      throw new Error('TWENTY_AUTH_TOKEN or TWENTY_API_KEY is required for manual person sync');
    }
    return this.request<Record<string, unknown>>(`${this.config.restPath}/people/${id}`);
  }

  async writeEngagement(event: EngagementEvent): Promise<void> {
    if (this.config.writebackMode === 'log') return;

    if (this.config.writebackMode === 'workflow_webhook') {
      if (!this.config.workflowWebhookUrl) {
        throw new Error('TWENTY_WORKFLOW_WEBHOOK_URL is required for workflow_webhook mode');
      }
      const response = await fetch(this.config.workflowWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        throw new Error(`Twenty workflow webhook ${response.status}`);
      }
      return;
    }

    await this.request(this.config.engagementNoteEndpoint, {
      method: 'POST',
      body: this.buildRestNotePayload(event),
    });
  }

  private buildRestNotePayload(event: EngagementEvent): Record<string, unknown> {
    const summary =
      event.type === 'click'
        ? `Email click tracked${event.targetUrl ? `: ${event.targetUrl}` : ''}`
        : event.type === 'open'
          ? 'Email open tracked'
          : 'Email engagement recorded';

    return {
      title: 'Email engagement',
      body: `${summary} (${event.timestamp})`,
      content: `${summary} (${event.timestamp})`,
      source: 'listmonk-connector',
      personId: event.personId,
      email: event.email,
      campaignId: event.campaignId,
      metadata: {
        type: event.type,
        source: event.source,
        ...(event.metadata ?? {}),
        ...(event.targetUrl ? { targetUrl: event.targetUrl } : {}),
      },
    };
  }

  private async request<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('TWENTY_AUTH_TOKEN or TWENTY_API_KEY is required');
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });

    const text = await response.text();
    if (!response.ok) {
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        // keep raw text
      }
      throw new TwentyClientError(`twenty ${response.status}: ${text}`, response.status, path, body);
    }

    if (!text) return {} as T;
    try {
      const parsed = JSON.parse(text) as { data?: T };
      return (parsed.data ?? (parsed as unknown)) as T;
    } catch {
      return {} as T;
    }
  }

  private getAuthToken(): string | undefined {
    return this.config.authToken || this.config.apiKey;
  }

  private extractContactArray(raw: unknown): TwentyContact[] {
    if (Array.isArray(raw)) return raw as TwentyContact[];

    const obj = (raw ?? {}) as Record<string, unknown>;
    const candidates = [
      obj.results,
      obj.records,
      (obj.data as Record<string, unknown> | undefined)?.results,
      (obj.data as Record<string, unknown> | undefined)?.records,
      (obj.items as Record<string, unknown> | undefined),
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as TwentyContact[];
    }

    return [];
  }

  private extractNextCursor(raw: unknown): string | undefined {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const data = (obj.data ?? {}) as Record<string, unknown>;
    const pageInfo = (data.pageInfo ?? obj.pageInfo ?? {}) as Record<string, unknown>;

    const value =
      (typeof obj.nextCursor === 'string' && obj.nextCursor) ||
      (typeof (obj.next_cursor as unknown) === 'string' && (obj.next_cursor as string)) ||
      (typeof data.nextCursor === 'string' && data.nextCursor) ||
      (typeof (data.next_cursor as unknown) === 'string' && (data.next_cursor as string)) ||
      (typeof pageInfo.endCursor === 'string' && pageInfo.endCursor) ||
      undefined;

    return value || undefined;
  }
}
