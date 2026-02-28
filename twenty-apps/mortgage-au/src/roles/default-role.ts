import { defineRole } from 'twenty-sdk';

export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '3c4068e1-08bf-4911-a4c4-62f888146e52';

export default defineRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Mortgage AU default role',
  description: 'Default role used by the Mortgage AU Twenty app.',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
