import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums for PostgreSQL
export const userRoleEnum = pgEnum('user_role', ['admin', 'investigator', 'analyst', 'viewer']);
export const caseStatusEnum = pgEnum('case_status', ['open', 'in_progress', 'escalated', 'resolved', 'closed']);
export const casePriorityEnum = pgEnum('case_priority', ['low', 'medium', 'high', 'critical']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Fraud cases table
export const fraudCasesTable = pgTable('fraud_cases', {
  id: serial('id').primaryKey(),
  txid: text('txid').notNull().unique(), // Transaction ID - unique identifier
  description: text('description').notNull(),
  status: caseStatusEnum('status').notNull().default('open'),
  priority: casePriorityEnum('priority').notNull().default('medium'),
  assigned_to: integer('assigned_to'), // Foreign key to users, nullable
  created_by: integer('created_by').notNull(), // Foreign key to users
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Case escalations table for tracking escalation history
export const caseEscalationsTable = pgTable('case_escalations', {
  id: serial('id').primaryKey(),
  case_id: integer('case_id').notNull(), // Foreign key to fraud_cases
  escalated_by: integer('escalated_by').notNull(), // Foreign key to users
  escalated_to: integer('escalated_to'), // Foreign key to users, nullable
  previous_status: caseStatusEnum('previous_status').notNull(),
  new_status: caseStatusEnum('new_status').notNull(),
  previous_priority: casePriorityEnum('previous_priority').notNull(),
  new_priority: casePriorityEnum('new_priority').notNull(),
  reason: text('reason').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdCases: many(fraudCasesTable, { relationName: 'created_cases' }),
  assignedCases: many(fraudCasesTable, { relationName: 'assigned_cases' }),
  escalationsInitiated: many(caseEscalationsTable, { relationName: 'escalations_initiated' }),
  escalationsReceived: many(caseEscalationsTable, { relationName: 'escalations_received' })
}));

export const fraudCasesRelations = relations(fraudCasesTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [fraudCasesTable.created_by],
    references: [usersTable.id],
    relationName: 'created_cases'
  }),
  assignee: one(usersTable, {
    fields: [fraudCasesTable.assigned_to],
    references: [usersTable.id],
    relationName: 'assigned_cases'
  }),
  escalations: many(caseEscalationsTable)
}));

export const caseEscalationsRelations = relations(caseEscalationsTable, ({ one }) => ({
  case: one(fraudCasesTable, {
    fields: [caseEscalationsTable.case_id],
    references: [fraudCasesTable.id]
  }),
  escalatedBy: one(usersTable, {
    fields: [caseEscalationsTable.escalated_by],
    references: [usersTable.id],
    relationName: 'escalations_initiated'
  }),
  escalatedTo: one(usersTable, {
    fields: [caseEscalationsTable.escalated_to],
    references: [usersTable.id],
    relationName: 'escalations_received'
  })
}));

// TypeScript types for the tables
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type FraudCase = typeof fraudCasesTable.$inferSelect;
export type NewFraudCase = typeof fraudCasesTable.$inferInsert;

export type CaseEscalation = typeof caseEscalationsTable.$inferSelect;
export type NewCaseEscalation = typeof caseEscalationsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  fraudCases: fraudCasesTable,
  caseEscalations: caseEscalationsTable
};

export const tableRelations = {
  usersRelations,
  fraudCasesRelations,
  caseEscalationsRelations
};