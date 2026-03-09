import { z } from 'zod';

export const enrollmentCreateSchema = z.object({
  payment_method: z.string().optional().nullable(),
  transaction_ref: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  currency: z.string().optional().nullable()
});

export const enrollmentUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled'])
});
