import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { routes } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
