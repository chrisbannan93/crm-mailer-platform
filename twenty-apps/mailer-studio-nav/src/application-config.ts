import { defineApplication } from 'twenty-sdk';
import { POST_INSTALL_UNIVERSAL_IDENTIFIER } from 'src/logic-functions/post-install';
import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from 'src/roles/default-role';

export default defineApplication({
  universalIdentifier: 'fdd7bd64-4f89-4af8-b4a7-b84f4f1efb08',
  displayName: 'Mailer Studio Nav',
  description: 'Adds a Mailer Studio navigation item that links to the local connector UI.',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  postInstallLogicFunctionUniversalIdentifier: POST_INSTALL_UNIVERSAL_IDENTIFIER,
});
