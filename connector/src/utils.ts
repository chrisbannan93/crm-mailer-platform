import crypto from 'node:crypto';
import type { ContactRecord, TwentyWebhookPayload } from './types.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function hmacSha256Hex(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyTwentyWebhookSignature(input: {
  secret?: string;
  rawBody: string;
  signatureHeader?: string;
  timestampHeader?: string;
}): boolean {
  if (!input.secret) return true;
  if (!input.signatureHeader || !input.timestampHeader) return false;
  const expected = hmacSha256Hex(input.secret, `${input.timestampHeader}:${input.rawBody}`);
  return safeEqualHex(expected, input.signatureHeader);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createIdempotencyKey(payload: TwentyWebhookPayload): string {
  const event = String(payload.event ?? 'unknown');
  const timestamp = String(payload.timestamp ?? '');
  const data = payload.data ?? {};
  const recordId = String((data as { id?: unknown }).id ?? '');
  return `${event}:${recordId}:${timestamp}`;
}

export function extractContactFromTwentyWebhook(payload: TwentyWebhookPayload): ContactRecord | null {
  const event = String(payload.event ?? '');
  if (!event.startsWith('person.')) return null;

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const email = getString(data.email) ?? getString(data.primaryEmail);
  if (!email) return null;

  const firstName = getString(data.firstName) ?? undefined;
  const lastName = getString(data.lastName) ?? undefined;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || getString(data.name) || undefined;

  return {
    crmId: getString(data.id) ?? undefined,
    email: normalizeEmail(email),
    firstName,
    lastName,
    fullName,
    raw: payload,
  };
}

export function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function toTransparentGif(): Buffer {
  return Buffer.from(
    'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
    'base64',
  );
}

export function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
