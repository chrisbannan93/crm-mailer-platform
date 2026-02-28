import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { EmailTemplateDefinition } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const emailTemplateSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  audience: z.string().optional(),
  trigger: z.string().optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
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

export async function loadEmailTemplates(name: string): Promise<EmailTemplateDefinition[]> {
  const templates = new Map<string, EmailTemplateDefinition>();

  for (const root of getVerticalRoots()) {
    for (const candidateName of getVerticalSearchOrder(name)) {
      const templateDir = path.join(root, candidateName, 'templates', 'email');
      try {
        const files = (await readdir(templateDir)).filter((file) => file.endsWith('.json')).sort();
        for (const file of files) {
          const text = await readFile(path.join(templateDir, file), 'utf8');
          const parsed = emailTemplateSchema.parse(JSON.parse(text)) as EmailTemplateDefinition;
          if (!templates.has(parsed.key)) {
            templates.set(parsed.key, parsed);
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
        throw new Error(`Failed loading email templates from ${templateDir}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return Array.from(templates.values()).sort((a, b) => a.name.localeCompare(b.name));
}
