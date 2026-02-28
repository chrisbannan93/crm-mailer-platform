import { defineView } from 'twenty-sdk';

export const ALL_LOAN_APPLICATIONS_VIEW_UNIVERSAL_IDENTIFIER = '6b145665-65c2-43cc-a452-1ca95c2ec582';

export default defineView({
  universalIdentifier: ALL_LOAN_APPLICATIONS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'all-loan-applications',
  objectUniversalIdentifier: '9885e5a1-1a67-4d1e-98c4-f93b6828d8cf',
  icon: 'IconList',
  position: 0,
  fields: [
    {
      universalIdentifier: '3418fe4d-a59d-412d-b58e-ae92abf4d345',
      fieldMetadataUniversalIdentifier: '76976844-b8f7-463f-92f7-5328f02af700',
      position: 0,
      isVisible: true,
    },
    {
      universalIdentifier: 'c9ade4d7-06d2-477e-b145-de5fe7d69e38',
      fieldMetadataUniversalIdentifier: '23ff3dc4-c230-4f4e-95c7-26220f9fcf4b',
      position: 1,
      isVisible: true,
    },
    {
      universalIdentifier: '8904a63f-e1ac-419d-87ae-f01e2953c80b',
      fieldMetadataUniversalIdentifier: '0f6acfdd-777a-4ad4-a1e3-3a9b7c37d9ef',
      position: 2,
      isVisible: true,
    },
    {
      universalIdentifier: 'bafe103c-711b-4a67-8d99-11e3ac5d97a0',
      fieldMetadataUniversalIdentifier: 'f9e60d40-f7f9-4b96-aafd-4185b1dae0bc',
      position: 3,
      isVisible: true,
    },
    {
      universalIdentifier: '51ad2e36-1893-4d92-8a45-f0d78a06a528',
      fieldMetadataUniversalIdentifier: '95290c90-d1c0-4e4b-b716-92fc1495dbb8',
      position: 4,
      isVisible: true,
    },
  ],
});
