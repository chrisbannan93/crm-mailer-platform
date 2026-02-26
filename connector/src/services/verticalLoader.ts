import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContactRecord, VerticalPack } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVerticalRoots(): string[] {
  return [
    path.resolve(__dirname, '..', '..', 'verticals'),
    path.resolve(__dirname, '..', '..', '..', 'verticals'),
  ];
}

async function loadFromConfigDir(dir: string): Promise<VerticalPack | null> {
  const configDir = path.join(dir, 'config');
  try {
    const files = await readdir(configDir);
    const candidate = ['pack.json', 'vertical.json', ...files.filter((f) => f.endsWith('.json'))].find((f, i, arr) => arr.indexOf(f) === i);
    if (!candidate) return null;
    const text = await readFile(path.join(configDir, candidate), 'utf8');
    return JSON.parse(text) as VerticalPack;
  } catch {
    return null;
  }
}

async function loadTopLevel(dir: string): Promise<VerticalPack | null> {
  try {
    const text = await readFile(path.join(dir, 'vertical.json'), 'utf8');
    return JSON.parse(text) as VerticalPack;
  } catch {
    return null;
  }
}

function assertPack(pack: VerticalPack, source: string): VerticalPack {
  if (!pack?.name || !pack.defaultList?.name) {
    throw new Error(`Invalid vertical pack loaded from ${source}`);
  }
  return pack;
}

export async function loadVerticalPack(name: string): Promise<VerticalPack> {
  let lastError: unknown;

  for (const root of getVerticalRoots()) {
    for (const candidateName of [name, 'generic']) {
      const verticalDir = path.join(root, candidateName);
      try {
        const fromConfig = await loadFromConfigDir(verticalDir);
        if (fromConfig) return assertPack(fromConfig, `${verticalDir}/config`);
        const fromTopLevel = await loadTopLevel(verticalDir);
        if (fromTopLevel) return assertPack(fromTopLevel, `${verticalDir}/vertical.json`);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw new Error(`Unable to load vertical pack '${name}': ${String(lastError)}`);
}

export function buildSubscriberAttribs(pack: VerticalPack, contact: ContactRecord): Record<string, unknown> {
  const attribs: Record<string, unknown> = { ...pack.subscriberAttribs.static };

  if (pack.subscriberAttribs.includeTwentyPersonId && contact.crmId) {
    attribs.twentyPersonId = contact.crmId;
  }
  if (contact.crmId) attribs.twentyId = contact.crmId;
  if (contact.phone) attribs.phone = contact.phone;
  attribs.tags = Array.isArray(contact.tags) ? contact.tags : [];

  if (contact.firstName) attribs.firstName = contact.firstName;
  if (contact.lastName) attribs.lastName = contact.lastName;
  if (contact.fullName) attribs.fullName = contact.fullName;

  return attribs;
}
