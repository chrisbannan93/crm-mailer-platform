import { describe, expect, it, vi } from 'vitest';
import { ConnectorService } from '../src/service.js';
import { MemoryStore } from '../src/memory-store.js';
import type { AppConfig } from '../src/config.js';
import type { StudioTemplateContext, VerticalPack } from '../src/types.js';
import { evaluateTouchpointEligibility, getMissingRequiredDocs, matchesTouchpointEligibility } from '../src/services/mortgageTouchpoints.js';

function makeConfig(): AppConfig {
  return {
    port: 4010,
    nodeEnv: 'test',
    vertical: 'mortgage_au',
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

const vertical: VerticalPack = {
  name: 'mortgage_au',
  version: 1,
  defaultList: { name: 'CRM Synced Contacts', type: 'private', optin: 'single', tags: ['crm'] },
  subscriberAttribs: { includeTwentyPersonId: true, static: { vertical: 'mortgage_au' } },
  notes: [],
};

const context: StudioTemplateContext = {
  contact: { id: 'person_1', firstName: 'Ava', email: 'ava@example.com' },
  broker: { name: 'Broker' },
  application: { id: 'app_1', applicationId: 'APP-001', applicationType: 'retail_home_loan', pipelineStage: 'docs_requested' },
  checklist: {
    requiredSummary: 'ID, payslips',
    items: [
      { label: 'ID', required: true, status: 'missing' },
      { label: 'Payslips', required: true, status: 'requested' },
      { label: 'Bank statements', required: true, status: 'received' },
    ],
  },
};

describe('mortgage touchpoints', () => {
  it('extracts missing required docs', () => {
    expect(getMissingRequiredDocs(context)).toEqual(['ID', 'Payslips']);
  });

  it('evaluates docs request eligibility', () => {
    const eligible = matchesTouchpointEligibility(
      {
        key: 'retail_documents_request',
        lifecycle: 'processing',
        audience: 'retail',
        eligibility: { stages: ['docs_requested'], applicationTypes: ['retail_home_loan'], requiresMissingDocs: true },
        cooldownHours: 48,
        defaultSubject: 'Documents required',
        templateFile: 'verticals/mortgage_au/templates/email/retail_documents_request.json',
        recommendedQueue: 'docs_outstanding',
        requiredConfirm: true,
      },
      {
        context,
        row: {
          applicationId: 'APP-001',
          borrowerName: 'Ava',
          applicationType: 'retail_home_loan',
          pipelineStage: 'docs_requested',
          pendingRequiredDocs: 2,
          recommendedTemplateKey: 'retail_documents_request',
        },
        now: new Date('2026-03-09T00:00:00.000Z'),
        consentMarketing: true,
      },
    );

    expect(eligible).toBe(true);
  });

  it('returns reason when stage is not eligible', () => {
    const result = evaluateTouchpointEligibility(
      {
        key: 'retail_documents_request',
        lifecycle: 'processing',
        audience: 'retail',
        eligibility: { stages: ['docs_requested'], applicationTypes: ['retail_home_loan'], requiresMissingDocs: true },
        cooldownHours: 48,
        defaultSubject: 'Documents required',
        templateFile: 'verticals/mortgage_au/templates/email/retail_documents_request.json',
        recommendedQueue: 'docs_outstanding',
        requiredConfirm: true,
      },
      {
        context: {
          ...context,
          application: { ...context.application, pipelineStage: 'submitted' },
        },
        row: {
          applicationId: 'APP-001',
          borrowerName: 'Ava',
          applicationType: 'retail_home_loan',
          pipelineStage: 'submitted',
          pendingRequiredDocs: 2,
          recommendedTemplateKey: 'retail_documents_request',
        },
        now: new Date('2026-03-09T00:00:00.000Z'),
        consentMarketing: true,
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons.some((reason) => reason.includes('Stage'))).toBe(true);
  });

  it('enforces cooldown dedupe on confirm unless override=true', async () => {
    const listmonk = {
      listLists: vi.fn().mockResolvedValue([]),
      ensureList: vi.fn().mockResolvedValue({ id: 1, name: 'CRM Synced Contacts' }),
      upsertSubscriber: vi.fn().mockResolvedValue({ subscriberId: 1 }),
      findSubscriberByEmail: vi.fn().mockResolvedValue(null),
      addSubscriberToLists: vi.fn().mockResolvedValue(undefined),
      removeSubscriberFromLists: vi.fn().mockResolvedValue(undefined),
      createCampaign: vi.fn().mockResolvedValue({ id: 91 }),
      sendCampaignTest: vi.fn().mockResolvedValue(undefined),
    };

    const twenty = {
      listContacts: vi.fn().mockResolvedValue({ contacts: [] }),
      fetchPersonById: vi.fn(),
      writeEngagement: vi.fn().mockResolvedValue(undefined),
      getStudioContextForApplication: vi.fn().mockResolvedValue(context),
      getMortgageDashboard: vi.fn().mockResolvedValue({
        metrics: [],
        pipeline: [],
        attention: [
          {
            applicationId: 'APP-001',
            borrowerName: 'Ava',
            applicationType: 'retail_home_loan',
            pipelineStage: 'docs_requested',
            pendingRequiredDocs: 2,
            recommendedTemplateKey: 'retail_documents_request',
          },
        ],
        workflows: [],
      }),
      getDefaultAssigneeId: vi.fn().mockResolvedValue(undefined),
      createWorkflowTask: vi.fn(),
    };

    const service = new ConnectorService({
      config: makeConfig(),
      store: new MemoryStore(),
      vertical,
      emailTemplates: [
        {
          key: 'retail_documents_request',
          name: 'Retail Documents Request',
          subject: 'Documents required',
          bodyHtml: '<p>Missing: {{ checklist.requiredSummary }}</p>',
        },
      ],
      // @ts-expect-error partial mock is sufficient for this test
      twenty,
      // @ts-expect-error partial mock is sufficient for this test
      listmonk,
    });

    await service.confirmTouchpoint({ key: 'retail_documents_request', applicationId: 'APP-001' });
    await expect(service.confirmTouchpoint({ key: 'retail_documents_request', applicationId: 'APP-001' })).rejects.toThrow(
      /cooldown active/,
    );
    await expect(
      service.confirmTouchpoint({ key: 'retail_documents_request', applicationId: 'APP-001', override: true }),
    ).resolves.toMatchObject({ key: 'retail_documents_request' });
  });
});
