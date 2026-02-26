import { getConfig } from './config/index.js';
import { startOptionalJobs } from './jobs/index.js';
import { MemoryStore } from './memory-store.js';
import { createServer } from './server.js';
import { ConnectorService } from './service.js';
import { ListmonkClient, TwentyClient } from './clients/index.js';
import { loadVerticalPack } from './services/verticalLoader.js';

async function main() {
  const config = getConfig();
  const vertical = await loadVerticalPack(config.vertical);
  const store = new MemoryStore();
  const service = new ConnectorService({
    config,
    store,
    vertical,
    twenty: new TwentyClient(config.twenty),
    listmonk: new ListmonkClient(config.listmonk),
  });
  await service.bootstrapDefaultList().catch((error) => {
    console.warn(`default list bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`);
  });
  const app = createServer(config, service);
  startOptionalJobs();

  app.listen(config.port, () => {
    console.log(`connector listening on :${config.port} (vertical=${vertical.name})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
