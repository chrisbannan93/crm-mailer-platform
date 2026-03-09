import type { AppConfig } from '../config/env.js';
import type {
  EngagementEvent,
  PublicLead,
  PublicLeadResult,
  StudioDashboard,
  StudioTemplateContext,
} from '../types/index.js';

export type TwentyContact = Record<string, unknown> & {
  id?: string;
  email?: string;
  primaryEmail?: string;
  updatedAt?: string;
};

export type TwentyListContactsResult = {
  contacts: TwentyContact[];
  nextCursor?: string;
};

type MortgageApplicationNode = {
  id?: string;
  applicationid?: string;
  applicationtype?: string | null;
  pipelinestage?: string | null;
  borrowername?: string;
  brokerowner?: string;
  loanpurpose?: string | null;
  loanamount?: { amountMicros?: number | null; currencyCode?: string | null } | null;
  estimatedpropertyvalue?: { amountMicros?: number | null; currencyCode?: string | null } | null;
  lvrband?: string | null;
  targetsettlementdate?: string | null;
  lendertarget?: string;
  occupancytype?: string | null;
  firsthomebuyer?: boolean;
  entityname?: string;
  entitytype?: string | null;
  abn?: string;
  securitytype?: string | null;
  notessummary?: string;
  updatedAt?: string;
  contactperson?: {
    edges?: Array<{
      node?: {
        id?: string;
        name?: { firstName?: string; lastName?: string };
        emails?: { primaryEmail?: string };
      };
    }>;
  };
  documents?: {
    edges?: Array<{
      node?: {
        id?: string;
        documentLabel?: string;
        required?: boolean;
        status?: string | null;
        ownerrole?: string | null;
        notes?: string;
        recievedat?: string | null;
        validatedat?: string | null;
      };
    }>;
  };
};

type MortgageSegmentProfile = {
  segmentKeys: string[];
};

type MortgageTaskNode = {
  id?: string;
  title?: string;
  status?: string | null;
  dueAt?: string | null;
};

type MortgageDashboardApp = {
  context: StudioTemplateContext;
  pendingRequiredDocs: number;
};

export class TwentyClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'TwentyClientError';
  }
}

export class TwentyClient {
  constructor(private readonly config: AppConfig['twenty']) {}

  async listContacts(updatedSince?: string, pageCursor?: string): Promise<TwentyListContactsResult> {
    const query = new URLSearchParams();
    // Twenty REST APIs are generated per workspace; these params are best-effort and may be ignored.
    if (pageCursor) query.set('cursor', pageCursor);
    if (updatedSince) {
      query.set('updatedSince', updatedSince);
      query.set('updated_at_gte', updatedSince);
    }
    query.set('limit', '100');

    const path = `${this.config.restPath}/people${query.toString() ? `?${query.toString()}` : ''}`;
    const raw = await this.request<unknown>(path);
    const contacts = this.extractContactArray(raw).filter((contact) => {
      if (!updatedSince) return true;
      const updatedAt = typeof contact.updatedAt === 'string' ? contact.updatedAt : undefined;
      if (!updatedAt) return true;
      return new Date(updatedAt).getTime() >= new Date(updatedSince).getTime();
    });

    return {
      contacts,
      nextCursor: this.extractNextCursor(raw),
    };
  }

  async getContactByEmail(email: string): Promise<TwentyContact | null> {
    const target = email.trim().toLowerCase();
    let cursor: string | undefined;
    let pages = 0;

    // Safe fallback: page through contacts and filter locally.
    do {
      const { contacts, nextCursor } = await this.listContacts(undefined, cursor);
      const found = contacts.find((contact) => {
        const candidates = [contact.email, contact.primaryEmail].filter((v): v is string => typeof v === 'string');
        return candidates.some((value) => value.trim().toLowerCase() === target);
      });
      if (found) return found;
      cursor = nextCursor;
      pages += 1;
    } while (cursor && pages < 20);

    return null;
  }

  async fetchPersonById(id: string): Promise<Record<string, unknown>> {
    if (!this.getAuthToken()) {
      throw new Error('TWENTY_AUTH_TOKEN or TWENTY_API_KEY is required for manual person sync');
    }
    return this.request<Record<string, unknown>>(`${this.config.restPath}/people/${id}`);
  }

  async getStudioContextForApplication(applicationId: string): Promise<StudioTemplateContext | null> {
    const applications = await this.listMortgageApplicationNodes();
    const match = applications.find((item) => item.applicationid === applicationId || item.id === applicationId);
    return match ? mapMortgageApplicationNodeToContext(match) : null;
  }

  async getStudioContextForPerson(personId: string): Promise<StudioTemplateContext | null> {
    const applications = await this.listMortgageApplicationNodes();
    const matches = applications
      .filter((item) => {
        const contactId = item.contactperson?.edges?.[0]?.node?.id;
        return contactId === personId;
      })
      .sort((left, right) => rankMortgageApplication(right) - rankMortgageApplication(left));

    if (matches.length > 0) {
      return mapMortgageApplicationNodeToContext(matches[0]);
    }

    const person = await this.fetchPersonById(personId);
    return {
      contact: {
        id: getString(person.id),
        firstName: getString((person.name as Record<string, unknown> | undefined)?.firstName) ?? getString(person.firstName),
        lastName: getString((person.name as Record<string, unknown> | undefined)?.lastName) ?? getString(person.lastName),
        email:
          getString((person.emails as Record<string, unknown> | undefined)?.primaryEmail) ??
          getString(person.email) ??
          getString(person.primaryEmail),
      },
      broker: {},
      application: {},
      checklist: { requiredSummary: '', items: [] },
    };
  }

  async listMortgageSegmentProfilesByEmail(): Promise<Map<string, MortgageSegmentProfile>> {
    const applications = await this.listMortgageApplicationNodes();
    const profiles = new Map<string, Set<string>>();

    for (const application of applications) {
      const email = application.contactperson?.edges?.[0]?.node?.emails?.primaryEmail?.trim().toLowerCase();
      if (!email) continue;

      const set = profiles.get(email) ?? new Set<string>();
      if (application.applicationtype === 'RETAIL_HOME_LOAN') set.add('retail_home_loans');
      if (application.applicationtype === 'COMMERCIAL_LOAN') set.add('commercial_loans');
      if (isSubmittedLikeStage(application.pipelinestage)) set.add('submitted');
      if (hasPendingRequiredDocuments(application)) set.add('docs_pending');
      if (isSettledWithinDays(application, 90)) set.add('settled_last_90_days');
      if (isAnnualReviewDue(application)) set.add('annual_review_due');
      if (isFixedRateExpiryCandidate(application)) set.add('fixed_rate_expiry');
      profiles.set(email, set);
    }

    return new Map(
      Array.from(profiles.entries()).map(([email, segmentKeys]) => [email, { segmentKeys: Array.from(segmentKeys) }]),
    );
  }

  async getMortgageDashboard(): Promise<StudioDashboard> {
    const applications = await this.listMortgageApplicationNodes();
    const mapped = applications.map((application) => ({
      context: mapMortgageApplicationNodeToContext(application),
      pendingRequiredDocs: countPendingRequiredDocuments(application),
    }));

    const metrics = [
      { key: 'total_applications', label: 'Loan Applications', value: mapped.length },
      {
        key: 'active_applications',
        label: 'Active Files',
        value: mapped.filter((item) => !['settled', 'closed_lost'].includes(item.context.application.pipelineStage ?? '')).length,
      },
      {
        key: 'settled_applications',
        label: 'Settled',
        value: mapped.filter((item) => item.context.application.pipelineStage === 'settled').length,
      },
      {
        key: 'docs_pending',
        label: 'Docs Pending',
        value: mapped.filter((item) => item.pendingRequiredDocs > 0).length,
      },
      {
        key: 'submitted_plus',
        label: 'Submitted+',
        value: mapped.filter((item) => ['submitted', 'conditional_approval', 'formal_approval'].includes(item.context.application.pipelineStage ?? '')).length,
      },
      {
        key: 'review_queue',
        label: 'Review Queue',
        value: mapped.filter((item) => isReviewCandidate(item.context)).length,
      },
    ];

    const pipelineMap = new Map<string, number>();
    for (const item of mapped) {
      const stage = item.context.application.pipelineStage ?? 'unknown';
      pipelineMap.set(stage, (pipelineMap.get(stage) ?? 0) + 1);
    }

    const workflowDocs = mapped
      .filter((item) => isDocsChaseCandidate(item.context, item.pendingRequiredDocs))
      .sort((left, right) => right.pendingRequiredDocs - left.pendingRequiredDocs || compareApplications(left.context, right.context));
    const workflowReview = mapped
      .filter((item) => isReviewCandidate(item.context))
      .sort((left, right) => compareApplications(left.context, right.context));

    return {
      metrics,
      pipeline: Array.from(pipelineMap.entries())
        .map(([key, count]) => ({ key, label: prettifyEnum(key), count }))
        .sort((left, right) => right.count - left.count),
      attention: mapped
        .filter((item) => item.pendingRequiredDocs > 0 || isSubmittedLikeStage((item.context.application.pipelineStage ?? '').toUpperCase()))
        .sort((left, right) => right.pendingRequiredDocs - left.pendingRequiredDocs || compareApplications(left.context, right.context))
        .slice(0, 8)
        .map((item) => mapDashboardRow(item.context, item.pendingRequiredDocs)),
      workflows: [
        {
          key: 'docs_chase',
          label: 'Docs Chase',
          count: workflowDocs.length,
          applications: workflowDocs.slice(0, 6).map((item) => mapDashboardRow(item.context, item.pendingRequiredDocs)),
        },
        {
          key: 'review_sweep',
          label: 'Review Sweep',
          count: workflowReview.length,
          applications: workflowReview.slice(0, 6).map((item) => mapDashboardRow(item.context, item.pendingRequiredDocs)),
        },
      ],
    };
  }

  async createPublicLead(lead: PublicLead): Promise<PublicLeadResult> {
    return this.createMortgageWebsiteLead(lead);
  }

  async createMortgageWebsiteLead(lead: PublicLead): Promise<PublicLeadResult> {
    const now = new Date().toISOString();
    const existing = await this.getContactByEmail(lead.email);

    let personId = getString(existing?.id) ?? undefined;
    if (!personId) {
      const created = await this.graphqlRequest<{ createPerson?: { id?: string } }>(
        `
          mutation CreatePublicLead($data: PersonCreateInput!) {
            createPerson(data: $data) {
              id
            }
          }
        `,
        {
          data: {
            name: {
              firstName: lead.firstName,
              ...(lead.lastName ? { lastName: lead.lastName } : {}),
            },
            emails: {
              primaryEmail: lead.email,
            },
            ...(lead.phone
              ? {
                  phones: {
                    primaryPhoneNumber: lead.phone,
                    primaryPhoneCountryCode: 'AU',
                    primaryPhoneCallingCode: '+61',
                  },
                }
              : {}),
            ...(lead.loanType ? { jobTitle: `${lead.loanType} enquiry` } : {}),
            createdAt: now,
            updatedAt: now,
          },
        },
      );
      personId = created.createPerson?.id;
    }

    if (!personId) {
      throw new Error('Twenty person upsert did not return an id');
    }

    const applicationType =
      (lead.loanType ?? '').toLowerCase().includes('commercial') ? 'commercial_loan' : 'retail_home_loan';
    const applicationId = `WEB-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)}`;

    const createdApplication = await this.graphqlRequest<{ createLoanApplication?: { id?: string } }>(
      `
        mutation CreateLoanApplication($data: LoanApplicationCreateInput!) {
          createLoanApplication(data: $data) {
            id
          }
        }
      `,
      {
        data: {
          applicationid: applicationId,
          applicationtype: applicationType,
          pipelinestage: 'lead_captured',
          borrowername: [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email,
          contactpersonrecordid: personId,
          loanpurpose: 'purchase',
          notessummary: this.buildRichText(lead.message ?? 'Website enquiry'),
          updatedAt: now,
          createdAt: now,
        },
      },
    );

    const loanApplicationId = createdApplication.createLoanApplication?.id;
    if (!loanApplicationId) {
      throw new Error('Twenty loan application creation did not return an id');
    }

    const note = await this.graphqlRequest<{ createNote?: { id?: string } }>(
      `
        mutation CreatePublicLeadNote($data: NoteCreateInput!) {
          createNote(data: $data) {
            id
          }
        }
      `,
      {
        data: {
          title: 'Website enquiry',
          bodyV2: this.buildRichText(
            [
              'New website enquiry captured.',
              '',
              `- source: ${lead.source ?? 'public-site'}`,
              `- email: ${lead.email}`,
              ...(lead.phone ? [`- phone: ${lead.phone}`] : []),
              ...(lead.loanType ? [`- loanType: ${lead.loanType}`] : []),
              ...(lead.message ? [`- message: ${lead.message}`] : []),
              `- consentMarketing: ${String(Boolean(lead.consentMarketing))}`,
              ...(lead.consentTimestamp ? [`- consentTimestamp: ${lead.consentTimestamp}`] : []),
              ...(lead.consentCopyVersion ? [`- consentCopyVersion: ${lead.consentCopyVersion}`] : []),
              ...(lead.attribution
                ? Object.entries(lead.attribution)
                    .filter(([, value]) => value)
                    .map(([key, value]) => `- ${key}: ${String(value)}`)
                : []),
            ].join('\n'),
          ),
          createdAt: now,
          updatedAt: now,
        },
      },
    );

    const noteId = note.createNote?.id;
    if (noteId) {
      await this.request(`${this.config.restPath}/noteTargets`, {
        method: 'POST',
        body: {
          noteId,
          targetPersonId: personId,
          targetLoanApplicationId: loanApplicationId,
        },
      });
    }

    let taskId: string | undefined;
    try {
      const assigneeId = await this.getDefaultAssigneeId();
      if (assigneeId) {
        taskId = await this.createWorkflowTask({
          title: 'Initial contact - website enquiry',
          bodyMarkdown: `Contact lead within 24h.\\n\\nApplication: ${applicationId}\\nSource: website`,
          assigneeId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          personId,
          loanApplicationId,
        });
      }
    } catch {
      // Task creation is best-effort to keep lead intake resilient.
    }

    return { personId, applicationId: loanApplicationId, taskId, noteId };
  }

  async writeEngagement(event: EngagementEvent): Promise<void> {
    if (this.config.writebackMode === 'log') return;

    if (this.config.writebackMode === 'workflow_webhook') {
      if (!this.config.workflowWebhookUrl) {
        throw new Error('TWENTY_WORKFLOW_WEBHOOK_URL is required for workflow_webhook mode');
      }
      const response = await fetch(this.config.workflowWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        throw new Error(`Twenty workflow webhook ${response.status}`);
      }
      return;
    }

    const note = await this.request<{ id?: string; createNote?: { id?: string } }>(this.config.engagementNoteEndpoint, {
      method: 'POST',
      body: this.buildRestNotePayload(event),
    });

    const noteId = note.id ?? note.createNote?.id;
    if (!noteId) {
      throw new Error('Twenty note creation did not return an id');
    }

    await this.attachNoteTargets(noteId, event);
  }

  private buildRestNotePayload(event: EngagementEvent): Record<string, unknown> {
    const summary =
      event.type === 'click'
        ? `Email click tracked${event.targetUrl ? `: ${event.targetUrl}` : ''}`
        : event.type === 'open'
          ? 'Email open tracked'
          : event.type === 'bounce'
            ? `Email bounce recorded${event.metadata?.reason ? `: ${String(event.metadata.reason)}` : ''}`
            : event.type === 'unsubscribe'
          ? 'Email unsubscribe recorded'
              : 'Email engagement recorded';

    const metadataLines = Object.entries({
      personId: event.personId,
      email: event.email,
      campaignId: event.campaignId,
      campaignName: event.campaignName,
      crmActivityType: event.crmActivityType,
      source: event.source,
      ...(event.metadata ?? {}),
      ...(event.targetUrl ? { targetUrl: event.targetUrl } : {}),
    })
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `- ${key}: ${String(value)}`);

    const bodyText = [`${summary} (${event.timestamp})`, '', ...metadataLines].join('\n');

    return {
      title: 'Email engagement',
      bodyV2: this.buildRichText(bodyText),
    };
  }

  private buildRichText(bodyText: string): { markdown: string; blocknote: string } {
    return {
      markdown: bodyText,
      blocknote: JSON.stringify([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: bodyText }],
        },
      ]),
    };
  }

  private async attachNoteTargets(noteId: string, event: EngagementEvent): Promise<void> {
    const targetPayloads: Record<string, unknown>[] = [];

    if (event.personId) {
      targetPayloads.push({
        noteId,
        targetPersonId: event.personId,
      });
    }

    if (targetPayloads.length === 0) return;

    await this.request(`${this.config.restPath}/noteTargets`, {
      method: 'POST',
      body: targetPayloads.length === 1 ? targetPayloads[0] : targetPayloads,
    });
  }

  private async request<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('TWENTY_AUTH_TOKEN or TWENTY_API_KEY is required');
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });

    const text = await response.text();
    if (!response.ok) {
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        // keep raw text
      }
      throw new TwentyClientError(`twenty ${response.status}: ${text}`, response.status, path, body);
    }

    if (!text) return {} as T;
    try {
      const parsed = JSON.parse(text) as { data?: T };
      return (parsed.data ?? (parsed as unknown)) as T;
    } catch {
      return {} as T;
    }
  }

  private async graphqlRequest<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.request<T>(this.config.graphqlPath, {
      method: 'POST',
      body: {
        query,
        ...(variables ? { variables } : {}),
      },
    });
  }

  private async listMortgageApplicationNodes(): Promise<MortgageApplicationNode[]> {
    const data = await this.graphqlRequest<{
      loanApplications?: {
        edges?: Array<{ node?: MortgageApplicationNode }>;
      };
    }>(
      `
        query MortgageStudioApplications {
          loanApplications {
            edges {
              node {
                id
                applicationid
                applicationtype
                pipelinestage
                borrowername
                brokerowner
                loanpurpose
                updatedAt
                loanamount {
                  amountMicros
                  currencyCode
                }
                estimatedpropertyvalue {
                  amountMicros
                  currencyCode
                }
                lvrband
                targetsettlementdate
                lendertarget
                occupancytype
                firsthomebuyer
                entityname
                entitytype
                abn
                securitytype
                notessummary
                contactperson {
                  edges {
                    node {
                      id
                      name {
                        firstName
                        lastName
                      }
                      emails {
                        primaryEmail
                      }
                    }
                  }
                }
                documents {
                  edges {
                    node {
                      id
                      documentLabel
                      required
                      status
                      ownerrole
                      notes
                      recievedat
                      validatedat
                    }
                  }
                }
              }
            }
          }
        }
      `,
    );

    return (data.loanApplications?.edges ?? []).flatMap((edge) => (edge.node ? [edge.node] : []));
  }

  private async listMortgageTasks(): Promise<MortgageTaskNode[]> {
    const data = await this.graphqlRequest<{
      tasks?: {
        edges?: Array<{ node?: MortgageTaskNode }>;
      };
    }>(
      `
        query MortgageStudioTasks {
          tasks {
            edges {
              node {
                id
                title
                status
                dueAt
              }
            }
          }
        }
      `,
    );
    return (data.tasks?.edges ?? []).flatMap((edge) => (edge.node ? [edge.node] : []));
  }

  async listOpenTaskTitles(): Promise<string[]> {
    const tasks = await this.listMortgageTasks();
    return tasks
      .filter((task) => !['DONE', 'CANCELED'].includes((task.status ?? '').toUpperCase()))
      .map((task) => (task.title ?? '').trim())
      .filter(Boolean);
  }

  async getDefaultAssigneeId(): Promise<string | undefined> {
    const data = await this.graphqlRequest<{
      workspaceMembers?: {
        edges?: Array<{ node?: { id?: string } }>;
      };
    }>(
      `
        query MortgageStudioAssignee {
          workspaceMembers {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
    );
    return data.workspaceMembers?.edges?.[0]?.node?.id;
  }

  async createWorkflowTask(input: {
    title: string;
    bodyMarkdown: string;
    assigneeId: string;
    dueAt: string;
    personId?: string;
    loanApplicationId?: string;
  }): Promise<string> {
    const data = await this.graphqlRequest<{ createTask?: { id?: string } }>(
      `
        mutation CreateWorkflowTask($data: TaskCreateInput!) {
          createTask(data: $data) {
            id
          }
        }
      `,
      {
        data: {
          title: input.title,
          status: 'TODO',
          dueAt: input.dueAt,
          bodyV2: this.buildRichText(input.bodyMarkdown),
          assigneeId: input.assigneeId,
        },
      },
    );
    const taskId = data.createTask?.id;
    if (!taskId) throw new Error('Twenty task creation did not return an id');

    if (input.personId || input.loanApplicationId) {
      await this.graphqlRequest(
        `
          mutation CreateWorkflowTaskTarget($data: TaskTargetCreateInput!) {
            createTaskTarget(data: $data) { id }
          }
        `,
        {
          data: {
            taskId,
            ...(input.personId ? { targetPersonId: input.personId } : {}),
            ...(input.loanApplicationId ? { targetLoanApplicationId: input.loanApplicationId } : {}),
          },
        },
      );
    }

    return taskId;
  }

  private getAuthToken(): string | undefined {
    return this.config.authToken || this.config.apiKey;
  }

  private extractContactArray(raw: unknown): TwentyContact[] {
    if (Array.isArray(raw)) return raw as TwentyContact[];

    const obj = (raw ?? {}) as Record<string, unknown>;
    const candidates = [
      obj.people,
      obj.results,
      obj.records,
      (obj.data as Record<string, unknown> | undefined)?.people,
      (obj.data as Record<string, unknown> | undefined)?.results,
      (obj.data as Record<string, unknown> | undefined)?.records,
      (obj.items as Record<string, unknown> | undefined),
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as TwentyContact[];
    }

    return [];
  }

  private extractNextCursor(raw: unknown): string | undefined {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const data = (obj.data ?? {}) as Record<string, unknown>;
    const pageInfo = (data.pageInfo ?? obj.pageInfo ?? {}) as Record<string, unknown>;

    const value =
      (typeof obj.nextCursor === 'string' && obj.nextCursor) ||
      (typeof (obj.next_cursor as unknown) === 'string' && (obj.next_cursor as string)) ||
      (typeof data.nextCursor === 'string' && data.nextCursor) ||
      (typeof (data.next_cursor as unknown) === 'string' && (data.next_cursor as string)) ||
      (typeof pageInfo.endCursor === 'string' && pageInfo.endCursor) ||
      undefined;

    return value || undefined;
  }
}

function mapMortgageApplicationNodeToContext(application: MortgageApplicationNode): StudioTemplateContext {
  const contact = application.contactperson?.edges?.[0]?.node ?? {};
  const documents = (application.documents?.edges ?? []).flatMap((edge) => (edge.node ? [edge.node] : []));
  const requiredSummary = documents
    .filter((item) => item.required && !['received', 'accepted', 'waived'].includes((item.status ?? '').toLowerCase()))
    .map((item) => item.documentLabel)
    .filter((value): value is string => Boolean(value))
    .join(', ');

  return {
    contact: {
      id: contact.id,
      firstName: contact.name?.firstName ?? '',
      lastName: contact.name?.lastName ?? '',
      email: contact.emails?.primaryEmail ?? '',
    },
    broker: {
      name: application.brokerowner ?? '',
      signature: application.brokerowner ?? '',
    },
    application: {
      id: application.id,
      applicationId: application.applicationid,
      applicationType: normalizeEnum(application.applicationtype),
      pipelineStage: normalizeEnum(application.pipelinestage),
      borrowerName: application.borrowername ?? '',
      loanPurpose: normalizeEnum(application.loanpurpose),
      lenderTarget: application.lendertarget ?? '',
      lvrBand: normalizeEnum(application.lvrband),
      targetSettlementDate: application.targetsettlementdate ?? null,
      occupancyType: normalizeEnum(application.occupancytype),
      firstHomeBuyer: application.firsthomebuyer ?? false,
      entityName: application.entityname ?? '',
      entityType: normalizeEnum(application.entitytype),
      abn: application.abn ?? '',
      securityType: normalizeEnum(application.securitytype),
      notesSummary: application.notessummary ?? '',
      loanAmount: microsToAmount(application.loanamount?.amountMicros),
      estimatedPropertyValue: microsToAmount(application.estimatedpropertyvalue?.amountMicros),
      currencyCode: application.loanamount?.currencyCode ?? application.estimatedpropertyvalue?.currencyCode ?? 'AUD',
      updatedAt: application.updatedAt,
    },
    checklist: {
      requiredSummary,
      items: documents.map((item) => ({
        label: item.documentLabel ?? 'Document',
        required: item.required ?? false,
        status: normalizeEnum(item.status) ?? '',
        ownerRole: normalizeEnum(item.ownerrole),
        notes: item.notes ?? '',
        receivedAt: item.recievedat ?? null,
        validatedAt: item.validatedat ?? null,
      })),
    },
  };
}

function mapDashboardRow(context: StudioTemplateContext, pendingRequiredDocs: number) {
  return {
    applicationId: context.application.applicationId ?? context.application.id ?? 'unknown',
    personId: context.contact.id,
    borrowerName: context.application.borrowerName ?? context.contact.firstName ?? 'Borrower',
    email: context.contact.email,
    applicationType: context.application.applicationType,
    pipelineStage: context.application.pipelineStage,
    lenderTarget: context.application.lenderTarget,
    pendingRequiredDocs,
    recommendedTemplateKey: recommendTemplateKeyFromContext(context),
    targetSettlementDate: context.application.targetSettlementDate,
  };
}

function countPendingRequiredDocuments(application: MortgageApplicationNode): number {
  return (application.documents?.edges ?? []).filter((edge) => {
    const doc = edge.node;
    if (!doc?.required) return false;
    const status = (doc.status ?? '').toLowerCase();
    return !['received', 'accepted', 'waived'].includes(status);
  }).length;
}

function compareApplications(left: StudioTemplateContext, right: StudioTemplateContext): number {
  return (left.application.applicationId ?? '').localeCompare(right.application.applicationId ?? '');
}

function isDocsChaseCandidate(context: StudioTemplateContext, pendingRequiredDocs: number): boolean {
  return pendingRequiredDocs > 0 && ['docs_requested', 'fact_find_complete', 'docs_complete'].includes(context.application.pipelineStage ?? '');
}

function isReviewCandidate(context: StudioTemplateContext): boolean {
  if (context.application.pipelineStage !== 'settled') return false;
  const settlementDate = context.application.targetSettlementDate;
  if (!settlementDate) return true;
  const days = Math.floor((Date.now() - new Date(settlementDate).getTime()) / (1000 * 60 * 60 * 24));
  return days >= 30;
}

function prettifyEnum(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function selectWorkflowCandidates(candidates: MortgageDashboardApp[], requestedIds: string[] | undefined, limit: number): MortgageDashboardApp[] {
  const requested = new Set((requestedIds ?? []).filter(Boolean));
  if (requested.size > 0) {
    return candidates.filter((item) => requested.has(item.context.application.applicationId ?? '') || requested.has(item.context.application.id ?? ''));
  }
  return candidates.slice(0, limit);
}

function recommendTemplateKeyFromContext(context: StudioTemplateContext): string {
  const applicationType = context.application.applicationType ?? '';
  const stage = context.application.pipelineStage ?? '';
  if (stage === 'docs_requested') {
    return applicationType === 'commercial_loan' ? 'commercial_documents_request' : 'retail_documents_request';
  }
  if (stage === 'fact_find_complete') return 'fact_find_booking';
  if (stage === 'settled') return applicationType === 'commercial_loan' ? 'commercial_cross_sell' : 'annual_review_invite';
  if (stage === 'conditional_approval' || stage === 'formal_approval') {
    return applicationType === 'commercial_loan' ? 'commercial_submission_confirmation' : 'retail_submission_confirmation';
  }
  if (stage === 'lead_captured' || stage === 'discovery_booked') {
    return applicationType === 'commercial_loan' ? 'commercial_intake_acknowledgement' : 'retail_intake_acknowledgement';
  }
  return applicationType === 'commercial_loan' ? 'commercial_cross_sell' : 'welcome_onboarding';
}

function normalizeEnum(value?: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase();
}

function microsToAmount(value?: number | null): number | null {
  return value == null ? null : Math.floor(value / 1_000_000);
}

function hasPendingRequiredDocuments(application: MortgageApplicationNode): boolean {
  return (application.documents?.edges ?? []).some((edge) => {
    const doc = edge.node;
    if (!doc?.required) return false;
    const status = (doc.status ?? '').toLowerCase();
    return !['received', 'accepted', 'waived'].includes(status);
  });
}

function isSubmittedLikeStage(stage?: string | null): boolean {
  return ['SUBMITTED', 'CONDITIONAL_APPROVAL', 'FORMAL_APPROVAL', 'SETTLED'].includes(stage ?? '');
}

function daysSince(dateValue?: string | null): number | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function isSettledWithinDays(application: MortgageApplicationNode, days: number): boolean {
  if (application.pipelinestage !== 'SETTLED') return false;
  const age = daysSince(application.targetsettlementdate);
  return age !== null && age >= 0 && age <= days;
}

function isAnnualReviewDue(application: MortgageApplicationNode): boolean {
  if (application.pipelinestage !== 'SETTLED') return false;
  const age = daysSince(application.targetsettlementdate);
  return age !== null && age >= 30;
}

function isFixedRateExpiryCandidate(application: MortgageApplicationNode): boolean {
  if (application.applicationtype !== 'RETAIL_HOME_LOAN' || application.pipelinestage !== 'SETTLED') return false;
  const age = daysSince(application.targetsettlementdate);
  return age !== null && age >= 30 && age <= 75;
}

function rankMortgageApplication(application: MortgageApplicationNode): number {
  const stage = application.pipelinestage ?? '';
  const stageScore =
    stage === 'SETTLED'
      ? 10
      : stage === 'FORMAL_APPROVAL'
        ? 90
        : stage === 'CONDITIONAL_APPROVAL'
          ? 80
          : stage === 'SUBMITTED'
            ? 70
            : stage === 'DOCS_COMPLETE'
              ? 60
              : stage === 'DOCS_REQUESTED'
                ? 50
                : 40;
  const updated = application.updatedAt ? new Date(application.updatedAt).getTime() : 0;
  return stageScore * 1_000_000_000_000 + updated;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
