import {
  defineObject,
  FieldType,
  RelationType,
} from 'twenty-sdk';
import { fieldForObject } from 'src/utils/field';

export const LOAN_APPLICATION_OBJECT_UNIVERSAL_IDENTIFIER = '9885e5a1-1a67-4d1e-98c4-f93b6828d8cf';

const field = <T extends Record<string, unknown>>(config: T): T =>
  fieldForObject(LOAN_APPLICATION_OBJECT_UNIVERSAL_IDENTIFIER, config);

const selectOption = (value: string, label: string, position: number, color = 'blue') => ({
  value,
  label,
  position,
  color,
});

export const LOAN_APPLICATION_FIELDS = {
  applicationId: '76976844-b8f7-463f-92f7-5328f02af700',
  applicationType: '23ff3dc4-c230-4f4e-95c7-26220f9fcf4b',
  pipelineStage: '0f6acfdd-777a-4ad4-a1e3-3a9b7c37d9ef',
  contactPersonRecordId: 'f9e60d40-f7f9-4b96-aafd-4185b1dae0bc',
  documents: 'f09b42ca-90e2-4fe5-bbd1-04f7b02d2b5d',
  borrowerName: '95290c90-d1c0-4e4b-b716-92fc1495dbb8',
  brokerOwner: '96cefddc-850e-4111-89b0-48044d760347',
  loanPurpose: '754d7fa5-e4e7-416b-9dd7-3fecf9335e50',
  loanAmount: 'f9c4c030-bf43-4a0a-be3b-8439554f17b6',
  estimatedPropertyValue: 'beaee8e7-ee7f-4279-97f7-553a9732903a',
  lvrBand: '51c9a59a-d6ca-47f5-ba77-1e5992ec35bd',
  targetSettlementDate: '2bc66ec8-b5ab-487c-adf2-d05672d011fa',
  lenderTarget: '1c31219a-5f43-45f3-9e3f-0bbc92504cb8',
  occupancyType: '78e8d878-66c4-46a7-898c-dd439bdd5778',
  firstHomeBuyer: '84ae48f6-9f29-4aa8-8bee-2744a4d2d8e9',
  entityName: 'cbdccd17-7802-489e-bef3-eb330644ddd5',
  entityType: 'f8de1325-988c-4053-a912-0165e61751ff',
  abn: '69dc2dfa-7aff-415a-8049-67d82c178d75',
  securityType: '26bd196f-bc27-448b-be03-11441ca76687',
  notesSummary: '839ef710-9da0-4c5a-b73d-90200649191c',
} as const;

export default defineObject({
  universalIdentifier: LOAN_APPLICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'loan application',
  namePlural: 'loan applications',
  labelSingular: 'Loan Application',
  labelPlural: 'Loan Applications',
  labelIdentifierFieldMetadataUniversalIdentifier: LOAN_APPLICATION_FIELDS.applicationId,
  icon: 'IconHomeDollar',
  fields: [
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.applicationId,
      type: FieldType.TEXT,
      name: 'applicationId',
      label: 'Application ID',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.applicationType,
      type: FieldType.SELECT,
      name: 'applicationType',
      label: 'Application Type',
      options: [
        selectOption('retail_home_loan', 'Retail home loan', 0, 'green'),
        selectOption('commercial_loan', 'Commercial loan', 1, 'blue'),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.pipelineStage,
      type: FieldType.SELECT,
      name: 'pipelineStage',
      label: 'Pipeline Stage',
      options: [
        selectOption('lead_captured', 'Lead captured', 0),
        selectOption('discovery_booked', 'Discovery booked', 1),
        selectOption('fact_find_complete', 'Fact find complete', 2),
        selectOption('docs_requested', 'Docs requested', 3),
        selectOption('docs_complete', 'Docs complete', 4),
        selectOption('servicing_assessed', 'Servicing assessed', 5),
        selectOption('deal_structuring', 'Deal structuring', 6),
        selectOption('credit_paper_ready', 'Credit paper ready', 7),
        selectOption('submitted', 'Submitted', 8, 'yellow'),
        selectOption('indicative_offer', 'Indicative offer', 9),
        selectOption('conditional_approval', 'Conditional approval', 10, 'orange'),
        selectOption('formal_approval', 'Formal approval', 11, 'green'),
        selectOption('settled', 'Settled', 12, 'green'),
        selectOption('closed_lost', 'Closed lost', 13, 'red'),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.contactPersonRecordId,
      type: FieldType.TEXT,
      name: 'contactPersonRecordId',
      label: 'Contact Person Record ID',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.documents,
      type: FieldType.RELATION,
      name: 'documents',
      label: 'Documents',
      relationTargetFieldMetadataUniversalIdentifier:
        '05af71c2-0983-4af8-b5be-bacc5acbfdc7',
      relationTargetObjectMetadataUniversalIdentifier:
        '7c6e421c-6bf7-476a-9736-5cb9b74d5d65',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.borrowerName,
      type: FieldType.TEXT,
      name: 'borrowerName',
      label: 'Borrower Name',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.brokerOwner,
      type: FieldType.TEXT,
      name: 'brokerOwner',
      label: 'Broker Owner',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.loanPurpose,
      type: FieldType.SELECT,
      name: 'loanPurpose',
      label: 'Loan Purpose',
      options: [
        selectOption('purchase', 'Purchase', 0),
        selectOption('refinance', 'Refinance', 1),
        selectOption('equity_release', 'Equity release', 2),
        selectOption('construction', 'Construction', 3),
        selectOption('working_capital', 'Working capital', 4),
        selectOption('investment', 'Investment', 5),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.loanAmount,
      type: FieldType.NUMBER,
      name: 'loanAmount',
      label: 'Loan Amount',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.estimatedPropertyValue,
      type: FieldType.NUMBER,
      name: 'estimatedPropertyValue',
      label: 'Estimated Property Value',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.lvrBand,
      type: FieldType.SELECT,
      name: 'lvrBand',
      label: 'LVR Band',
      options: [
        selectOption('lt_60', 'Under 60%', 0),
        selectOption('60_70', '60-70%', 1),
        selectOption('70_80', '70-80%', 2),
        selectOption('80_90', '80-90%', 3),
        selectOption('gt_90', 'Over 90%', 4, 'red'),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.targetSettlementDate,
      type: FieldType.DATE,
      name: 'targetSettlementDate',
      label: 'Target Settlement Date',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.lenderTarget,
      type: FieldType.TEXT,
      name: 'lenderTarget',
      label: 'Lender Target',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.occupancyType,
      type: FieldType.SELECT,
      name: 'occupancyType',
      label: 'Occupancy Type',
      options: [
        selectOption('owner_occupied', 'Owner occupied', 0, 'green'),
        selectOption('investment', 'Investment', 1, 'blue'),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.firstHomeBuyer,
      type: FieldType.BOOLEAN,
      name: 'firstHomeBuyer',
      label: 'First Home Buyer',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.entityName,
      type: FieldType.TEXT,
      name: 'entityName',
      label: 'Entity Name',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.entityType,
      type: FieldType.SELECT,
      name: 'entityType',
      label: 'Entity Type',
      options: [
        selectOption('company', 'Company', 0),
        selectOption('trust', 'Trust', 1),
        selectOption('partnership', 'Partnership', 2),
        selectOption('sole_trader', 'Sole trader', 3),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.abn,
      type: FieldType.TEXT,
      name: 'abn',
      label: 'ABN',
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.securityType,
      type: FieldType.SELECT,
      name: 'securityType',
      label: 'Security Type',
      options: [
        selectOption('commercial_property', 'Commercial property', 0),
        selectOption('residential_security', 'Residential security', 1),
        selectOption('cashflow', 'Cashflow', 2),
        selectOption('other', 'Other', 3),
      ],
    }),
    field({
      universalIdentifier: LOAN_APPLICATION_FIELDS.notesSummary,
      type: FieldType.RICH_TEXT_V2,
      name: 'notesSummary',
      label: 'Notes Summary',
    }),
  ],
});
