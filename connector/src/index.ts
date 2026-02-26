import { getConfig } from './config.js';
import { ListmonkClient } from './listmonk.js';
import { MemoryStore } from './memory-store.js';
import { createServer } from './server.js';
import { ConnectorService } from './service.js';
import { TwentyClient } from './twenty.js';
import { loadVerticalPack } from './vertical.js';

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
  const app = createServer(config, service);

  app.listen(config.port, () => {
    console.log(`connector listening on :${config.port} (vertical=${vertical.name})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
