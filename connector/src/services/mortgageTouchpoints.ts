import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { StudioDashboardApplicationRow, StudioTemplateContext } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const touchpointEligibilitySchema = z.object({
  stages: z.array(z.string()).optional(),
  applicationTypes: z.array(z.string()).optional(),
  tagsAny: z.array(z.string()).optional(),
  inactivityDaysMin: z.number().int().nonnegative().optional(),
  settlementWithinDays: z.number().int().positive().optional(),
  monthsSinceSettlementMin: z.number().int().positive().optional(),
  fixedRateExpiryWithinDays: z.number().int().positive().optional(),
  requiresMissingDocs: z.boolean().optional(),
  manualOnly: z.boolean().optional(),
  consentRequired: z.boolean().optional(),
});

const touchpointSchema = z.object({
  key: z.string().min(1),
  lifecycle: z.string().min(1),
  audience: z.enum(['retail', 'commercial', 'both']),
  eligibility: touchpointEligibilitySchema,
  cooldownHours: z.number().int().positive(),
  defaultSubject: z.string().min(1),
  templateFile: z.string().min(1),
  recommendedQueue: z.string().min(1),
  requiredConfirm: z.boolean(),
});

const touchpointsConfigSchema = z.object({
  version: z.number().int().positive(),
  touchpoints: z.array(touchpointSchema),
});

export type MortgageTouchpoint = z.infer<typeof touchpointSchema>;

type EligibilityInput = {
  context: StudioTemplateContext;
  row: StudioDashboardApplicationRow;
  now: Date;
  consentMarketing?: boolean;
  updatedAt?: string;
};
export type EligibilityResult = { eligible: boolean; reasons: string[] };

function getVerticalRoots(): string[] {
  return [
    path.resolve(__dirname, '..', '..', '..', 'verticals'),
    path.resolve(__dirname, '..', '..', '..', '..', 'verticals'),
  ];
}

async function resolveTouchpointsPath(vertical: string): Promise<string> {
  const names = vertical === 'generic' ? ['generic'] : [vertical, 'generic'];
  for (const root of getVerticalRoots()) {
    for (const name of names) {
      const file = path.join(root, name, 'config', 'touchpoints.json');
      try {
        await readFile(file, 'utf8');
        return file;
      } catch {
        // continue
      }
    }
  }
  throw new Error(`Unable to find touchpoints.json for vertical '${vertical}'`);
}

export async function loadMortgageTouchpoints(vertical: string): Promise<MortgageTouchpoint[]> {
  const filePath = await resolveTouchpointsPath(vertical);
  const raw = await readFile(filePath, 'utf8');
  const parsed = touchpointsConfigSchema.parse(JSON.parse(raw));
  return parsed.touchpoints;
}

export function getMissingRequiredDocs(context: StudioTemplateContext): string[] {
  return (context.checklist.items ?? [])
    .filter((item) => item.required)
    .filter((item) => !['received', 'accepted', 'waived'].includes((item.status ?? '').toLowerCase()))
    .map((item) => item.label);
}

export function evaluateTouchpointEligibility(touchpoint: MortgageTouchpoint, input: EligibilityInput): EligibilityResult {
  const { eligibility } = touchpoint;
  const stage = (input.context.application.pipelineStage ?? '').toLowerCase();
  const appType = (input.context.application.applicationType ?? '').toLowerCase();
  const reasons: string[] = [];

  if (touchpoint.audience === 'retail' && appType !== 'retail_home_loan') reasons.push('Audience is retail only');
  if (touchpoint.audience === 'commercial' && appType !== 'commercial_loan') reasons.push('Audience is commercial only');

  if (eligibility.applicationTypes?.length) {
    const types = eligibility.applicationTypes.map((value) => value.toLowerCase());
    if (!types.includes(appType)) reasons.push(`Application type ${appType || 'unknown'} not allowed`);
  }

  if (eligibility.stages?.length) {
    const stages = eligibility.stages.map((value) => value.toLowerCase());
    if (!stages.includes(stage)) reasons.push(`Stage ${stage || 'unknown'} not in eligibility stages`);
  }

  if (eligibility.consentRequired && input.consentMarketing === false) reasons.push('Marketing consent required');

  if (eligibility.requiresMissingDocs && getMissingRequiredDocs(input.context).length === 0) {
    reasons.push('No missing required documents');
  }

  if (eligibility.settlementWithinDays) {
    const settlement = input.context.application.targetSettlementDate;
    if (!settlement) reasons.push('No settlement date available');
    const diffDays = Math.ceil((new Date(settlement).getTime() - input.now.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(diffDays) || diffDays < 0 || diffDays > eligibility.settlementWithinDays) {
      reasons.push(`Settlement date is outside ${eligibility.settlementWithinDays} day window`);
    }
  }

  if (eligibility.monthsSinceSettlementMin) {
    const settlement = input.context.application.targetSettlementDate;
    if (!settlement) reasons.push('No settlement date available');
    const elapsedDays = Math.floor((input.now.getTime() - new Date(settlement).getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(elapsedDays) || elapsedDays < eligibility.monthsSinceSettlementMin * 30) {
      reasons.push(`Needs at least ${eligibility.monthsSinceSettlementMin} months since settlement`);
    }
  }

  if (eligibility.fixedRateExpiryWithinDays) {
    const settlement = input.context.application.targetSettlementDate;
    if (!settlement) reasons.push('No settlement date available');
    const expiryProxy = new Date(settlement);
    expiryProxy.setFullYear(expiryProxy.getFullYear() + 2);
    const diffDays = Math.ceil((expiryProxy.getTime() - input.now.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(diffDays) || diffDays < 0 || diffDays > eligibility.fixedRateExpiryWithinDays) {
      reasons.push(`Fixed-rate expiry proxy is outside ${eligibility.fixedRateExpiryWithinDays} day window`);
    }
  }

  if (eligibility.inactivityDaysMin && input.updatedAt) {
    const sinceUpdate = Math.floor((input.now.getTime() - new Date(input.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(sinceUpdate) || sinceUpdate < eligibility.inactivityDaysMin) {
      reasons.push(`Needs ${eligibility.inactivityDaysMin} days of inactivity`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

export function matchesTouchpointEligibility(touchpoint: MortgageTouchpoint, input: EligibilityInput): boolean {
  return evaluateTouchpointEligibility(touchpoint, input).eligible;
}

export function pickRecommendedTouchpointKey(row: StudioDashboardApplicationRow): string {
  const stage = (row.pipelineStage ?? '').toLowerCase();
  const appType = (row.applicationType ?? '').toLowerCase();

  if (['lead_captured', 'discovery_booked'].includes(stage)) return 'welcome_onboarding';
  if (row.pendingRequiredDocs > 0 || stage === 'docs_requested') {
    return appType === 'commercial_loan' ? 'commercial_documents_request' : 'retail_documents_request';
  }
  if (['submitted', 'indicative_offer', 'conditional_approval', 'formal_approval'].includes(stage)) {
    return appType === 'commercial_loan' ? 'commercial_submission_confirmation' : 'retail_submission_confirmation';
  }
  if (stage === 'settled') return 'post_settlement_welcome';
  return appType === 'commercial_loan' ? 'commercial_cross_sell' : 'annual_review_invite';
}
