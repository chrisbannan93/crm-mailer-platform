import { defineApplication } from 'twenty-sdk';
import { POST_INSTALL_UNIVERSAL_IDENTIFIER } from 'src/logic-functions/post-install';
import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from 'src/roles/default-role';

export default defineApplication({
  universalIdentifier: '43375e74-c1f3-4e69-a2a0-607879346ea9',
  displayName: 'Mortgage AU',
  description: 'Code-managed custom objects for the Australia mortgage broking vertical.',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  postInstallLogicFunctionUniversalIdentifier: POST_INSTALL_UNIVERSAL_IDENTIFIER,
});
