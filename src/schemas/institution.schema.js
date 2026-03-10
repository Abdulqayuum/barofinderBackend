import { z } from 'zod';

const optionalString = z.string().optional().nullable();
const optionalStringArray = z.array(z.string()).optional().nullable();

export const upsertInstitutionSchema = z.object({
  institution_name: z.string().min(1),
  institution_type: z.enum(['school', 'university', 'college', 'academy', 'training_center', 'other']),
  description: optionalString,
  website_url: optionalString,
  address: optionalString,
  city: optionalString,
  contact_person_name: optionalString,
  contact_person_title: optionalString,
  contact_email: z.string().email().optional().nullable(),
  contact_phone: optionalString,
});

export const institutionJobSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  subject: optionalString,
  level: optionalString,
  city: optionalString,
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary']).optional().nullable(),
  work_mode: z.enum(['on_site', 'online', 'hybrid']).optional().nullable(),
  salary_amount: z.number().min(0).optional().nullable(),
  salary_currency: optionalString,
  salary_period: z.enum(['hour', 'month', 'semester', 'contract']).optional().nullable(),
  requirements: optionalStringArray,
  benefits: optionalStringArray,
  application_email: z.string().email().optional().nullable(),
  application_phone: optionalString,
  application_url: optionalString,
  expires_at: optionalString,
  is_active: z.boolean().optional(),
});
