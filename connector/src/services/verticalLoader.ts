import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { ContactRecord, SegmentDefinition, SegmentsConfig, VerticalPack } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const segmentRuleSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['includes', 'equals', 'exists']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const segmentSchema = z.object({
  key: z.string().regex(/^[a-z0-9_\\-]+$/i),
  name: z.string().min(1),
  description: z.string().optional(),
  listName: z.string().min(1),
  list: z
    .object({
      type: z.enum(['private', 'public']).optional(),
      optin: z.enum(['single', 'double']).optional(),
      tags: z.array(z.string().min(1)).optional(),
      description: z.string().optional(),
    })
    .optional(),
  match: z.enum(['all', 'any']).optional(),
  rules: z.array(segmentRuleSchema).min(1),
});

const segmentsConfigSchema = z.object({
  version: z.coerce.number().int().positive().default(1),
  segments: z.array(segmentSchema).default([]),
});

function getVerticalRoots(): string[] {
  return [
    path.resolve(__dirname, '..', '..', 'verticals'),
    path.resolve(__dirname, '..', '..', '..', 'verticals'),
  ];
}

function getVerticalSearchOrder(name: string): string[] {
  return name === 'generic' ? ['generic'] : [name, 'generic'];
}

async function resolveVerticalDir(name: string): Promise<string> {
  for (const root of getVerticalRoots()) {
    for (const candidateName of getVerticalSearchOrder(name)) {
      const verticalDir = path.join(root, candidateName);
      try {
        const pack = await loadFromConfigDir(verticalDir);
        if (pack) return verticalDir;
        const topLevel = await loadTopLevel(verticalDir);
        if (topLevel) return verticalDir;
      } catch {
        // continue
      }
    }
  }
  throw new Error(`Unable to resolve vertical directory for '${name}'`);
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
    for (const candidateName of getVerticalSearchOrder(name)) {
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

export async function loadSegmentsConfig(name: string): Promise<SegmentsConfig> {
  const verticalDir = await resolveVerticalDir(name);
  const segmentsPath = path.join(verticalDir, 'config', 'segments.json');
  try {
    const text = await readFile(segmentsPath, 'utf8');
    return segmentsConfigSchema.parse(JSON.parse(text)) as SegmentsConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { version: 1, segments: [] };
    }
    throw new Error(`Invalid segments config at ${segmentsPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadSegmentDefinitions(name: string): Promise<SegmentDefinition[]> {
  const config = await loadSegmentsConfig(name);
  return config.segments;
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
