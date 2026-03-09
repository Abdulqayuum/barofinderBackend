import { z } from 'zod';

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  is_parent: z.boolean().optional(),
  student_level: z.string().optional().nullable(),
  subjects_interested: z.array(z.string()).optional().nullable()
});
