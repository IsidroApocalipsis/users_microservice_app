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
  listUsers,
} from '../users/user.repository.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  type CreateUserInput,
} from '../users/user.schema.js';

const userService = createUserService({
  findByEmailHash,
  findById,
  insertUser,
  listUsers,
});

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

usersRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const page = await userService.list(query);
      res.status(200).json(page);
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

    const id = req.params.id;
    const user = await userService.getById(auth, Array.isArray(id) ? id[0] : id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});
