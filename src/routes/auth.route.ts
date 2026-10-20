import { Router } from 'express';
import { createAuthService } from '../auth/auth.service.js';
import {
  createSession,
  revokeByRefreshTokenHash,
  revokeSessionById,
  rotateRefreshToken,
} from '../auth/session.repository.js';
import { validateBody } from '../middlewares/validate-body.js';
import { findByEmailHash, findById } from '../users/user.repository.js';
import {
  loginUserSchema,
  refreshTokenSchema,
  type LoginUserInput,
  type RefreshTokenInput,
} from '../users/user.schema.js';

const authService = createAuthService(
  { findByEmailHash, findById },
  {
    createSession,
    rotateRefreshToken,
    revokeByRefreshTokenHash,
    revokeSessionById,
  },
);

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

authRouter.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  async (req, res, next) => {
    try {
      const result = await authService.refresh(req.body as RefreshTokenInput);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/logout',
  validateBody(refreshTokenSchema),
  async (req, res, next) => {
    try {
      await authService.logout(req.body as RefreshTokenInput);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
