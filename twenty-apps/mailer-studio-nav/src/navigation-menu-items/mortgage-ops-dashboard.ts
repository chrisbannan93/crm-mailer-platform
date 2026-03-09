import { defineNavigationMenuItem } from 'twenty-sdk';
import { buildStudioLink } from 'src/navigation-menu-items/connector-link';

export default defineNavigationMenuItem({
  universalIdentifier: '26eb8cb3-c248-4133-b853-996c7d5de67a',
  name: 'Mortgage Ops Dashboard',
  icon: 'IconChartBar',
  position: 2,
  link: buildStudioLink('ops_dashboard'),
});
