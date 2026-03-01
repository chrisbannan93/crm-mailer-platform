import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import type { AppConfig } from '../src/config.js';
import type { WebsiteContent } from '../src/types/index.js';

function makeConfig(): AppConfig {
  return {
    port: 4010,
    nodeEnv: 'test',
    vertical: 'generic',
    listmonkWebhookHeader: 'X-Webhook-Token',
    listmonkWebhookDedupTtlSeconds: 3600,
    publicTrackingBaseUrl: 'http://localhost:4010',
    listmonk: { baseUrl: 'http://listmonk:9000' },
    twenty: {
      baseUrl: 'http://twenty:3000',
      graphqlPath: '/graphql',
      restPath: '/rest',
      writebackMode: 'log',
      engagementNoteEndpoint: '/rest/notes',
    },
    sync: {
      maxContactsPerRun: 500,
      stateFile: './data/test-state.json',
    },
  };
}

function makeWebsiteContent(): WebsiteContent {
  return {
    name: 'Demo Mortgage Site',
    hero: {
      eyebrow: 'Demo',
      headline: 'Public site',
      subheadline: 'Lead capture ready.',
      primaryCta: { label: 'Book now', href: '#lead-form' },
      secondaryCta: { label: 'Open studio', href: '/studio' },
    },
    proof: {
      headline: 'Proof',
      metrics: [{ label: 'Active applications', value: '18' }],
    },
    sections: [{ title: 'Section', body: 'Body' }],
    testimonials: [{ quote: 'Quote', name: 'Name', role: 'Role' }],
  };
}

function makeServiceMock() {
  return {
    getRecentEvents: vi.fn().mockReturnValue([]),
    listEmailTemplates: vi.fn().mockReturnValue([]),
    renderEmailTemplate: vi.fn(),
    listLists: vi.fn().mockResolvedValue([]),
    handleTwentyWebhook: vi.fn(),
    handleListmonkWebhook: vi.fn(),
    syncContactsFromTwenty: vi.fn().mockResolvedValue({ ok: true, fetched: 0, processed: 0, skippedNoEmail: 0, maxReached: false }),
    syncPersonById: vi.fn(),
    sendTestCampaign: vi.fn(),
    sendTemplateCampaign: vi.fn(),
    sendTemplateForApplication: vi.fn(),
    getStudioDashboard: vi.fn().mockResolvedValue({ metrics: [], pipeline: [], attention: [], workflows: [] }),
    runDocsChaseWorkflow: vi.fn().mockResolvedValue({ workflowKey: 'docs_chase', processed: 0, taskCount: 0, sentCount: 0, skippedCount: 0, results: [] }),
    runReviewSweepWorkflow: vi.fn().mockResolvedValue({ workflowKey: 'review_sweep', processed: 0, taskCount: 0, sentCount: 0, skippedCount: 0, results: [] }),
    recordEngagement: vi.fn(),
    createPublicLead: vi.fn(),
    getStudioContextForApplication: vi.fn(),
    getStudioContextForPerson: vi.fn(),
    buildStudioLaunchUrl: vi.fn().mockReturnValue('/studio?applicationId=APP-001'),
    recommendTemplateKey: vi.fn().mockReturnValue('retail_documents_request'),
  } as any;
}

describe('server', () => {
  it('serves health endpoint', async () => {
    const service = makeServiceMock();

    const app = createServer(makeConfig(), service);
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects listmonk webhook when shared header token is invalid', async () => {
    const service = makeServiceMock();

    const config = { ...makeConfig(), listmonkWebhookSecret: 'secret123' };
    const app = createServer(config, service);
    const res = await request(app).post('/webhooks/listmonk').send({ event: 'email.open', email: 'a@example.com' });

    expect(res.status).toBe(401);
    expect(service.handleListmonkWebhook).not.toHaveBeenCalled();
  });

  it('serves the public site at root when content exists', async () => {
    const service = makeServiceMock();

    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Demo Mortgage Site');
    expect(res.text).toContain('Request a broker callback');
  });

  it('serves the operator ui at /studio', async () => {
    const service = makeServiceMock();

    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).get('/studio');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Mailer Studio');
    expect(res.text).toContain('Open Public Site');
  });

  it('accepts a public lead form submission', async () => {
    const service = makeServiceMock();
    service.createPublicLead.mockResolvedValue({ personId: 'person_123', noteId: 'note_123' });

    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).post('/public/leads').send({
      firstName: 'Chris',
      email: 'chris@example.com',
      loanType: 'Retail home loan',
    });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(service.createPublicLead).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Chris', email: 'chris@example.com', source: 'public-site' }),
    );
  });

  it('returns application context plus suggested template', async () => {
    const service = makeServiceMock();
    service.getStudioContextForApplication.mockResolvedValue({
      contact: { id: 'person_123', email: 'ava@example.com', firstName: 'Ava' },
      broker: { name: 'Broker' },
      application: { applicationId: 'APP-001', applicationType: 'retail_home_loan', pipelineStage: 'docs_requested' },
      checklist: { requiredSummary: 'ID', items: [] },
    });

    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).get('/studio/context/application/APP-001');

    expect(res.status).toBe(200);
    expect(res.body.suggestedTemplateKey).toBe('retail_documents_request');
    expect(service.getStudioContextForApplication).toHaveBeenCalledWith('APP-001');
  });

  it('sends a recommended application template', async () => {
    const service = makeServiceMock();
    service.sendTemplateForApplication.mockResolvedValue({
      campaignId: 22,
      testRecipient: 'ava@example.com',
      templateKey: 'retail_documents_request',
      applicationId: 'APP-001',
    });

    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).post('/campaigns/send-for-application').send({ applicationId: 'APP-001' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(service.sendTemplateForApplication).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: 'APP-001' }),
    );
  });

  it('returns dashboard snapshot', async () => {
    const service = makeServiceMock();
    service.getStudioDashboard.mockResolvedValue({
      metrics: [{ key: 'active', label: 'Active Files', value: 18 }],
      pipeline: [],
      attention: [],
      workflows: [],
    });

    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).get('/studio/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(service.getStudioDashboard).toHaveBeenCalled();
  });

  it('runs docs chase workflow', async () => {
    const service = makeServiceMock();
    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).post('/workflows/docs-chase').send({ limit: 5 });

    expect(res.status).toBe(200);
    expect(service.runDocsChaseWorkflow).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
  });

  it('runs review sweep workflow', async () => {
    const service = makeServiceMock();
    const app = createServer(makeConfig(), service, makeWebsiteContent());
    const res = await request(app).post('/workflows/review-sweep').send({ limit: 3 });

    expect(res.status).toBe(200);
    expect(service.runReviewSweepWorkflow).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
  });
});
