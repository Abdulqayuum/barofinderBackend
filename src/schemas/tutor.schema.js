import { z } from 'zod';

const availabilityItem = z.object({
  day: z.string(),
  startTime: z.string(),
  endTime: z.string()
});

export const upsertTutorSchema = z.object({
  bio: z.string().min(1),
  education: z.string().optional().nullable(),
  teaching_style: z.string().optional().nullable(),
  experience_years: z.number().min(0).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  subjects: z.array(z.string()).min(1),
  levels: z.array(z.string()).optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  service_areas: z.array(z.string()).optional().nullable(),
  online_available: z.boolean().optional(),
  offline_available: z.boolean().optional(),
  online_hourly: z.number().min(0).optional(),
  offline_hourly: z.number().min(0).optional().nullable(),
  currency: z.string().optional().nullable(),
  packages: z.array(z.object({ sessions: z.number(), price: z.number() })).optional().nullable(),
  availability: z.array(availabilityItem).optional().nullable(),
  profile_photo_url: z.string().optional().nullable(),
  open_to_work: z.boolean().optional(),
  verification_documents: z.array(z.any()).optional().nullable()
});
