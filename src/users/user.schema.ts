import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from './user.model.js';

const CURP_PATTERN =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

function blankToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

const nombreSchema = z.string().trim().min(2).max(100);

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

const telefonoSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
);

const curpSchema = z.preprocess(
  blankToUndefined,
  z.string().trim().toUpperCase().regex(CURP_PATTERN).optional(),
);

const passwordSchema = z.string().min(8).max(72);

const rolSchema = z.enum(USER_ROLES);

function firstQueryValue(value: unknown): unknown {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === undefined || raw === '') {
    return undefined;
  }

  return raw;
}

function queryNumber(fallback: number, min: number, max: number) {
  return z.preprocess((value) => {
    const raw = firstQueryValue(value);

    return raw === undefined ? fallback : raw;
  }, z.coerce.number().int().min(min).max(max));
}

export const listUsersQuerySchema = z.object({
  page: queryNumber(1, 1, Number.MAX_SAFE_INTEGER),
  limit: queryNumber(20, 1, 100),
  estatus: z.preprocess(
    firstQueryValue,
    z.enum(USER_STATUSES).optional(),
  ),
});

export const loginUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const createUserSchema = z.object({
  nombre: nombreSchema,
  email: emailSchema,
  telefono: telefonoSchema,
  curp: curpSchema,
  password: passwordSchema,
  rol: rolSchema.optional(),
});

const clearableTelefonoSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{10}$/)
    .nullable()
    .optional(),
);

const clearableCurpSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURP_PATTERN)
    .nullable()
    .optional(),
);

export const updateUserSchema = z
  .object({
    nombre: nombreSchema.optional(),
    email: emailSchema.optional(),
    telefono: clearableTelefonoSchema,
    curp: clearableCurpSchema,
    password: passwordSchema.optional(),
    rol: rolSchema.optional(),
    estatus: z.enum(USER_STATUSES).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'At least one field is required',
  );

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
