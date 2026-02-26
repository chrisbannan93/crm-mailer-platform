import type { AppConfig } from '../config/index.js';
import type { ConnectorService } from '../service.js';

type Logger = {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
};

export function startOptionalJobs(input: { config: AppConfig; service: ConnectorService; logger?: Logger }): void {
  const intervalMinutes = input.config.sync.intervalMinutes;
  if (!intervalMinutes || intervalMinutes <= 0) return;

  let running = false;
  const intervalMs = Math.round(intervalMinutes * 60_000);
  const run = async () => {
    if (running) {
      input.logger?.warn({ intervalMinutes }, 'scheduled contacts sync skipped (already running)');
      return;
    }
    running = true;
    try {
      const result = await input.service.syncContactsFromTwenty({ maxContacts: input.config.sync.maxContactsPerRun });
      input.logger?.info({ result }, 'scheduled contacts sync complete');
    } catch (error) {
      input.logger?.error({ err: error instanceof Error ? error.message : String(error) }, 'scheduled contacts sync failed');
    } finally {
      running = false;
    }
  };

  input.logger?.info({ intervalMinutes, maxContactsPerRun: input.config.sync.maxContactsPerRun }, 'starting contacts sync scheduler');
  const timer = setInterval(() => {
    void run();
  }, intervalMs);
  timer.unref();
}
