import { z } from 'zod';

export const courseCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  pricing_type: z.enum(['free', 'paid']).optional(),
  price: z.number().min(0),
  currency: z.string().optional().nullable(),
  max_students: z.number().int().min(1).optional(),
  cover_image_url: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_published: z.boolean().optional(),
  status: z.string().optional()
});

export const courseUpdateSchema = courseCreateSchema.partial();

export const lessonCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  content_type: z.string().optional(),
  content_url: z.string().optional().nullable(),
  external_url: z.string().optional().nullable(),
  text_content: z.string().optional().nullable(),
  duration_minutes: z.number().int().min(0).optional().nullable(),
  sort_order: z.number().int().optional()
});

export const lessonUpdateSchema = lessonCreateSchema.partial();

export const lessonReorderSchema = z.object({
  sort_order: z.number().int()
});

export const quizCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  passing_score: z.number().int().min(0).max(100).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  lesson_id: z.string().optional().nullable()
});

export const quizUpdateSchema = quizCreateSchema.partial();

export const questionCreateSchema = z.object({
  question_text: z.string().min(1),
  question_type: z.string().optional(),
  options: z.array(z.string()).min(1),
  correct_answer: z.string().min(1),
  sort_order: z.number().int().optional()
});

export const questionUpdateSchema = questionCreateSchema.partial();

export const quizSubmitSchema = z.object({
  answers: z.record(z.string(), z.string())
});
