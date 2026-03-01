export type ContactRecord = {
  crmId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  tags?: string[];
  updatedAt?: string;
  raw?: unknown;
};

export type SyncResult = {
  ok: boolean;
  subscriberId?: number;
  listId?: number;
  message: string;
};

export type ContactsSyncCursor = {
  updatedSince?: string;
  pageCursor?: string;
};

export type ContactsSyncRunResult = {
  ok: true;
  fetched: number;
  processed: number;
  skippedNoEmail: number;
  nextCursor?: string;
  updatedSince?: string;
  maxReached: boolean;
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
  type: 'open' | 'click' | 'bounce' | 'unsubscribe' | 'manual';
  crmActivityType?: 'EMAIL_OPEN' | 'EMAIL_CLICK' | 'EMAIL_BOUNCE' | 'EMAIL_UNSUB';
  personId?: string;
  email?: string;
  campaignId?: string;
  campaignName?: string;
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

export type SegmentRule = {
  field: string;
  op: 'includes' | 'equals' | 'exists';
  value?: string | number | boolean;
};

export type SegmentDefinition = {
  key: string;
  name: string;
  description?: string;
  listName: string;
  list?: {
    type?: 'private' | 'public';
    optin?: 'single' | 'double';
    tags?: string[];
    description?: string;
  };
  match?: 'all' | 'any';
  rules: SegmentRule[];
};

export type SegmentsConfig = {
  version: number;
  segments: SegmentDefinition[];
};

export type EmailTemplateDefinition = {
  key: string;
  name: string;
  audience?: string;
  trigger?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
};

export type RenderedEmailTemplate = {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
};

export type WebsiteMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type WebsiteTestimonial = {
  quote: string;
  name: string;
  role: string;
};

export type WebsiteContent = {
  name: string;
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCta: { label: string; href: string };
    secondaryCta?: { label: string; href: string };
  };
  proof: {
    headline: string;
    metrics: WebsiteMetric[];
    body?: string;
  };
  sections: Array<{
    title: string;
    body: string;
    bullets?: string[];
  }>;
  testimonials: WebsiteTestimonial[];
  footerNote?: string;
};

export type PublicLead = {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  loanType?: string;
  message?: string;
  source?: string;
};

export type PublicLeadResult = {
  personId: string;
  noteId?: string;
};
