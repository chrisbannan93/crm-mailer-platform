import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk';
import { LOAN_APPLICATION_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/objects/loan-application';
import { fieldForObject } from 'src/utils/field';

export const APPLICATION_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER = '7c6e421c-6bf7-476a-9736-5cb9b74d5d65';

const field = <T extends Record<string, unknown>>(config: T): T =>
  fieldForObject(APPLICATION_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER, config);

const selectOption = (value: string, label: string, position: number, color = 'blue') => ({
  value,
  label,
  position,
  color,
});

export const APPLICATION_DOCUMENT_FIELDS = {
  loanApplication: '05af71c2-0983-4af8-b5be-bacc5acbfdc7',
  documentKey: 'fbe2e0c4-330a-4bbd-90d9-697061abd566',
  documentLabel: '06e545f4-f52c-490e-8333-69c7adbd4927',
  required: '50b3b083-5421-4d1e-961d-8410bc70e218',
  status: 'ad7d153c-0f6e-4de1-9af3-a6fbb59eb0b4',
  ownerRole: '4b8f9a2d-af67-4c96-b2d1-129e2bf6d5a7',
  notes: 'e11425ec-7b3d-409e-a5c6-6cfbb8a6c82a',
  receivedAt: '47eb5fa7-d619-4e5a-9f82-650a8f00af69',
  validatedAt: '4f96d021-299a-4294-adb6-2f9fd62acc7d',
} as const;

export default defineObject({
  universalIdentifier: APPLICATION_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'application document',
  namePlural: 'application documents',
  labelSingular: 'Application Document',
  labelPlural: 'Application Documents',
  labelIdentifierFieldMetadataUniversalIdentifier: APPLICATION_DOCUMENT_FIELDS.documentLabel,
  icon: 'IconChecklist',
  fields: [
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.loanApplication,
      type: FieldType.RELATION,
      name: 'loanApplication',
      label: 'Loan Application',
      relationType: RelationType.MANY_TO_ONE,
      targetObject: LOAN_APPLICATION_OBJECT_UNIVERSAL_IDENTIFIER,
      targetFieldLabel: 'documents',
      onDelete: OnDeleteAction.CASCADE,
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.documentKey,
      type: FieldType.TEXT,
      name: 'documentKey',
      label: 'Document Key',
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.documentLabel,
      type: FieldType.TEXT,
      name: 'documentLabel',
      label: 'Document Label',
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.required,
      type: FieldType.BOOLEAN,
      name: 'required',
      label: 'Required',
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.status,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      options: [
        selectOption('missing', 'Missing', 0, 'red'),
        selectOption('requested', 'Requested', 1, 'yellow'),
        selectOption('received', 'Received', 2, 'blue'),
        selectOption('accepted', 'Accepted', 3, 'green'),
        selectOption('waived', 'Waived', 4, 'gray'),
      ],
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.ownerRole,
      type: FieldType.SELECT,
      name: 'ownerRole',
      label: 'Owner Role',
      options: [
        selectOption('broker', 'Broker', 0),
        selectOption('admin', 'Admin', 1),
      ],
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.notes,
      type: FieldType.RICH_TEXT_V2,
      name: 'notes',
      label: 'Notes',
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.receivedAt,
      type: FieldType.DATE,
      name: 'receivedAt',
      label: 'Received At',
    }),
    field({
      universalIdentifier: APPLICATION_DOCUMENT_FIELDS.validatedAt,
      type: FieldType.DATE,
      name: 'validatedAt',
      label: 'Validated At',
    }),
  ],
});
