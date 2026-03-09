const connectorUrl = process.env.MAILER_STUDIO_CONNECTOR_URL ?? 'http://localhost:4010/studio';

export function buildStudioLink(panel?: 'command_center' | 'ops_dashboard' | 'touchpoints'): string {
  if (!panel) return connectorUrl;
  const url = new URL(connectorUrl);
  url.searchParams.set('panel', panel);
  return url.toString();
}
