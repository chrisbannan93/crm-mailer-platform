import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContactRecord, VerticalPack } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVerticalCandidates(name: string): string[] {
  const bases = [
    path.resolve(__dirname, '..', 'verticals'), // docker runtime: /app/dist -> /app/verticals
    path.resolve(__dirname, '..', '..', 'verticals'), // local ts runtime: connector/src -> repo/verticals
  ];

  return bases.flatMap((base) => [
    path.join(base, name, 'vertical.json'),
    path.join(base, 'generic', 'vertical.json'),
  ]);
}

export async function loadVerticalPack(name: string): Promise<VerticalPack> {
  let lastError: unknown;
  for (const candidate of getVerticalCandidates(name)) {
    try {
      const text = await readFile(candidate, 'utf8');
      const parsed = JSON.parse(text) as VerticalPack;
      if (!parsed?.name || !parsed.defaultList?.name) {
        throw new Error(`Invalid vertical pack JSON at ${candidate}`);
      }
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Unable to load vertical pack '${name}': ${String(lastError)}`);
}

export function buildSubscriberAttribs(pack: VerticalPack, contact: ContactRecord): Record<string, unknown> {
  const attribs: Record<string, unknown> = { ...pack.subscriberAttribs.static };

  if (pack.subscriberAttribs.includeTwentyPersonId && contact.crmId) {
    attribs.twentyPersonId = contact.crmId;
  }

  if (contact.firstName) attribs.firstName = contact.firstName;
  if (contact.lastName) attribs.lastName = contact.lastName;
  if (contact.fullName) attribs.fullName = contact.fullName;

  return attribs;
}
