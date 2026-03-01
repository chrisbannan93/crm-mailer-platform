import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { WebsiteContent } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const websiteContentSchema = z.object({
  name: z.string().min(1),
  hero: z.object({
    eyebrow: z.string().min(1),
    headline: z.string().min(1),
    subheadline: z.string().min(1),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema.optional(),
  }),
  proof: z.object({
    headline: z.string().min(1),
    body: z.string().optional(),
    metrics: z.array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        detail: z.string().optional(),
      }),
    ),
  }),
  sections: z.array(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      bullets: z.array(z.string().min(1)).optional(),
    }),
  ),
  testimonials: z.array(
    z.object({
      quote: z.string().min(1),
      name: z.string().min(1),
      role: z.string().min(1),
    }),
  ),
  footerNote: z.string().optional(),
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

export async function loadPublicSiteContent(name: string): Promise<WebsiteContent | null> {
  for (const root of getVerticalRoots()) {
    for (const candidateName of getVerticalSearchOrder(name)) {
      const contentPath = path.join(root, candidateName, 'site', 'website.json');
      try {
        const text = await readFile(contentPath, 'utf8');
        return websiteContentSchema.parse(JSON.parse(text)) as WebsiteContent;
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
        throw new Error(`Failed loading public site content from ${contentPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return null;
}
