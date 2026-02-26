import { getConfig } from './config/index.js';
import { startOptionalJobs } from './jobs/index.js';
import { logger } from './logger.js';
import { MemoryStore } from './memory-store.js';
import { createServer } from './server.js';
import { ConnectorService } from './service.js';
import { ListmonkClient, TwentyClient } from './clients/index.js';
import { loadSegmentDefinitions, loadVerticalPack } from './services/verticalLoader.js';

async function main() {
  const config = getConfig();
  const vertical = await loadVerticalPack(config.vertical);
  const segments = await loadSegmentDefinitions(config.vertical);
  const store = new MemoryStore(200, config.sync.stateFile);
  const service = new ConnectorService({
    config,
    store,
    vertical,
    segments,
    twenty: new TwentyClient(config.twenty),
    listmonk: new ListmonkClient(config.listmonk),
    logger,
  });
  await service.bootstrapDefaultList().catch((error) => {
    logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'default list bootstrap skipped');
  });
  const app = createServer(config, service);
  startOptionalJobs({ config, service, logger });

  app.listen(config.port, () => {
    logger.info({ port: config.port, vertical: vertical.name, segmentCount: segments.length }, 'connector listening');
  });
}

main().catch((error) => {
  logger.error({ err: error instanceof Error ? error.message : String(error) }, 'connector startup failed');
  process.exit(1);
});
