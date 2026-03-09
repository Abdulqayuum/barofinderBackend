import { z } from 'zod';

export const subscriptionCreateSchema = z.object({
  plan: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  transaction_ref: z.string().optional().nullable()
});
