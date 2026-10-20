import express from 'express';
import { correlationId } from './middlewares/correlation-id.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { requestLogger } from './middlewares/request-logger.js';
import { routes } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();

  app.use(correlationId);
  app.use(requestLogger);
  app.use(express.json());
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
