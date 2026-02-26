import { defineNavigationMenuItem } from 'twenty-sdk';

const connectorUrl = process.env.MAILER_STUDIO_CONNECTOR_URL ?? 'http://localhost:4010';

export default defineNavigationMenuItem({
  universalIdentifier: 'f4c92807-f6d6-451e-a95e-5d8df42b9dfe',
  name: 'Mailer Studio',
  icon: 'IconMail',
  position: 0,
  link: connectorUrl,
});
