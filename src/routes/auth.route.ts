import { Router } from 'express';
import { createAuthService } from '../auth/auth.service.js';
import { validateBody } from '../middlewares/validate-body.js';
import { findByEmailHash } from '../users/user.repository.js';
import { loginUserSchema, type LoginUserInput } from '../users/user.schema.js';

const authService = createAuthService({ findByEmailHash });

export const authRouter = Router();

authRouter.post(
  '/login',
  validateBody(loginUserSchema),
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body as LoginUserInput);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
