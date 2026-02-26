import type { AppConfig } from './config.js';
import type { EngagementEvent } from './types.js';

export class TwentyClient {
  constructor(private readonly config: AppConfig['twenty']) {}

  async fetchPersonById(id: string): Promise<Record<string, unknown>> {
    if (!this.config.apiKey) {
      throw new Error('TWENTY_API_KEY is required for manual person sync');
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
    const summary = event.type === 'click'
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
    if (!this.config.apiKey) {
      throw new Error('TWENTY_API_KEY is required');
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`twenty ${response.status}: ${text}`);
    }

    if (!text) return {} as T;
    try {
      const parsed = JSON.parse(text) as { data?: T };
      return (parsed.data ?? (parsed as unknown)) as T;
    } catch {
      return {} as T;
    }
  }
}
