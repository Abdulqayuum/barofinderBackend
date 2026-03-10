import { z } from 'zod';

const optionalNumericField = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}, z.number().optional().nullable());

export const enrollmentCreateSchema = z.object({
  payment_method: z.string().optional().nullable(),
  transaction_ref: z.string().optional().nullable(),
  amount: optionalNumericField,
  currency: z.string().optional().nullable()
});

export const enrollmentUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled'])
});
