import { z } from 'zod';

const normalizedEmailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

export const signupSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(6),
  full_name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  role: z.enum(['student', 'tutor', 'parent', 'institution']).optional(),
  is_parent: z.boolean().optional(),
  otp: z.string().trim().length(6).optional()
});

export const requestOtpSchema = z.object({
  email: normalizedEmailSchema
});

export const verifyEmailSchema = z.object({
  email: normalizedEmailSchema,
  otp: z.string().trim().length(6)
});

export const resendVerifySchema = z.object({
  email: normalizedEmailSchema
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(6)
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1)
});

export const resetPasswordSchema = z.object({
  email: normalizedEmailSchema
});

export const updatePasswordSchema = z.object({
  current_password: z.string().min(6).optional(),
  new_password: z.string().min(6)
});

export const confirmResetSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(6),
});
