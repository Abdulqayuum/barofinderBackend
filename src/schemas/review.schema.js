import { z } from 'zod';

export const tutorReviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable()
});

export const tutorReviewUpdateSchema = tutorReviewCreateSchema.partial();

export const courseReviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable()
});
