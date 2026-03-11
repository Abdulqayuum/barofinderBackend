import { z } from 'zod';

const optionalString = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || null;
}, z.string().optional().nullable());

const requiredString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return value.trim();
}, z.string().min(1));

const optionalEmail = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || null;
}, z.string().email().optional().nullable());

const optionalNumber = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return null;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : value;
}, z.number().min(0).optional().nullable());

const optionalStringArray = z.array(z.string()).optional().nullable();

export const upsertInstitutionSchema = z.object({
  institution_name: requiredString,
  institution_type: z.enum(['school', 'university', 'college', 'academy', 'training_center', 'other']),
  description: optionalString,
  website_url: optionalString,
  address: optionalString,
  city: optionalString,
  contact_person_name: optionalString,
  contact_person_title: optionalString,
  contact_email: optionalEmail,
  contact_phone: optionalString,
});

export const institutionJobSchema = z.object({
  title: requiredString,
  description: requiredString,
  subject: optionalString,
  level: optionalString,
  city: optionalString,
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary']).optional().nullable(),
  work_mode: z.enum(['on_site', 'online', 'hybrid']).optional().nullable(),
  salary_amount: optionalNumber,
  salary_currency: optionalString,
  salary_period: z.enum(['hour', 'month', 'semester', 'contract']).optional().nullable(),
  requirements: optionalStringArray,
  benefits: optionalStringArray,
  application_email: optionalEmail,
  application_phone: optionalString,
  application_url: optionalString,
  expires_at: optionalString,
  is_active: z.boolean().optional(),
});

export const institutionJobApplicationCreateSchema = z.object({
  cover_message: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    return value.trim();
  }, z.string().min(20).max(2000)),
  document_url: optionalString,
});

export const institutionJobApplicationUpdateSchema = z.object({
  status: z.enum(['pending', 'documents_requested', 'approved', 'rejected']).optional(),
  institution_notes: z.preprocess((value) => {
    if (value == null) return null;
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    return normalized || null;
  }, z.string().max(2000).optional().nullable()),
});
