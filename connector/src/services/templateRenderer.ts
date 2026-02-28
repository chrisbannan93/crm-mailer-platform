import type { EmailTemplateDefinition, RenderedEmailTemplate } from '../types/index.js';

function resolvePath(context: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, context);
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderString(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, path) => stringify(resolvePath(context, path)));
}

export function renderEmailTemplate(template: EmailTemplateDefinition, context: Record<string, unknown>): RenderedEmailTemplate {
  return {
    key: template.key,
    name: template.name,
    subject: renderString(template.subject, context),
    bodyHtml: renderString(template.bodyHtml, context),
    bodyText: template.bodyText ? renderString(template.bodyText, context) : undefined,
  };
}
