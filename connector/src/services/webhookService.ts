import type { TwentyWebhookPayload } from '../types/index.js';
import type { ConnectorService } from '../service.js';

export class WebhookService {
  constructor(private readonly connectorService: ConnectorService) {}

  async handleTwentyWebhook(payload: TwentyWebhookPayload) {
    return this.connectorService.handleTwentyWebhook(payload);
  }

  async handleListmonkWebhook(payload: Record<string, unknown>) {
    return this.connectorService.handleListmonkWebhook(payload);
  }
}
