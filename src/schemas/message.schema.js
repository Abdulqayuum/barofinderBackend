import { z } from 'zod';

export const conversationCreateSchema = z.object({
  student_id: z.string().trim().min(1),
  tutor_id: z.string().trim().min(1)
});

export const messageCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000)
});
