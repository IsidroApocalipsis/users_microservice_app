import { Router } from 'express';
import { authRouter } from './auth.route.js';
import { healthRouter } from './health.route.js';

export const routes = Router();

routes.use(healthRouter);
routes.use('/auth', authRouter);
