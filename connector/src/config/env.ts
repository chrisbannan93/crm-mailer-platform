import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const urlString = z.string().url().transform((value) => value.replace(/\/$/, ''));

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(4010),
  VERTICAL: z.string().min(1).default('generic'),

  WEBHOOK_SHARED_SECRET: z.string().optional(),
  TWENTY_WEBHOOK_SECRET: z.string().optional(),
  PUBLIC_TRACKING_BASE_URL: urlString.optional(),

  LISTMONK_BASE_URL: urlString.default('http://localhost:9000'),
  LISTMONK_AUTH_MODE: z.enum(['basic', 'token', 'bearer']).optional(),
  LISTMONK_AUTH_USER: z.string().optional(),
  LISTMONK_AUTH_PASSWORD: z.string().optional(),
  LISTMONK_AUTH_TOKEN: z.string().optional(),
  LISTMONK_API_USER: z.string().optional(),
  LISTMONK_API_PASSWORD: z.string().optional(),
  LISTMONK_DEFAULT_LIST_ID: z.coerce.number().int().positive().optional(),
  LISTMONK_DEFAULT_LIST_NAME: z.string().default('CRM Contacts'),

  TWENTY_BASE_URL: urlString.default('http://localhost:3000'),
  TWENTY_AUTH_MODE: z.enum(['bearer', 'token']).optional(),
  TWENTY_AUTH_TOKEN: z.string().optional(),
  TWENTY_API_KEY: z.string().optional(),
  TWENTY_GRAPHQL_PATH: z.string().default('/graphql'),
  TWENTY_REST_PATH: z.string().default('/rest'),
  TWENTY_WRITEBACK_MODE: z.enum(['log', 'rest_note', 'workflow_webhook']).default('log'),
  TWENTY_ENGAGEMENT_NOTE_ENDPOINT: z.string().default('/rest/notes'),
  TWENTY_WORKFLOW_WEBHOOK_URL: urlString.optional(),

  MAILPIT_BASE_URL: urlString.optional(),
});

export type ParsedEnv = z.infer<typeof envSchema>;

export type AppConfig = {
  port: number;
  nodeEnv: string;
  vertical: string;
  webhookSharedSecret?: string;
  twentyWebhookSecret?: string;
  publicTrackingBaseUrl: string;
  listmonk: {
    baseUrl: string;
    authMode?: 'basic' | 'token' | 'bearer';
    authUser?: string;
    authPassword?: string;
    authToken?: string;
    apiUser?: string;
    apiPassword?: string;
    defaultListId?: number;
    defaultListName: string;
  };
  twenty: {
    baseUrl: string;
    authMode?: 'bearer' | 'token';
    authToken?: string;
    apiKey?: string;
    graphqlPath: string;
    restPath: string;
    writebackMode: 'log' | 'rest_note' | 'workflow_webhook';
    engagementNoteEndpoint: string;
    workflowWebhookUrl?: string;
  };
  mailpitBaseUrl?: string;
};

export function parseEnv(input: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.parse(input);

  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    vertical: parsed.VERTICAL,
    webhookSharedSecret: parsed.WEBHOOK_SHARED_SECRET,
    twentyWebhookSecret: parsed.TWENTY_WEBHOOK_SECRET,
    publicTrackingBaseUrl: parsed.PUBLIC_TRACKING_BASE_URL ?? `http://localhost:${parsed.PORT}`,
    listmonk: {
      baseUrl: parsed.LISTMONK_BASE_URL,
      authMode: parsed.LISTMONK_AUTH_MODE,
      authUser: parsed.LISTMONK_AUTH_USER,
      authPassword: parsed.LISTMONK_AUTH_PASSWORD,
      authToken: parsed.LISTMONK_AUTH_TOKEN,
      apiUser: parsed.LISTMONK_API_USER,
      apiPassword: parsed.LISTMONK_API_PASSWORD,
      defaultListId: parsed.LISTMONK_DEFAULT_LIST_ID,
      defaultListName: parsed.LISTMONK_DEFAULT_LIST_NAME,
    },
    twenty: {
      baseUrl: parsed.TWENTY_BASE_URL,
      authMode: parsed.TWENTY_AUTH_MODE,
      authToken: parsed.TWENTY_AUTH_TOKEN,
      apiKey: parsed.TWENTY_API_KEY,
      graphqlPath: parsed.TWENTY_GRAPHQL_PATH,
      restPath: parsed.TWENTY_REST_PATH,
      writebackMode: parsed.TWENTY_WRITEBACK_MODE,
      engagementNoteEndpoint: parsed.TWENTY_ENGAGEMENT_NOTE_ENDPOINT,
      workflowWebhookUrl: parsed.TWENTY_WORKFLOW_WEBHOOK_URL,
    },
    mailpitBaseUrl: parsed.MAILPIT_BASE_URL,
  };
}

export function getConfig(): AppConfig {
  return parseEnv(process.env);
}
