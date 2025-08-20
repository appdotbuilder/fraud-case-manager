import { z } from 'zod';

// User Role enum
export const userRoleSchema = z.enum(['admin', 'investigator', 'analyst', 'viewer']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Case Status enum for workflow management
export const caseStatusSchema = z.enum(['open', 'in_progress', 'escalated', 'resolved', 'closed']);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

// Case Priority enum for escalation levels
export const casePrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type CasePriority = z.infer<typeof casePrioritySchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Fraud case schema
export const fraudCaseSchema = z.object({
  id: z.number(),
  txid: z.string(), // Transaction ID
  description: z.string(),
  status: caseStatusSchema,
  priority: casePrioritySchema,
  assigned_to: z.number().nullable(), // User ID of assigned investigator
  created_by: z.number(), // User ID of creator
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type FraudCase = z.infer<typeof fraudCaseSchema>;

// Case escalation history schema
export const caseEscalationSchema = z.object({
  id: z.number(),
  case_id: z.number(),
  escalated_by: z.number(), // User ID
  escalated_to: z.number().nullable(), // User ID of person escalated to
  previous_status: caseStatusSchema,
  new_status: caseStatusSchema,
  previous_priority: casePrioritySchema,
  new_priority: casePrioritySchema,
  reason: z.string(),
  created_at: z.coerce.date()
});

export type CaseEscalation = z.infer<typeof caseEscalationSchema>;

// Input schemas for creating users
export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Input schemas for creating fraud cases
export const createFraudCaseInputSchema = z.object({
  txid: z.string().min(1),
  description: z.string().min(10),
  priority: casePrioritySchema.default('medium'),
  created_by: z.number()
});

export type CreateFraudCaseInput = z.infer<typeof createFraudCaseInputSchema>;

// Input schemas for updating fraud cases
export const updateFraudCaseInputSchema = z.object({
  id: z.number(),
  txid: z.string().min(1).optional(),
  description: z.string().min(10).optional(),
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  assigned_to: z.number().nullable().optional()
});

export type UpdateFraudCaseInput = z.infer<typeof updateFraudCaseInputSchema>;

// Input schema for case escalation
export const escalateCaseInputSchema = z.object({
  case_id: z.number(),
  escalated_by: z.number(),
  escalated_to: z.number().nullable().optional(),
  new_status: caseStatusSchema.optional(),
  new_priority: casePrioritySchema,
  reason: z.string().min(10)
});

export type EscalateCaseInput = z.infer<typeof escalateCaseInputSchema>;

// Query filters for cases
export const caseFiltersSchema = z.object({
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  assigned_to: z.number().optional(),
  created_by: z.number().optional(),
  txid: z.string().optional()
});

export type CaseFilters = z.infer<typeof caseFiltersSchema>;

// Permission check schema
export const permissionCheckSchema = z.object({
  user_id: z.number(),
  action: z.enum(['create', 'read', 'update', 'delete', 'escalate', 'assign']),
  resource: z.enum(['case', 'user', 'escalation'])
});

export type PermissionCheck = z.infer<typeof permissionCheckSchema>;