import { getConfig } from './config.js';
import { createServer } from './server.js';

const config = getConfig();
const app = createServer(config);

app.listen(config.port, () => {
  console.log(`connector listening on :${config.port} (vertical=${config.vertical})`);
});
