import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  phone: z.string().optional(),
  city: z.string().optional(),
  role: z.enum(['student', 'tutor', 'parent']).optional(),
  is_parent: z.boolean().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1)
});

export const resetPasswordSchema = z.object({
  email: z.string().email()
});

export const updatePasswordSchema = z.object({
  current_password: z.string().min(6).optional(),
  new_password: z.string().min(6)
});
