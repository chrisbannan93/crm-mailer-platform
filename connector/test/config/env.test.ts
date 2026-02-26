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
});
