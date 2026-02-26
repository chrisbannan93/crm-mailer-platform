import { config as loadEnv } from 'dotenv';

loadEnv();

export type AppConfig = {
  port: number;
  nodeEnv: string;
  vertical: string;
  webhookSharedSecret?: string;
  twentyWebhookSecret?: string;
  publicTrackingBaseUrl: string;
  listmonk: {
    baseUrl: string;
    apiUser?: string;
    apiPassword?: string;
    defaultListId?: number;
  };
  twenty: {
    baseUrl: string;
    apiKey?: string;
    graphqlPath: string;
    restPath: string;
    writebackMode: 'log' | 'rest_note' | 'workflow_webhook';
    engagementNoteEndpoint: string;
    workflowWebhookUrl?: string;
  };
  mailpitBaseUrl?: string;
};

function requiredUrl(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing ${name}`);
  return value.replace(/\/$/, '');
}

function optionalNumber(name: string): number | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Invalid integer in ${name}`);
  return parsed;
}

export function getConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 4010);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  const rawWritebackMode = (process.env.TWENTY_WRITEBACK_MODE ?? 'log') as AppConfig['twenty']['writebackMode'];
  if (!['log', 'rest_note', 'workflow_webhook'].includes(rawWritebackMode)) {
    throw new Error(`Invalid TWENTY_WRITEBACK_MODE: ${rawWritebackMode}`);
  }

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    vertical: process.env.VERTICAL ?? 'generic',
    webhookSharedSecret: process.env.WEBHOOK_SHARED_SECRET || undefined,
    twentyWebhookSecret: process.env.TWENTY_WEBHOOK_SECRET || undefined,
    publicTrackingBaseUrl: requiredUrl('PUBLIC_TRACKING_BASE_URL', `http://localhost:${port}`),
    listmonk: {
      baseUrl: requiredUrl('LISTMONK_BASE_URL', 'http://localhost:9000'),
      apiUser: process.env.LISTMONK_API_USER || undefined,
      apiPassword: process.env.LISTMONK_API_PASSWORD || undefined,
      defaultListId: optionalNumber('LISTMONK_DEFAULT_LIST_ID'),
    },
    twenty: {
      baseUrl: requiredUrl('TWENTY_BASE_URL', 'http://localhost:3000'),
      apiKey: process.env.TWENTY_API_KEY || undefined,
      graphqlPath: process.env.TWENTY_GRAPHQL_PATH ?? '/graphql',
      restPath: process.env.TWENTY_REST_PATH ?? '/rest',
      writebackMode: rawWritebackMode,
      engagementNoteEndpoint: process.env.TWENTY_ENGAGEMENT_NOTE_ENDPOINT ?? '/rest/notes',
      workflowWebhookUrl: process.env.TWENTY_WORKFLOW_WEBHOOK_URL || undefined,
    },
    mailpitBaseUrl: process.env.MAILPIT_BASE_URL || undefined,
  };
}
