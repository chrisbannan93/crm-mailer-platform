import { describe, expect, it } from 'vitest';
import { createIdempotencyKey, extractContactFromTwentyWebhook, hmacSha256Hex, verifyTwentyWebhookSignature } from '../src/utils.js';

describe('twenty webhook utils', () => {
  it('verifies Twenty webhook signature', () => {
    const rawBody = JSON.stringify({ event: 'person.created', data: { id: 'p1' } });
    const timestamp = '1739201450';
    const secret = 'test-secret';
    const signature = hmacSha256Hex(secret, `${timestamp}:${rawBody}`);

    expect(
      verifyTwentyWebhookSignature({
        secret,
        rawBody,
        signatureHeader: signature,
        timestampHeader: timestamp,
      }),
    ).toBe(true);
  });

  it('extracts a person contact from webhook payload', () => {
    const contact = extractContactFromTwentyWebhook({
      event: 'person.created',
      data: {
        id: 'abc123',
        firstName: 'Alice',
        lastName: 'Doe',
        email: 'ALICE@example.com',
      },
      timestamp: '2025-02-10T15:30:50Z',
    });

    expect(contact).toEqual(
      expect.objectContaining({
        crmId: 'abc123',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Doe',
      }),
    );
  });

  it('creates stable idempotency keys', () => {
    const payload = { event: 'person.created', timestamp: 't1', data: { id: 'p1' } };
    expect(createIdempotencyKey(payload)).toBe('person.created:p1:t1');
  });
});
