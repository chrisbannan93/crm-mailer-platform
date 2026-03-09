import { defineNavigationMenuItem } from 'twenty-sdk';
import { buildStudioLink } from 'src/navigation-menu-items/connector-link';

export default defineNavigationMenuItem({
  universalIdentifier: 'f5ed3500-2af7-4888-a240-143ffdc8e383',
  name: 'Mortgage Command Center',
  icon: 'IconChecklist',
  position: 1,
  link: buildStudioLink('command_center'),
});
