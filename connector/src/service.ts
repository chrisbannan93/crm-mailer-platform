import type { AppConfig } from './config.js';
import { z } from 'zod';
import { MemoryStore } from './memory-store.js';
import type {
  ContactRecord,
  ContactsSyncCursor,
  ContactsSyncRunResult,
  EmailTemplateDefinition,
  EngagementEvent,
  RenderedEmailTemplate,
  SegmentDefinition,
  SyncResult,
  TwentyWebhookPayload,
  PublicLead,
  PublicLeadResult,
  StudioDashboard,
  StudioTemplateContext,
  StudioWorkflowRunResult,
  VerticalPack,
} from './types.js';
import { createIdempotencyKey, extractContactFromTwentyWebhook, getString, nowIso, sha256Hex } from './utils.js';
import { buildSubscriberAttribs } from './vertical.js';
import { renderEmailTemplate as renderTemplate } from './services/templateRenderer.js';
import {
  evaluateTouchpointEligibility,
  getMissingRequiredDocs,
  loadMortgageTouchpoints,
  pickRecommendedTouchpointKey,
  type MortgageTouchpoint,
} from './services/mortgageTouchpoints.js';

function buildSafeCampaignName(input?: string): string {
  const fallback = `CRM Test ${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const raw = (input ?? fallback).trim();
  const normalized = raw.replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const candidate = (normalized || fallback).slice(0, 48).trim();
  return candidate.length >= 3 ? candidate : fallback;
}

export type ConnectorDeps = {
  config: AppConfig;
  store: MemoryStore;
  vertical: VerticalPack;
  segments?: SegmentDefinition[];
  emailTemplates?: EmailTemplateDefinition[];
  twenty: {
    listContacts(updatedSince?: string, pageCursor?: string): Promise<{ contacts: Array<Record<string, unknown>>; nextCursor?: string }>;
    getContactByEmail?(email: string): Promise<Record<string, unknown> | null>;
    fetchPersonById(id: string): Promise<Record<string, unknown>>;
    createPublicLead?(lead: PublicLead): Promise<PublicLeadResult>;
    createMortgageWebsiteLead?(lead: PublicLead): Promise<PublicLeadResult>;
    getStudioContextForApplication?(applicationId: string): Promise<StudioTemplateContext | null>;
    getStudioContextForPerson?(personId: string): Promise<StudioTemplateContext | null>;
    getMortgageDashboard?(): Promise<StudioDashboard>;
    listMortgageSegmentProfilesByEmail?(): Promise<Map<string, { segmentKeys: string[] }>>;
    listOpenTaskTitles?(): Promise<string[]>;
    getDefaultAssigneeId?(): Promise<string | undefined>;
    createWorkflowTask?(input: {
      title: string;
      bodyMarkdown: string;
      assigneeId: string;
      dueAt: string;
      personId?: string;
      loanApplicationId?: string;
    }): Promise<string>;
    writeEngagement(event: EngagementEvent): Promise<void>;
  };
  listmonk: {
    health?(): Promise<unknown>;
    listLists(): Promise<Array<{ id: number; name: string }>>;
    ensureList(input: {
      name: string;
      type: 'private' | 'public';
      optin: 'single' | 'double';
      tags?: string[];
      description?: string;
    }): Promise<{ id: number; name: string }>;
    upsertSubscriber(input: {
      contact: ContactRecord;
      listId: number;
      attribs: Record<string, unknown>;
    }): Promise<{ subscriberId: number }>;
    findSubscriberByEmail(email: string): Promise<{ id: number; email: string } | null>;
    addSubscriberToLists(subscriberId: number, listIds: number[], status?: 'confirmed' | 'unconfirmed'): Promise<void>;
    removeSubscriberFromLists(subscriberId: number, listIds: number[]): Promise<void>;
    createCampaign(input: {
      name: string;
      subject: string;
      listIds: number[];
      body: string;
      fromEmail?: string;
      tags?: string[];
    }): Promise<{ id: number; uuid?: string }>;
    sendCampaignTest(
      campaignId: number,
      input: {
        subscribers: string[];
        name: string;
        subject: string;
        listIds: number[];
        body: string;
        fromEmail?: string;
        tags?: string[];
      },
    ): Promise<void>;
  };
  logger?: {
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown>, msg?: string): void;
  };
};

export class ConnectorService {
  private contactsSyncInProgress = false;
  private touchpointsCache?: MortgageTouchpoint[];

  constructor(private readonly deps: ConnectorDeps) {}

  private async getTouchpoints(): Promise<MortgageTouchpoint[]> {
    if (this.deps.config.vertical !== 'mortgage_au') return [];
    if (!this.touchpointsCache) {
      this.touchpointsCache = await loadMortgageTouchpoints(this.deps.config.vertical);
    }
    return this.touchpointsCache;
  }

  listEmailTemplates() {
    return (this.deps.emailTemplates ?? []).map((template) => ({
      key: template.key,
      name: template.name,
      audience: template.audience,
      trigger: template.trigger,
    }));
  }

  renderEmailTemplate(input: {
    templateKey: string;
    context?: Record<string, unknown>;
  }): RenderedEmailTemplate {
    const template = this.requireEmailTemplate(input.templateKey);
    return renderTemplate(template, input.context ?? {});
  }

  getRecentEvents(limit = 50) {
    return this.deps.store.listEvents(limit);
  }

  getRecentEventsByKind(kind: 'sync' | 'engagement' | 'campaign' | 'error', limit = 50) {
    return this.deps.store
      .listEvents(limit * 3)
      .filter((event) => event.kind === kind)
      .slice(0, limit);
  }

  async getStudioStatus(): Promise<{
    connector: { ok: true; vertical: string };
    services: {
      twenty: { ok: boolean; detail?: string };
      listmonk: { ok: boolean; detail?: string };
    };
    lastSync: {
      contactsAt?: string;
      listsAt?: string;
    };
    urls: {
      twenty: string;
      listmonk: string;
      connector: string;
    };
  }> {
    const contactsAt = this.deps.store.getState<string>('sync.contacts.lastRunAt');
    const listsAt = this.deps.store.getState<string>('sync.lists.lastRunAt');
    let twentyOk = false;
    let twentyDetail: string | undefined;
    let listmonkOk = false;
    let listmonkDetail: string | undefined;

    try {
      await this.deps.twenty.listContacts(undefined, undefined);
      twentyOk = true;
    } catch (error) {
      twentyDetail = error instanceof Error ? error.message : String(error);
    }

    try {
      if (typeof this.deps.listmonk.health === 'function') {
        await this.deps.listmonk.health();
      } else {
        await this.deps.listmonk.listLists();
      }
      listmonkOk = true;
    } catch (error) {
      listmonkDetail = error instanceof Error ? error.message : String(error);
    }

    return {
      connector: { ok: true, vertical: this.deps.vertical.name },
      services: {
        twenty: { ok: twentyOk, detail: twentyDetail },
        listmonk: { ok: listmonkOk, detail: listmonkDetail },
      },
      lastSync: { contactsAt: contactsAt ?? undefined, listsAt: listsAt ?? undefined },
      urls: {
        twenty: this.deps.config.twenty.baseUrl,
        listmonk: this.deps.config.listmonk.baseUrl,
        connector: this.deps.config.publicTrackingBaseUrl,
      },
    };
  }

  async bootstrapDefaultList(): Promise<{ id: number; name: string }> {
    const cached = this.deps.store.getState<{ id: number; name: string }>('listmonk.defaultList');
    if (cached) return cached;

    const list = await this.deps.listmonk.ensureList({
      name: this.deps.config.listmonk.defaultListName || this.deps.vertical.defaultList.name,
      type: this.deps.vertical.defaultList.type,
      optin: this.deps.vertical.defaultList.optin,
      tags: this.deps.vertical.defaultList.tags,
      description: this.deps.vertical.defaultList.description,
    });

    const state = { id: list.id, name: list.name };
    this.deps.store.setState('listmonk.defaultList', state);
    return state;
  }

  async listLists() {
    return this.deps.listmonk.listLists();
  }

  async createPublicLead(lead: PublicLead): Promise<PublicLeadResult> {
    if (this.deps.config.vertical === 'mortgage_au' && this.deps.twenty.createMortgageWebsiteLead) {
      const result = await this.deps.twenty.createMortgageWebsiteLead(lead);
      this.deps.store.addEvent({
        kind: 'engagement',
        status: 'ok',
        message: `WEBSITE_LEAD_RECEIVED ${lead.email}`,
        detail: {
          eventType: 'WEBSITE_LEAD_RECEIVED',
          personId: result.personId,
          applicationId: result.applicationId,
          source: lead.source ?? 'public-site',
          attribution: lead.attribution ?? {},
          consentMarketing: Boolean(lead.consentMarketing),
          consentTimestamp: lead.consentTimestamp,
          consentCopyVersion: lead.consentCopyVersion,
        },
      });
      if (result.taskId) {
        this.deps.store.addEvent({
          kind: 'engagement',
          status: 'ok',
          message: `TASK_CREATED Initial contact - website enquiry`,
          detail: {
            eventType: 'TASK_CREATED',
            taskId: result.taskId,
            personId: result.personId,
            applicationId: result.applicationId,
          },
        });
      }
      if (result.applicationId && lead.consentMarketing !== false) {
        try {
          const context = await this.getStudioContextForApplication(result.applicationId);
          const recipient = context.contact.email;
          if (recipient) {
            const draft = await this.createTemplateDraft({
              templateKey: 'welcome_onboarding',
              to: recipient,
              personId: context.contact.id,
              context,
            });
            result.draftedTouchpoints = ['welcome_onboarding'];
            this.setTouchpointDedupe({
              touchpointKey: 'welcome_onboarding',
              applicationId: result.applicationId,
              lastConfirmedAt: nowIso(),
            });
            this.deps.store.addEvent({
              kind: 'engagement',
              status: 'ok',
              message: `TOUCHPOINT_DRAFT_CREATED welcome_onboarding`,
              detail: {
                eventType: 'TOUCHPOINT_DRAFT_CREATED',
                touchpointKey: 'welcome_onboarding',
                applicationId: result.applicationId,
                campaignId: draft.campaignId,
              },
            });
          }
        } catch (error) {
          this.deps.store.addEvent({
            kind: 'error',
            status: 'error',
            message: `welcome_onboarding draft skipped: ${error instanceof Error ? error.message : String(error)}`,
            detail: {
              eventType: 'TOUCHPOINT_DRAFT_ERROR',
              applicationId: result.applicationId,
            },
          });
        }
      }
      return result;
    }
    if (!this.deps.twenty.createPublicLead) {
      throw new Error('Twenty public lead capture is not configured');
    }
    return this.deps.twenty.createPublicLead(lead);
  }

  async getStudioContextForApplication(applicationId: string): Promise<StudioTemplateContext> {
    if (!this.deps.twenty.getStudioContextForApplication) {
      throw new Error('Twenty application context lookup is not configured');
    }
    const context = await this.deps.twenty.getStudioContextForApplication(applicationId);
    if (!context) {
      throw new Error(`Loan Application not found: ${applicationId}`);
    }
    return context;
  }

  async getStudioContextForPerson(personId: string): Promise<StudioTemplateContext> {
    if (!this.deps.twenty.getStudioContextForPerson) {
      throw new Error('Twenty person context lookup is not configured');
    }
    const context = await this.deps.twenty.getStudioContextForPerson(personId);
    if (!context) {
      throw new Error(`Person not found: ${personId}`);
    }
    return context;
  }

  async getStudioDashboard(): Promise<StudioDashboard> {
    if (!this.deps.twenty.getMortgageDashboard) {
      throw new Error('Twenty mortgage dashboard is not configured');
    }
    return this.deps.twenty.getMortgageDashboard();
  }

  async getTouchpointCatalog(): Promise<
    Array<{
      key: string;
      lifecycle: string;
      audience: 'retail' | 'commercial' | 'both';
      cooldownHours: number;
      recommendedQueue: string;
      requiredConfirm: boolean;
      eligibleCount: number;
      lastConfirmedAt?: string;
    }>
  > {
    const touchpoints = await this.getTouchpoints();
    const rowsByKey = await this.getEligibleTouchpointsByKey();
    return touchpoints.map((touchpoint) => ({
      key: touchpoint.key,
      lifecycle: touchpoint.lifecycle,
      audience: touchpoint.audience,
      cooldownHours: touchpoint.cooldownHours,
      recommendedQueue: touchpoint.recommendedQueue,
      requiredConfirm: touchpoint.requiredConfirm,
      eligibleCount: rowsByKey.get(touchpoint.key)?.length ?? 0,
      lastConfirmedAt: this.deps.store.getState<string>(`touchpoint.lastConfirmed.${touchpoint.key}`),
    }));
  }

  async getEligibleTouchpoints(input: { key: string }): Promise<StudioDashboard['attention']> {
    const rowsByKey = await this.getEligibleTouchpointsByKey();
    return rowsByKey.get(input.key) ?? [];
  }

  async getTouchpointEligibility(input: { key: string; applicationId: string }): Promise<{
    key: string;
    applicationId: string;
    eligible: boolean;
    reasons: string[];
    dedupe: { blocked: boolean; lastConfirmedAt?: string; remainingCooldownHours?: number };
  }> {
    const touchpoint = await this.requireTouchpoint(input.key);
    const context = await this.getStudioContextForApplication(input.applicationId);
    const eligibility = evaluateTouchpointEligibility(touchpoint, {
      context,
      row: {
        applicationId: input.applicationId,
        borrowerName: context.application.borrowerName ?? context.contact.firstName ?? 'Borrower',
        applicationType: context.application.applicationType,
        pipelineStage: context.application.pipelineStage,
        pendingRequiredDocs: getMissingRequiredDocs(context).length,
        recommendedTemplateKey: touchpoint.key,
      },
      now: new Date(),
      consentMarketing: true,
      updatedAt: context.application.updatedAt ?? undefined,
    });
    const dedupe = this.getTouchpointDedupeStatus({
      touchpointKey: input.key,
      applicationId: input.applicationId,
      cooldownHours: touchpoint.cooldownHours,
    });
    return {
      key: input.key,
      applicationId: input.applicationId,
      eligible: eligibility.eligible && !dedupe.blocked,
      reasons: dedupe.blocked ? [...eligibility.reasons, `Cooldown active (${dedupe.remainingCooldownHours}h remaining)`] : eligibility.reasons,
      dedupe,
    };
  }

  async previewTouchpoint(input: { key: string; applicationId: string }): Promise<{
    key: string;
    applicationId: string;
    context: StudioTemplateContext;
    missingDocs: string[];
    subject: string;
    bodyHtmlPreview: string;
    dedupe: { blocked: boolean; lastConfirmedAt?: string; remainingCooldownHours?: number };
  }> {
    const touchpoint = await this.requireTouchpoint(input.key);
    const context = await this.getStudioContextForApplication(input.applicationId);
    const rendered = this.renderEmailTemplate({ templateKey: input.key, context });
    const dedupe = this.getTouchpointDedupeStatus({ touchpointKey: input.key, applicationId: input.applicationId, cooldownHours: touchpoint.cooldownHours });
    return {
      key: input.key,
      applicationId: input.applicationId,
      context,
      missingDocs: getMissingRequiredDocs(context),
      subject: rendered.subject,
      bodyHtmlPreview: rendered.bodyHtml,
      dedupe,
    };
  }

  async confirmTouchpoint(input: {
    key: string;
    applicationId: string;
    actor?: string;
    override?: boolean;
  }): Promise<{
    key: string;
    applicationId: string;
    campaignId: number;
    followupTaskId?: string;
    overridden: boolean;
    loggedAt: string;
  }> {
    const touchpoint = await this.requireTouchpoint(input.key);
    const context = await this.getStudioContextForApplication(input.applicationId);
    const dedupe = this.getTouchpointDedupeStatus({
      touchpointKey: input.key,
      applicationId: input.applicationId,
      cooldownHours: touchpoint.cooldownHours,
    });
    if (dedupe.blocked && !input.override) {
      this.deps.store.addEvent({
        kind: 'error',
        status: 'error',
        message: `TOUCHPOINT_DEDUPE_BLOCKED ${input.key}`,
        detail: {
          eventType: 'TOUCHPOINT_DEDUPE_BLOCKED',
          touchpointKey: input.key,
          applicationId: input.applicationId,
          lastConfirmedAt: dedupe.lastConfirmedAt,
          remainingCooldownHours: dedupe.remainingCooldownHours,
        },
      });
      throw new Error(
        `Touchpoint cooldown active for ${input.key}. Last confirmed at ${dedupe.lastConfirmedAt}. Use override=true to continue.`,
      );
    }

    const recipient = context.contact.email;
    if (!recipient) {
      throw new Error(`Application ${input.applicationId} has no contact email`);
    }
    const draft = await this.createTemplateDraft({
      templateKey: input.key,
      to: recipient,
      personId: context.contact.id,
      context,
    });

    let followupTaskId: string | undefined;
    if (this.deps.twenty.getDefaultAssigneeId && this.deps.twenty.createWorkflowTask) {
      const assigneeId = await this.deps.twenty.getDefaultAssigneeId();
      if (assigneeId) {
        const dueHours = input.key.includes('documents_request') ? 48 : 24;
        followupTaskId = await this.deps.twenty.createWorkflowTask({
          title: `${context.application.applicationId ?? input.applicationId} Follow up ${input.key}`,
          bodyMarkdown: `Touchpoint: ${input.key}\\nApplication: ${context.application.applicationId ?? input.applicationId}`,
          assigneeId,
          dueAt: new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString(),
          personId: context.contact.id,
          loanApplicationId: context.application.id,
        });
      }
    }

    const loggedAt = nowIso();
    this.setTouchpointDedupe({
      touchpointKey: input.key,
      applicationId: input.applicationId,
      lastConfirmedAt: loggedAt,
    });
    this.deps.store.setState(`touchpoint.lastConfirmed.${input.key}`, loggedAt);
    this.deps.store.addEvent({
      kind: 'engagement',
      status: 'ok',
      message: `TOUCHPOINT_CONFIRMED ${input.key}`,
      detail: {
        eventType: 'TOUCHPOINT_CONFIRMED',
        touchpointKey: input.key,
        applicationId: input.applicationId,
        contactId: context.contact.id,
        actor: input.actor ?? 'operator',
        campaignId: draft.campaignId,
        followupTaskId,
        override: input.override === true,
      },
    });
    if (input.override === true) {
      this.deps.store.addEvent({
        kind: 'engagement',
        status: 'ok',
        message: `TOUCHPOINT_OVERRIDE_USED ${input.key}`,
        detail: {
          eventType: 'TOUCHPOINT_OVERRIDE_USED',
          touchpointKey: input.key,
          applicationId: input.applicationId,
          actor: input.actor ?? 'operator',
        },
      });
    }
    await this.recordEngagement({
      type: 'manual',
      timestamp: loggedAt,
      personId: context.contact.id,
      email: context.contact.email,
      source: 'touchpoint-confirm',
      metadata: {
        touchpointKey: input.key,
        applicationId: input.applicationId,
        actor: input.actor ?? 'operator',
        campaignId: draft.campaignId,
        followupTaskId,
      },
    });

    return {
      key: input.key,
      applicationId: input.applicationId,
      campaignId: draft.campaignId,
      followupTaskId,
      overridden: input.override === true,
      loggedAt,
    };
  }

  async getMortgageCommandCenter(): Promise<{
    generatedAt: string;
    queues: Array<{
      key: string;
      label: string;
      items: Array<
        StudioDashboard['attention'][number] & {
          ageInStageDays: number;
          recommendedTouchpointKey: string;
        }
      >;
    }>;
  }> {
    const dashboard = await this.getStudioDashboard();
    const now = Date.now();
    const rows = await Promise.all(
      dashboard.attention.map(async (row) => {
        const context = await this.getStudioContextForApplication(row.applicationId);
        const updatedAt = context.application.updatedAt;
        const ageInStageDays = updatedAt ? Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))) : 0;
        return {
          ...row,
          ageInStageDays,
          recommendedTouchpointKey: pickRecommendedTouchpointKey(row),
        };
      }),
    );
    const byStage = (stages: string[]) => rows.filter((row) => stages.includes((row.pipelineStage ?? '').toLowerCase()));
    const docsOutstanding = rows.filter((row) => row.pendingRequiredDocs > 0 || (row.pipelineStage ?? '').toLowerCase() === 'docs_requested');
    const upcomingSettlements = rows.filter((row) => {
      if (!row.targetSettlementDate) return false;
      const diffDays = Math.ceil((new Date(row.targetSettlementDate).getTime() - now) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 14;
    });
    return {
      generatedAt: nowIso(),
      queues: [
        { key: 'new_web_leads', label: 'New Web Leads', items: byStage(['lead_captured']) },
        { key: 'awaiting_first_contact', label: 'Awaiting First Contact', items: byStage(['lead_captured', 'discovery_booked']) },
        { key: 'docs_outstanding', label: 'Docs Outstanding', items: docsOutstanding },
        {
          key: 'lender_response_pending',
          label: 'Lender Response Pending',
          items: byStage(['submitted', 'indicative_offer', 'conditional_approval', 'formal_approval']),
        },
        { key: 'upcoming_settlements', label: 'Upcoming Settlements (14 days)', items: upcomingSettlements },
      ],
    };
  }

  getTouchpointAuditSummary(): {
    generatedAt: string;
    draftsCreatedToday: number;
    dedupeBlockedToday: number;
    overridesToday: number;
    touchpointErrorsToday: number;
  } {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const events = this.deps.store.listEvents(200);
    let draftsCreatedToday = 0;
    let dedupeBlockedToday = 0;
    let overridesToday = 0;
    let touchpointErrorsToday = 0;
    for (const event of events) {
      if (!event.createdAt.startsWith(todayPrefix)) continue;
      const eventType = String((event.detail?.eventType as string | undefined) ?? '');
      if (eventType === 'TOUCHPOINT_DRAFT_CREATED') draftsCreatedToday += 1;
      if (eventType === 'TOUCHPOINT_DEDUPE_BLOCKED') dedupeBlockedToday += 1;
      if (eventType === 'TOUCHPOINT_OVERRIDE_USED') overridesToday += 1;
      if (event.status === 'error' && eventType.startsWith('TOUCHPOINT')) touchpointErrorsToday += 1;
    }
    return {
      generatedAt: nowIso(),
      draftsCreatedToday,
      dedupeBlockedToday,
      overridesToday,
      touchpointErrorsToday,
    };
  }

  buildStudioLaunchUrl(context: StudioTemplateContext, templateKey?: string): string {
    const params = new URLSearchParams();
    if (context.contact.id) params.set('personId', context.contact.id);
    if (context.contact.email) params.set('email', context.contact.email);
    if (context.contact.firstName) params.set('firstName', context.contact.firstName);
    if (context.application.applicationId) params.set('applicationId', context.application.applicationId);
    if (context.application.applicationType) params.set('applicationType', context.application.applicationType);
    if (context.application.pipelineStage) params.set('pipelineStage', context.application.pipelineStage);
    if (context.application.lenderTarget) params.set('lenderTarget', context.application.lenderTarget);
    if (context.broker.name) params.set('brokerName', context.broker.name);
    if (context.checklist.requiredSummary) params.set('requiredSummary', context.checklist.requiredSummary);
    params.set('template', templateKey ?? this.recommendTemplateKey(context));
    return `/studio?${params.toString()}`;
  }

  recommendTemplateKey(context: StudioTemplateContext): string {
    const applicationType = context.application.applicationType ?? '';
    const stage = context.application.pipelineStage ?? '';

    if (stage === 'docs_requested') {
      return applicationType === 'commercial_loan' ? 'commercial_documents_request' : 'retail_documents_request';
    }
    if (stage === 'fact_find_complete') return 'fact_find_booking';
    if (stage === 'settled') return 'post_settlement_welcome';
    if (stage === 'conditional_approval' || stage === 'formal_approval') {
      return applicationType === 'commercial_loan' ? 'commercial_submission_confirmation' : 'retail_submission_confirmation';
    }
    if (stage === 'lead_captured' || stage === 'discovery_booked') {
      return applicationType === 'commercial_loan' ? 'commercial_intake_acknowledgement' : 'retail_intake_acknowledgement';
    }
    return applicationType === 'commercial_loan' ? 'commercial_cross_sell' : 'welcome_onboarding';
  }

  async sendTemplateForApplication(input: {
    applicationId: string;
    templateKey?: string;
    to?: string;
    personId?: string;
  }): Promise<{ campaignId: number; testRecipient: string; templateKey: string; applicationId: string }> {
    const context = await this.getStudioContextForApplication(input.applicationId);
    const templateKey = input.templateKey ?? this.recommendTemplateKey(context);
    const to = input.to ?? context.contact.email;
    const personId = input.personId ?? context.contact.id;

    if (!to) {
      throw new Error(`Loan Application ${input.applicationId} has no contact email`);
    }

    const result = await this.sendTemplateCampaign({
      templateKey,
      to,
      personId,
      context,
    });

    return { ...result, applicationId: input.applicationId };
  }

  async runDocsChaseWorkflow(input?: {
    applicationIds?: string[];
    limit?: number;
    createTasks?: boolean;
    sendEmail?: boolean;
    dryRun?: boolean;
  }): Promise<StudioWorkflowRunResult> {
    const dashboard = await this.getStudioDashboard();
    const selected = selectWorkflowRows(dashboard.workflows.find((item) => item.key === 'docs_chase')?.applications ?? [], input?.applicationIds, input?.limit ?? 6);
    return this.runWorkflowRows({
      workflowKey: 'docs_chase',
      rows: selected,
      createTasks: input?.createTasks !== false,
      sendEmail: input?.sendEmail !== false,
      dryRun: input?.dryRun === true,
      templateKeyForRow: (row) => (row.applicationType === 'commercial_loan' ? 'commercial_documents_request' : 'retail_documents_request'),
      buildTaskTitle: (row) => `${row.applicationId} Chase missing documents`,
      buildTaskBody: (context) =>
        `Follow up on missing checklist items for ${context.application.applicationId}.\n\nOutstanding docs: ${
          context.checklist.requiredSummary || 'See checklist'
        }.`,
    });
  }

  async runReviewSweepWorkflow(input?: {
    applicationIds?: string[];
    limit?: number;
    createTasks?: boolean;
    sendEmail?: boolean;
    dryRun?: boolean;
  }): Promise<StudioWorkflowRunResult> {
    const dashboard = await this.getStudioDashboard();
    const selected = selectWorkflowRows(dashboard.workflows.find((item) => item.key === 'review_sweep')?.applications ?? [], input?.applicationIds, input?.limit ?? 6);
    return this.runWorkflowRows({
      workflowKey: 'review_sweep',
      rows: selected,
      createTasks: input?.createTasks !== false,
      sendEmail: input?.sendEmail !== false,
      dryRun: input?.dryRun === true,
      templateKeyForRow: (row) => (row.applicationType === 'commercial_loan' ? 'commercial_cross_sell' : 'annual_review_invite'),
      buildTaskTitle: (row) => `${row.applicationId} Schedule annual review`,
      buildTaskBody: (context) =>
        `Reach out to ${context.application.borrowerName || context.contact.firstName || 'borrower'} for a portfolio review on ${
          context.application.applicationId
        }.`,
    });
  }

  async syncLists(): Promise<Array<{ id: number; name: string }>> {
    const defaultList = await this.bootstrapDefaultList();
    const segments = this.deps.segments ?? [];
    if (segments.length === 0) {
      this.deps.store.addEvent({
        kind: 'sync',
        status: 'ok',
        message: `No segments configured; ensured default list ${defaultList.name}`,
        detail: { listId: defaultList.id, source: 'sync-lists' },
      });
      this.deps.store.setState('sync.contacts.lastRunAt', nowIso());
      return [defaultList];
    }

    const segmentProfiles =
      this.deps.vertical.name === 'mortgage_au' && this.deps.twenty.listMortgageSegmentProfilesByEmail
        ? await this.deps.twenty.listMortgageSegmentProfilesByEmail()
        : new Map<string, { segmentKeys: string[] }>();

    const segmentLists = await Promise.all(
      segments.map(async (segment) => ({
        segment,
        list: await this.deps.listmonk.ensureList({
          name: segment.listName,
          type: segment.list?.type ?? this.deps.vertical.defaultList.type,
          optin: segment.list?.optin ?? this.deps.vertical.defaultList.optin,
          tags: segment.list?.tags ?? [...this.deps.vertical.defaultList.tags, `segment:${segment.key}`],
          description: segment.list?.description ?? segment.description ?? `Segment sync for ${segment.name}`,
        }),
      })),
    );

    const desiredBySegment = new Map<string, Map<string, { contact: ContactRecord; subscriberId?: number }>>();
    const desiredByEmail = new Map<string, { contact: ContactRecord; segmentKeys: string[] }>();
    for (const entry of segmentLists) {
      desiredBySegment.set(entry.segment.key, new Map());
    }

    let cursor: string | undefined;
    let fetched = 0;
    let considered = 0;
    let skippedNoEmail = 0;

    do {
      const page = await this.deps.twenty.listContacts(undefined, cursor);
      const pageContacts = page.contacts ?? [];
      fetched += pageContacts.length;

      for (const rawContact of pageContacts) {
        const contact = mapTwentyContactToContactRecord(rawContact);
        if (!contact) {
          skippedNoEmail += 1;
          continue;
        }
        const profile = segmentProfiles.get(contact.email);
        if (profile) {
          contact.raw = {
            ...(contact.raw ?? {}),
            segmentKeys: profile.segmentKeys,
          };
        }
        considered += 1;
        for (const entry of segmentLists) {
          if (matchesSegment(entry.segment, contact)) {
            desiredBySegment.get(entry.segment.key)!.set(contact.email, { contact });
            const existing = desiredByEmail.get(contact.email);
            if (existing) {
              if (!existing.segmentKeys.includes(entry.segment.key)) existing.segmentKeys.push(entry.segment.key);
            } else {
              desiredByEmail.set(contact.email, { contact, segmentKeys: [entry.segment.key] });
            }
          }
        }
      }

      cursor = page.nextCursor;
    } while (cursor);

    const snapshotKey = `sync.lists.membershipSnapshot.${this.deps.vertical.name}`;
    const previousSnapshot =
      this.deps.store.getState<Record<string, Record<string, { subscriberId?: number }>>>(snapshotKey) ?? {};
    const nextSnapshot: Record<string, Record<string, { subscriberId?: number }>> = {};
    const listResults: Array<{ id: number; name: string }> = [defaultList, ...segmentLists.map((entry) => entry.list)];
    let adds = 0;
    let removes = 0;

    const segmentListIdByKey = new Map(segmentLists.map((entry) => [entry.segment.key, entry.list.id]));

    for (const [email, desired] of desiredByEmail.entries()) {
      const attribs = buildSubscriberAttribs(this.deps.vertical, desired.contact);
      const upsert = await this.deps.listmonk.upsertSubscriber({
        contact: desired.contact,
        listId: defaultList.id,
        attribs,
      });
      const targetListIds = desired.segmentKeys
        .map((segmentKey) => segmentListIdByKey.get(segmentKey))
        .filter((value): value is number => typeof value === 'number');
      if (targetListIds.length > 0) {
        await this.deps.listmonk.addSubscriberToLists(upsert.subscriberId, targetListIds);
      }

      for (const segmentKey of desired.segmentKeys) {
        nextSnapshot[segmentKey] ??= {};
        nextSnapshot[segmentKey][email] = { subscriberId: upsert.subscriberId };
      }
    }

    for (const entry of segmentLists) {
      const segmentKey = entry.segment.key;
      const desiredMap = desiredBySegment.get(segmentKey) ?? new Map();
      const previousMap = previousSnapshot[segmentKey] ?? {};
      nextSnapshot[segmentKey] ??= {};

      for (const email of desiredMap.keys()) {
        if (!(email in previousMap)) adds += 1;
      }

      for (const [email, previous] of Object.entries(previousMap)) {
        if (desiredMap.has(email)) continue;
        let subscriberId = previous.subscriberId;
        if (!subscriberId) {
          const found = await this.deps.listmonk.findSubscriberByEmail(email);
          subscriberId = found?.id;
        }
        if (subscriberId) {
          await this.deps.listmonk.removeSubscriberFromLists(subscriberId, [entry.list.id]);
          removes += 1;
        }
      }
    }

    this.deps.store.setState(snapshotKey, nextSnapshot);
    this.deps.store.setState('sync.lists.lastRunAt', nowIso());
    this.deps.store.addEvent({
      kind: 'sync',
      status: 'ok',
      message: `Segment list sync complete (${segmentLists.length} segments)`,
      detail: { fetched, considered, skippedNoEmail, adds, removes, segments: segmentLists.map((s) => s.segment.key) },
    });
    this.deps.logger?.info(
      { fetched, considered, skippedNoEmail, adds, removes, segments: segmentLists.map((s) => s.segment.key) },
      'segment list sync completed',
    );

    return listResults;
  }

  async syncContact(contact: ContactRecord, source: string): Promise<SyncResult> {
    const list = await this.bootstrapDefaultList();

    const attribs = buildSubscriberAttribs(this.deps.vertical, contact);
    const result = await this.deps.listmonk.upsertSubscriber({ contact, listId: list.id, attribs });

    this.deps.store.addEvent({
      kind: 'sync',
      status: 'ok',
      message: `Synced ${contact.email} to list ${list.name}`,
      detail: {
        source,
        subscriberId: result.subscriberId,
        listId: list.id,
        personId: contact.crmId,
        email: contact.email,
      },
    });

    return {
      ok: true,
      subscriberId: result.subscriberId,
      listId: list.id,
      message: `Synced ${contact.email}`,
    };
  }

  async syncContactsFromTwenty(options?: { maxContacts?: number }): Promise<ContactsSyncRunResult> {
    if (this.contactsSyncInProgress) {
      throw new Error('contacts sync already in progress');
    }
    this.contactsSyncInProgress = true;

    const maxContacts = Math.min(Math.max(options?.maxContacts ?? this.deps.config.sync.maxContactsPerRun, 1), 500);
    const cursorState = this.deps.store.getState<ContactsSyncCursor>('sync.contacts.cursor') ?? {};
    let pageCursor = cursorState.pageCursor;
    const updatedSince = cursorState.updatedSince;

    let fetched = 0;
    let processed = 0;
    let skippedNoEmail = 0;
    let maxSeenUpdatedAt = updatedSince;
    let maxReached = false;

    this.deps.logger?.info({ maxContacts, cursorState }, 'starting contacts sync');

    try {
      while (fetched < maxContacts) {
        const requestCursor = pageCursor;
        const page = await this.deps.twenty.listContacts(updatedSince, requestCursor);
        const contacts = page.contacts ?? [];
        if (contacts.length === 0) {
          pageCursor = undefined;
          break;
        }

        const remaining = maxContacts - fetched;
        const truncated = contacts.length > remaining;
        const batch = truncated ? contacts.slice(0, remaining) : contacts;

        fetched += batch.length;
        for (const rawContact of batch) {
          const mapped = mapTwentyContactToContactRecord(rawContact);
          if (!mapped) {
            skippedNoEmail += 1;
            continue;
          }
          await this.syncContact(mapped, 'twenty-poll-sync');
          processed += 1;
          if (mapped.updatedAt && (!maxSeenUpdatedAt || new Date(mapped.updatedAt) > new Date(maxSeenUpdatedAt))) {
            maxSeenUpdatedAt = mapped.updatedAt;
          }
        }

        if (truncated) {
          // Re-run the same page cursor next time. Upserts are idempotent.
          pageCursor = requestCursor;
          maxReached = true;
          break;
        }

        if (page.nextCursor && fetched < maxContacts) {
          pageCursor = page.nextCursor;
          continue;
        }

        if (page.nextCursor && fetched >= maxContacts) {
          pageCursor = page.nextCursor;
          maxReached = true;
        } else {
          pageCursor = undefined;
        }
        break;
      }

      const nextState: ContactsSyncCursor = maxReached
        ? { updatedSince, pageCursor }
        : { updatedSince: maxSeenUpdatedAt ?? nowIso(), pageCursor: undefined };
      this.deps.store.setState('sync.contacts.cursor', nextState);

      this.deps.store.addEvent({
        kind: 'sync',
        status: 'ok',
        message: `Twenty contacts sync finished (processed=${processed}, skippedNoEmail=${skippedNoEmail})`,
        detail: { fetched, processed, skippedNoEmail, nextState, maxReached },
      });

      this.deps.logger?.info({ fetched, processed, skippedNoEmail, nextState, maxReached }, 'contacts sync completed');

      return {
        ok: true,
        fetched,
        processed,
        skippedNoEmail,
        nextCursor: nextState.pageCursor,
        updatedSince: nextState.updatedSince,
        maxReached,
      };
    } catch (error) {
      this.deps.logger?.error(
        { err: error instanceof Error ? error.message : String(error), fetched, processed, skippedNoEmail, updatedSince, pageCursor },
        'contacts sync failed',
      );
      throw error;
    } finally {
      this.contactsSyncInProgress = false;
    }
  }

  async handleTwentyWebhook(payload: TwentyWebhookPayload): Promise<{ accepted: boolean; duplicate?: boolean; synced?: boolean; reason?: string }> {
    const key = createIdempotencyKey(payload);
    if (this.deps.store.hasSeen(key)) {
      return { accepted: true, duplicate: true, reason: 'duplicate webhook' };
    }
    this.deps.store.remember(key);

    const contact = extractContactFromTwentyWebhook(payload);
    if (!contact) {
      return { accepted: true, synced: false, reason: 'ignored (not a person.* event with email)' };
    }

    await this.syncContact(contact, 'twenty-webhook');
    return { accepted: true, synced: true };
  }

  async handleListmonkWebhook(
    payload: Record<string, unknown>,
  ): Promise<{ accepted: true; ignored?: boolean; duplicate?: boolean; reason?: string }> {
    const normalized = parseListmonkWebhookPayload(payload);
    if (!normalized) {
      return { accepted: true, ignored: true, reason: 'unsupported webhook payload' };
    }

    const dedupKey = sha256Hex(
      [
        normalized.eventType,
        normalized.timestamp,
        normalized.email ?? '',
        normalized.twentyId ?? '',
        normalized.campaignId ?? '',
        normalized.url ?? '',
        normalized.reason ?? '',
      ].join('|'),
    );
    const ttlMs = this.deps.config.listmonkWebhookDedupTtlSeconds * 1000;
    if (this.deps.store.hasRecentKey(dedupKey)) {
      return { accepted: true, duplicate: true, reason: 'duplicate listmonk webhook event' };
    }
    this.deps.store.rememberKeyWithTtl(dedupKey, ttlMs);

    let personId = normalized.twentyId;
    if (!personId && normalized.email && this.deps.twenty.getContactByEmail) {
      const contact = await this.deps.twenty.getContactByEmail(normalized.email);
      personId = getString(contact?.id) ?? undefined;
    }

    const mapped = mapListmonkEventToEngagement(normalized);
    await this.recordEngagement({
      type: mapped.type,
      crmActivityType: mapped.crmActivityType,
      timestamp: normalized.timestamp,
      personId: personId ?? undefined,
      email: normalized.email ?? undefined,
      campaignId: normalized.campaignId ?? undefined,
      campaignName: normalized.campaignName ?? undefined,
      targetUrl: normalized.url ?? undefined,
      source: 'listmonk-webhook',
      metadata: {
        reason: normalized.reason,
        rawEventType: normalized.eventType,
        campaignName: normalized.campaignName,
      },
    });

    return { accepted: true };
  }

  async syncPersonById(id: string): Promise<SyncResult> {
    const person = await this.deps.twenty.fetchPersonById(id);
    const email = getString(person.email) ?? getString(person.primaryEmail);
    if (!email) {
      throw new Error('Person record has no email');
    }
    const contact: ContactRecord = {
      crmId: getString(person.id) ?? id,
      email: email.toLowerCase(),
      firstName: getString(person.firstName) ?? undefined,
      lastName: getString(person.lastName) ?? undefined,
      fullName: [getString(person.firstName), getString(person.lastName)].filter(Boolean).join(' ') || undefined,
      raw: person,
    };
    return this.syncContact(contact, 'manual-person-sync');
  }

  async sendTestCampaign(input: {
    to: string;
    subject: string;
    bodyHtml?: string;
    personId?: string;
    campaignName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ campaignId: number; testRecipient: string }> {
    const list = await this.bootstrapDefaultList();
    const html = this.buildTrackedEmailBody({
      to: input.to,
      personId: input.personId,
      bodyHtml: input.bodyHtml,
      metadata: input.metadata,
    });

    const campaignName = buildSafeCampaignName(input.campaignName);

    const campaign = await this.deps.listmonk.createCampaign({
      name: campaignName,
      subject: input.subject,
      listIds: [list.id],
      body: html,
      tags: [...this.deps.vertical.defaultList.tags, 'connector-test'],
    });

    await this.deps.listmonk.sendCampaignTest(campaign.id, {
      subscribers: [input.to],
      name: campaignName,
      subject: input.subject,
      listIds: [list.id],
      body: html,
      tags: [...this.deps.vertical.defaultList.tags, 'connector-test'],
    });

    this.deps.store.addEvent({
      kind: 'campaign',
      status: 'ok',
      message: `Sent test campaign ${campaign.id} to ${input.to}`,
      detail: { campaignId: campaign.id, to: input.to, listId: list.id },
    });

    return { campaignId: campaign.id, testRecipient: input.to };
  }

  async sendTemplateCampaign(input: {
    templateKey: string;
    to: string;
    personId?: string;
    context?: Record<string, unknown>;
  }): Promise<{ campaignId: number; testRecipient: string; templateKey: string }> {
    const rendered = this.renderEmailTemplate({
      templateKey: input.templateKey,
      context: input.context,
    });
    const application = (input.context?.application as Record<string, unknown> | undefined) ?? {};
    const metadata = {
      applicationId: getString(application.applicationId) ?? getString(application.id),
      applicationType: getString(application.applicationType),
      pipelineStage: getString(application.pipelineStage),
    };

    const result = await this.sendTestCampaign({
      to: input.to,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      personId: input.personId,
      campaignName: rendered.name,
      metadata,
    });

    return { ...result, templateKey: input.templateKey };
  }

  async createTemplateDraft(input: {
    templateKey: string;
    to: string;
    personId?: string;
    context?: Record<string, unknown>;
    campaignName?: string;
  }): Promise<{ campaignId: number; templateKey: string; recipient: string }> {
    const rendered = this.renderEmailTemplate({
      templateKey: input.templateKey,
      context: input.context,
    });
    const list = await this.bootstrapDefaultList();
    const application = (input.context?.application as Record<string, unknown> | undefined) ?? {};
    const metadata = {
      applicationId: getString(application.applicationId) ?? getString(application.id),
      applicationType: getString(application.applicationType),
      pipelineStage: getString(application.pipelineStage),
      touchpointKey: input.templateKey,
    };
    const html = this.buildTrackedEmailBody({
      to: input.to,
      personId: input.personId,
      bodyHtml: rendered.bodyHtml,
      metadata,
    });
    const campaign = await this.deps.listmonk.createCampaign({
      name: buildSafeCampaignName(input.campaignName ?? `${rendered.name} Draft`),
      subject: rendered.subject,
      listIds: [list.id],
      body: html,
      tags: [...this.deps.vertical.defaultList.tags, 'touchpoint-draft'],
    });
    this.deps.store.addEvent({
      kind: 'campaign',
      status: 'ok',
      message: `TOUCHPOINT_DRAFT_CREATED ${input.templateKey}`,
      detail: {
        eventType: 'TOUCHPOINT_DRAFT_CREATED',
        campaignId: campaign.id,
        templateKey: input.templateKey,
        recipient: input.to,
      },
    });
    return { campaignId: campaign.id, templateKey: input.templateKey, recipient: input.to };
  }

  async recordEngagement(event: Omit<EngagementEvent, 'timestamp'> & { timestamp?: string }) {
    const full: EngagementEvent = { ...event, timestamp: event.timestamp ?? nowIso() };

    try {
      await this.deps.twenty.writeEngagement(full);
      this.deps.store.addEvent({
        kind: 'engagement',
        status: 'ok',
        message: `Recorded ${full.type} engagement${full.email ? ` for ${full.email}` : ''}`,
        detail: {
          type: full.type,
          personId: full.personId,
          email: full.email,
          campaignId: full.campaignId,
          campaignName: full.campaignName,
          targetUrl: full.targetUrl,
          crmActivityType: full.crmActivityType,
          source: full.source,
          metadata: full.metadata,
        },
      });
      return { ok: true };
    } catch (error) {
      this.deps.store.addEvent({
        kind: 'error',
        status: 'error',
        message: `Engagement writeback failed: ${error instanceof Error ? error.message : String(error)}`,
        detail: { type: full.type, personId: full.personId, email: full.email },
      });
      throw error;
    }
  }

  private async getEligibleTouchpointsByKey(): Promise<Map<string, StudioDashboard['attention']>> {
    const touchpoints = await this.getTouchpoints();
    const dashboard = await this.getStudioDashboard();
    const now = new Date();
    const result = new Map<string, StudioDashboard['attention']>();
    for (const touchpoint of touchpoints) {
      const rows: StudioDashboard['attention'] = [];
      for (const row of dashboard.attention) {
        if (touchpoint.eligibility.manualOnly) continue;
        const context = await this.getStudioContextForApplication(row.applicationId);
        const eligibility = evaluateTouchpointEligibility(touchpoint, {
          context,
          row,
          now,
          consentMarketing: true,
          updatedAt: context.application.updatedAt ?? undefined,
        });
        if (!eligibility.eligible) continue;
        const dedupe = this.getTouchpointDedupeStatus({
          touchpointKey: touchpoint.key,
          applicationId: row.applicationId,
          cooldownHours: touchpoint.cooldownHours,
        });
        rows.push({
          ...row,
          recommendedTemplateKey: dedupe.blocked ? `${row.recommendedTemplateKey} (cooldown)` : row.recommendedTemplateKey,
        });
      }
      result.set(touchpoint.key, rows);
    }
    return result;
  }

  private getTouchpointStoreKey(touchpointKey: string, applicationId: string): string {
    return `touchpoint.confirmed.${touchpointKey}.${applicationId}`;
  }

  private setTouchpointDedupe(input: { touchpointKey: string; applicationId: string; lastConfirmedAt: string }): void {
    this.deps.store.setState(this.getTouchpointStoreKey(input.touchpointKey, input.applicationId), {
      lastConfirmedAt: input.lastConfirmedAt,
    });
  }

  private getTouchpointDedupeStatus(input: {
    touchpointKey: string;
    applicationId: string;
    cooldownHours: number;
  }): { blocked: boolean; lastConfirmedAt?: string; remainingCooldownHours?: number } {
    const state = this.deps.store.getState<{ lastConfirmedAt?: string }>(
      this.getTouchpointStoreKey(input.touchpointKey, input.applicationId),
    );
    const last = state?.lastConfirmedAt;
    if (!last) return { blocked: false };
    const elapsedMs = Date.now() - new Date(last).getTime();
    const cooldownMs = input.cooldownHours * 60 * 60 * 1000;
    if (elapsedMs >= cooldownMs) return { blocked: false, lastConfirmedAt: last };
    const remaining = Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000));
    return { blocked: true, lastConfirmedAt: last, remainingCooldownHours: remaining };
  }

  private async requireTouchpoint(key: string): Promise<MortgageTouchpoint> {
    const touchpoints = await this.getTouchpoints();
    const touchpoint = touchpoints.find((item) => item.key === key);
    if (!touchpoint) {
      throw new Error(`Unknown touchpoint key '${key}'`);
    }
    return touchpoint;
  }

  private requireEmailTemplate(templateKey: string): EmailTemplateDefinition {
    const template = (this.deps.emailTemplates ?? []).find((entry) => entry.key === templateKey);
    if (!template) {
      throw new Error(`Unknown email template '${templateKey}'`);
    }
    return template;
  }

  private buildTrackedEmailBody(input: {
    to: string;
    personId?: string;
    bodyHtml?: string;
    metadata?: Record<string, unknown>;
  }): string {
    const trackingBase = this.deps.config.publicTrackingBaseUrl;
    const openUrl = new URL('/track/open.gif', trackingBase);
    const clickUrl = new URL('/track/click', trackingBase);

    openUrl.searchParams.set('email', input.to);
    clickUrl.searchParams.set('url', 'https://example.com');
    clickUrl.searchParams.set('email', input.to);
    if (input.personId) {
      openUrl.searchParams.set('personId', input.personId);
      clickUrl.searchParams.set('personId', input.personId);
    }
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      openUrl.searchParams.set(key, String(value));
      clickUrl.searchParams.set(key, String(value));
    }

    const baseHtml =
      input.bodyHtml ??
      `<p>Hello from CRM + listmonk connector.</p><p><a href="${clickUrl.toString()}">Tracked link</a></p>`;

    return `${baseHtml}<img src="${openUrl.toString()}" alt=\"\" width=\"1\" height=\"1\" />`;
  }

  private async runWorkflowRows(input: {
    workflowKey: string;
    rows: Array<{
      applicationId: string;
      personId?: string;
      applicationType?: string | null;
      recommendedTemplateKey: string;
    }>;
    createTasks: boolean;
    sendEmail: boolean;
    dryRun: boolean;
    templateKeyForRow?(row: { applicationId: string; personId?: string; applicationType?: string | null; recommendedTemplateKey: string }): string;
    buildTaskTitle(row: { applicationId: string }): string;
    buildTaskBody(context: StudioTemplateContext): string;
  }): Promise<StudioWorkflowRunResult> {
    const existingTaskTitles = new Set(await (this.deps.twenty.listOpenTaskTitles?.() ?? Promise.resolve([])));
    const assigneeId = input.createTasks ? await this.deps.twenty.getDefaultAssigneeId?.() : undefined;
    const results: StudioWorkflowRunResult['results'] = [];
    let taskCount = 0;
    let sentCount = 0;
    let skippedCount = 0;

    for (const row of input.rows) {
      const context = await this.getStudioContextForApplication(row.applicationId);
      const taskTitle = input.buildTaskTitle(row);
      let taskId: string | undefined;
      let campaignId: number | undefined;
      let templateKey: string | undefined;
      let taskPlanned = false;
      let emailPlanned = false;
      let skipReason: string | undefined;

      if (input.createTasks && assigneeId && this.deps.twenty.createWorkflowTask) {
        if (existingTaskTitles.has(taskTitle)) {
          skipReason = 'existing open task';
        } else if (!input.dryRun) {
          taskId = await this.deps.twenty.createWorkflowTask({
            title: taskTitle,
            bodyMarkdown: input.buildTaskBody(context),
            assigneeId,
            dueAt: workflowDueAt(input.workflowKey),
            personId: context.contact.id,
            loanApplicationId: context.application.id,
          });
          existingTaskTitles.add(taskTitle);
          taskCount += 1;
          taskPlanned = true;
        } else {
          taskId = 'dry-run';
          taskCount += 1;
          taskPlanned = true;
        }
      }

      if (input.sendEmail && context.contact.email) {
        templateKey = input.templateKeyForRow?.(row) ?? row.recommendedTemplateKey;
        emailPlanned = true;
        if (!input.dryRun) {
          const sent = await this.sendTemplateCampaign({
            templateKey,
            to: context.contact.email,
            personId: context.contact.id,
            context,
          });
          campaignId = sent.campaignId;
        }
        sentCount += 1;
      } else if (input.sendEmail) {
        skipReason = skipReason ?? 'no reachable email';
      }

      const action =
        taskPlanned && emailPlanned ? 'sent_and_task' : emailPlanned ? 'sent' : taskPlanned ? 'task' : 'skipped';
      if (action === 'skipped') skippedCount += 1;
      results.push({
        applicationId: row.applicationId,
        action,
        templateKey,
        ...(taskPlanned ? { taskId } : {}),
        ...(emailPlanned && campaignId ? { campaignId } : {}),
        ...(action === 'skipped' ? { reason: skipReason ?? 'existing task or no reachable email' } : {}),
      });
    }

    this.deps.store.addEvent({
      kind: 'sync',
      status: 'ok',
      message: `Workflow ${input.workflowKey} processed ${input.rows.length} applications`,
      detail: { workflowKey: input.workflowKey, taskCount, sentCount, skippedCount },
    });

    return {
      workflowKey: input.workflowKey,
      dryRun: input.dryRun,
      processed: input.rows.length,
      taskCount,
      sentCount,
      skippedCount,
      results,
    };
  }
}

function workflowDueAt(workflowKey: string): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + (workflowKey === 'review_sweep' ? 7 : 2));
  return date.toISOString();
}

function selectWorkflowRows<T extends { applicationId: string }>(rows: T[], applicationIds?: string[], limit = 6): T[] {
  const requested = new Set((applicationIds ?? []).filter(Boolean));
  if (requested.size > 0) return rows.filter((row) => requested.has(row.applicationId));
  return rows.slice(0, limit);
}

const listmonkWebhookEventSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  eventType: z.string().optional(),
  timestamp: z.string().optional(),
  ts: z.string().optional(),
  campaign: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string().optional(),
    })
    .partial()
    .optional(),
  campaign_id: z.union([z.string(), z.number()]).optional(),
  campaignId: z.union([z.string(), z.number()]).optional(),
  campaign_name: z.string().optional(),
  campaignName: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  reason: z.string().optional(),
  subscriber: z
    .object({
      email: z.string().optional(),
      attribs: z.record(z.unknown()).optional(),
    })
    .partial()
    .optional(),
  email: z.string().optional(),
  attribs: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
});

type NormalizedListmonkWebhook = {
  eventType: string;
  timestamp: string;
  email?: string;
  twentyId?: string;
  campaignId?: string;
  campaignName?: string;
  url?: string;
  reason?: string;
};

function parseListmonkWebhookPayload(payload: Record<string, unknown>): NormalizedListmonkWebhook | null {
  const parsed = listmonkWebhookEventSchema.safeParse(payload);
  if (!parsed.success) return null;

  const p = parsed.data;
  const data = (p.data ?? {}) as Record<string, unknown>;
  const eventType = normalizeListmonkEventType(
    getString(p.event) ??
      getString(p.type) ??
      getString(p.eventType) ??
      getString(data.event) ??
      getString(data.type) ??
      '',
  );
  if (!eventType) return null;

  const subscriberAttribs =
    (p.subscriber?.attribs as Record<string, unknown> | undefined) ??
    (p.attribs as Record<string, unknown> | undefined) ??
    ((data.subscriber as Record<string, unknown> | undefined)?.attribs as Record<string, unknown> | undefined) ??
    (data.attribs as Record<string, unknown> | undefined);
  const subscriber =
    (p.subscriber as Record<string, unknown> | undefined) ??
    ((data.subscriber as Record<string, unknown> | undefined) ?? undefined);

  const email =
    getString(p.email) ??
    getString(subscriber?.email) ??
    getString(data.email) ??
    getString((data.subscriber as Record<string, unknown> | undefined)?.email);

  const twentyId =
    getString(subscriberAttribs?.twentyId) ??
    getString(subscriberAttribs?.twentyPersonId) ??
    getString(data.twentyId) ??
    getString(data.personId);

  const campaignIdValue =
    p.campaign?.id ?? p.campaignId ?? p.campaign_id ?? data.campaignId ?? data.campaign_id ?? (data.campaign as Record<string, unknown> | undefined)?.id;
  const campaignId = campaignIdValue !== undefined && campaignIdValue !== null ? String(campaignIdValue) : undefined;

  const campaignName =
    getString(p.campaign?.name) ??
    getString(p.campaignName) ??
    getString(p.campaign_name) ??
    getString((data.campaign as Record<string, unknown> | undefined)?.name) ??
    getString(data.campaignName);

  const url = getString(p.url) ?? getString(p.link) ?? getString(data.url) ?? getString(data.link);
  const reason = getString(p.reason) ?? getString(data.reason);
  const timestamp = getString(p.timestamp) ?? getString(p.ts) ?? getString(data.timestamp) ?? nowIso();

  return {
    eventType,
    timestamp,
    email: email?.toLowerCase(),
    twentyId: twentyId ?? undefined,
    campaignId,
    campaignName: campaignName ?? undefined,
    url: url ?? undefined,
    reason: reason ?? undefined,
  };
}

function normalizeListmonkEventType(raw: string): 'open' | 'click' | 'bounce' | 'unsubscribe' | null {
  const value = raw.toLowerCase();
  if (value.includes('open')) return 'open';
  if (value.includes('click')) return 'click';
  if (value.includes('bounce')) return 'bounce';
  if (value.includes('unsub')) return 'unsubscribe';
  return null;
}

function mapListmonkEventToEngagement(input: NormalizedListmonkWebhook): {
  type: EngagementEvent['type'];
  crmActivityType: NonNullable<EngagementEvent['crmActivityType']>;
} {
  if (input.eventType === 'open') return { type: 'open', crmActivityType: 'EMAIL_OPEN' };
  if (input.eventType === 'click') return { type: 'click', crmActivityType: 'EMAIL_CLICK' };
  if (input.eventType === 'bounce') return { type: 'bounce', crmActivityType: 'EMAIL_BOUNCE' };
  return { type: 'unsubscribe', crmActivityType: 'EMAIL_UNSUB' };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      const items = value
        .map((entry) => {
          if (typeof entry === 'string') return entry.trim();
          if (entry && typeof entry === 'object') {
            const rec = entry as Record<string, unknown>;
            return getString(rec.name) ?? getString(rec.label) ?? getString(rec.value) ?? '';
          }
          return '';
        })
        .filter(Boolean);
      if (items.length > 0) return Array.from(new Set(items));
    }
    if (typeof value === 'string' && value.trim()) {
      return Array.from(
        new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      );
    }
  }
  return [];
}

export function mapTwentyContactToContactRecord(raw: Record<string, unknown>): ContactRecord | null {
  const emails = (raw.emails as Record<string, unknown> | undefined) ?? {};
  const nameRecord = (raw.name as Record<string, unknown> | undefined) ?? {};
  const phones = (raw.phones as Record<string, unknown> | undefined) ?? {};

  const email = pickString(raw, ['email', 'primaryEmail']) ?? pickString(emails, ['primaryEmail']);
  if (!email) return null;

  const firstName = pickString(raw, ['firstName']) ?? pickString(nameRecord, ['firstName']);
  const lastName = pickString(raw, ['lastName']) ?? pickString(nameRecord, ['lastName']);
  const fullName =
    pickString(raw, ['fullName']) ?? ([firstName, lastName].filter(Boolean).join(' ').trim() || undefined);

  return {
    crmId: pickString(raw, ['id']),
    email: email.toLowerCase(),
    firstName,
    lastName,
    fullName,
    phone:
      pickString(raw, ['phone', 'phoneNumber', 'mobilePhone']) ??
      pickString(phones, ['primaryPhoneNumber']),
    tags: pickStringArray(raw, ['tags', 'tagNames', 'labels']),
    updatedAt: pickString(raw, ['updatedAt']),
    raw,
  };
}

function matchesSegment(segment: SegmentDefinition, contact: ContactRecord): boolean {
  const mode = segment.match ?? 'all';
  const checks = segment.rules.map((rule) => evaluateSegmentRule(rule, contact));
  return mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}

function evaluateSegmentRule(
  rule: SegmentDefinition['rules'][number],
  contact: ContactRecord,
): boolean {
  const value = readContactField(contact, rule.field);
  if (rule.op === 'exists') {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && `${value}`.trim() !== '';
  }

  if (rule.op === 'includes') {
    if (Array.isArray(value)) {
      return value.some((item) => `${item}`.toLowerCase() === `${rule.value ?? ''}`.toLowerCase());
    }
    if (typeof value === 'string') {
      return value.toLowerCase().includes(`${rule.value ?? ''}`.toLowerCase());
    }
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => `${item}` === `${rule.value ?? ''}`);
  }
  return `${value ?? ''}` === `${rule.value ?? ''}`;
}

function readContactField(contact: ContactRecord, field: string): unknown {
  if (field === 'segmentKeys') {
    const raw = (contact.raw ?? {}) as Record<string, unknown>;
    return Array.isArray(raw.segmentKeys) ? raw.segmentKeys : [];
  }
  if (field === 'tags') return contact.tags ?? [];
  if (field === 'email') return contact.email;
  if (field === 'phone') return contact.phone;
  if (field === 'firstName') return contact.firstName;
  if (field === 'lastName') return contact.lastName;
  if (field === 'fullName') return contact.fullName;
  if (field === 'crmId' || field === 'twentyId') return contact.crmId;

  const raw = (contact.raw ?? {}) as Record<string, unknown>;
  return raw[field];
}
