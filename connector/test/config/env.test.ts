import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

describe('parseEnv', () => {
  it('uses defaults and parses numeric fields', () => {
    const config = parseEnv({
      PORT: '4011',
      VERTICAL: 'generic',
      LISTMONK_BASE_URL: 'http://localhost:9000',
      TWENTY_BASE_URL: 'http://localhost:3000',
    });

    expect(config.port).toBe(4011);
    expect(config.vertical).toBe('generic');
    expect(config.publicTrackingBaseUrl).toBe('http://localhost:4011');
    expect(config.twenty.writebackMode).toBe('log');
  });

  it('throws on invalid writeback mode', () => {
    expect(() =>
      parseEnv({
        PORT: '4010',
        VERTICAL: 'generic',
        LISTMONK_BASE_URL: 'http://localhost:9000',
        TWENTY_BASE_URL: 'http://localhost:3000',
        TWENTY_WRITEBACK_MODE: 'bad-mode',
      }),
    ).toThrow();
  });

  it('ignores invalid workflow webhook url when mode is not workflow_webhook', () => {
    const config = parseEnv({
      PORT: '4010',
      VERTICAL: 'generic',
      LISTMONK_BASE_URL: 'http://localhost:9000',
      TWENTY_BASE_URL: 'http://localhost:3000',
      TWENTY_WRITEBACK_MODE: 'log',
      TWENTY_WORKFLOW_WEBHOOK_URL: 'not-a-url',
    });

    expect(config.twenty.writebackMode).toBe('log');
    expect(config.twenty.workflowWebhookUrl).toBeUndefined();
  });

  it('allows SYNC_INTERVAL_MINUTES=0 to disable scheduler', () => {
    const config = parseEnv({
      PORT: '4010',
      VERTICAL: 'generic',
      LISTMONK_BASE_URL: 'http://localhost:9000',
      TWENTY_BASE_URL: 'http://localhost:3000',
      SYNC_INTERVAL_MINUTES: '0',
    });

    expect(config.sync.intervalMinutes).toBe(0);
  });

  it('requires workflow webhook url when workflow_webhook mode is enabled', () => {
    expect(() =>
      parseEnv({
        PORT: '4010',
        VERTICAL: 'generic',
        LISTMONK_BASE_URL: 'http://localhost:9000',
        TWENTY_BASE_URL: 'http://localhost:3000',
        TWENTY_WRITEBACK_MODE: 'workflow_webhook',
      }),
    ).toThrow('TWENTY_WORKFLOW_WEBHOOK_URL is required for workflow_webhook mode');
  });
});
