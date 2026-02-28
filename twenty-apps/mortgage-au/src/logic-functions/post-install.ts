import { defineLogicFunction } from 'twenty-sdk';

export const POST_INSTALL_UNIVERSAL_IDENTIFIER = '6dd62968-a0e5-41c4-943f-48a921c3f5c5';

const handler = async (): Promise<void> => {
  console.log('Mortgage AU app installed');
};

export default defineLogicFunction({
  universalIdentifier: POST_INSTALL_UNIVERSAL_IDENTIFIER,
  name: 'post-install',
  description: 'No-op post install for the Mortgage AU app.',
  timeoutSeconds: 60,
  handler,
});
