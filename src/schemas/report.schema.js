import { z } from 'zod';

const optionalId = z.union([z.string().trim().min(1), z.null()]).optional();

export const REPORT_REASON_VALUES = [
  'abuse_or_harassment',
  'attendance_or_disruption',
  'payment_issue',
  'inappropriate_content',
  'safety_concern',
  'other',
];

export const REPORT_STATUS_VALUES = ['pending', 'reviewing', 'resolved', 'dismissed'];
export const REPORT_ACTION_VALUES = ['none', 'warning_sent', 'account_suspended', 'no_action'];

export const tutorReportCreateSchema = z.object({
  target_user_id: z.string().trim().min(1),
  reason_category: z.enum(REPORT_REASON_VALUES),
  description: z.string().trim().min(10).max(2000),
  course_id: optionalId,
  enrollment_id: optionalId,
  conversation_id: optionalId,
});

export const adminTutorReportUpdateSchema = z.object({
  status: z.enum(REPORT_STATUS_VALUES).optional(),
  action_taken: z.enum(REPORT_ACTION_VALUES).optional(),
  admin_notes: z.union([z.string().trim().max(2000), z.null()]).optional(),
});
