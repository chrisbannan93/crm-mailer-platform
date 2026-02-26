export type ContactRecord = {
  crmId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  raw?: unknown;
};

export type SyncResult = {
  ok: boolean;
  subscriberId?: number;
  listId?: number;
  message: string;
};

export type RecentEventKind = 'sync' | 'campaign' | 'engagement' | 'error';

export type RecentEvent = {
  id: string;
  kind: RecentEventKind;
  status: 'ok' | 'error';
  message: string;
  createdAt: string;
  detail?: Record<string, unknown>;
};

export type EngagementEvent = {
  type: 'open' | 'click' | 'manual';
  personId?: string;
  email?: string;
  campaignId?: string;
  targetUrl?: string;
  timestamp: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type TwentyWebhookPayload = {
  event?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  [key: string]: unknown;
};

export type VerticalPack = {
  name: string;
  version: number;
  defaultList: {
    name: string;
    type: 'private' | 'public';
    optin: 'single' | 'double';
    tags: string[];
    description?: string;
  };
  subscriberAttribs: {
    includeTwentyPersonId: boolean;
    static: Record<string, string | number | boolean>;
  };
  notes: string[];
};
