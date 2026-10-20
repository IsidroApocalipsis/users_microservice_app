import { Router } from 'express';
import { authRouter } from './auth.route.js';
import { healthRouter } from './health.route.js';
import { usersRouter } from './users.route.js';

export const routes = Router();

routes.use(healthRouter);
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
