import { defineLogicFunction } from 'twenty-sdk';

export const POST_INSTALL_UNIVERSAL_IDENTIFIER = '4456973f-b24f-4fd7-a2c9-f8e505fd5610';

const handler = async (): Promise<void> => {
  console.log('Mailer Studio nav app installed');
};

export default defineLogicFunction({
  universalIdentifier: POST_INSTALL_UNIVERSAL_IDENTIFIER,
  name: 'post-install',
  description: 'No-op post install for Mailer Studio nav app',
  timeoutSeconds: 60,
  handler,
});
