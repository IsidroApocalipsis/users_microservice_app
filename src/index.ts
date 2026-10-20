import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectToDatabase } from './db/client.js';
import { log } from './logging/logger.js';

await connectToDatabase();

const app = createApp();

app.listen(env.port, () => {
  log('info', 'Server listening', { port: env.port });
});
