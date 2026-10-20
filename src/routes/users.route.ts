import { Router } from 'express';
import { HttpError } from '../middlewares/http-error.js';
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middlewares/require-auth.js';
import { validateBody } from '../middlewares/validate-body.js';
import { createUserService } from '../users/user.service.js';
import {
  findByEmailHash,
  findById,
  insertUser,
} from '../users/user.repository.js';
import { createUserSchema, type CreateUserInput } from '../users/user.schema.js';

const userService = createUserService({ findByEmailHash, findById, insertUser });

export const usersRouter = Router();

usersRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(createUserSchema),
  async (req, res, next) => {
    try {
      const user = await userService.create(req.body as CreateUserInput);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },
);

usersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;

    if (!auth) {
      next(new HttpError(401, 'Unauthorized'));
      return;
    }

    const user = await userService.getById(auth, req.params.id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});
