import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createFraudCaseInputSchema,
  updateFraudCaseInputSchema,
  escalateCaseInputSchema,
  caseFiltersSchema,
  permissionCheckSchema,
  userRoleSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { getUserById } from './handlers/get_user_by_id';
import { createFraudCase } from './handlers/create_fraud_case';
import { getFraudCases } from './handlers/get_fraud_cases';
import { getFraudCaseById } from './handlers/get_fraud_case_by_id';
import { getFraudCaseByTxid } from './handlers/get_fraud_case_by_txid';
import { updateFraudCase } from './handlers/update_fraud_case';
import { assignCase } from './handlers/assign_case';
import { escalateCase } from './handlers/escalate_case';
import { getCaseEscalations } from './handlers/get_case_escalations';
import { checkPermissions, getUserRole } from './handlers/check_permissions';
import { getCaseStatistics } from './handlers/get_case_statistics';
import { closeCase } from './handlers/close_case';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .input(z.object({ role: userRoleSchema.optional() }).optional())
    .query(({ input }) => getUsers(input?.role)),

  getUserById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getUserById(input.id)),

  // Fraud case management
  createFraudCase: publicProcedure
    .input(createFraudCaseInputSchema)
    .mutation(({ input }) => createFraudCase(input)),

  getFraudCases: publicProcedure
    .input(z.object({
      filters: caseFiltersSchema.optional(),
      userId: z.number().optional()
    }).optional())
    .query(({ input }) => getFraudCases(input?.filters, input?.userId)),

  getFraudCaseById: publicProcedure
    .input(z.object({
      id: z.number(),
      userId: z.number().optional()
    }))
    .query(({ input }) => getFraudCaseById(input.id, input.userId)),

  getFraudCaseByTxid: publicProcedure
    .input(z.object({
      txid: z.string(),
      userId: z.number().optional()
    }))
    .query(({ input }) => getFraudCaseByTxid(input.txid, input.userId)),

  updateFraudCase: publicProcedure
    .input(z.object({
      case: updateFraudCaseInputSchema,
      userId: z.number()
    }))
    .mutation(({ input }) => updateFraudCase(input.case, input.userId)),

  assignCase: publicProcedure
    .input(z.object({
      caseId: z.number(),
      assignedTo: z.number(),
      assignedBy: z.number()
    }))
    .mutation(({ input }) => assignCase(input.caseId, input.assignedTo, input.assignedBy)),

  // Case escalation
  escalateCase: publicProcedure
    .input(escalateCaseInputSchema)
    .mutation(({ input }) => escalateCase(input)),

  getCaseEscalations: publicProcedure
    .input(z.object({
      caseId: z.number(),
      userId: z.number().optional()
    }))
    .query(({ input }) => getCaseEscalations(input.caseId, input.userId)),

  // Case closure
  closeCase: publicProcedure
    .input(z.object({
      caseId: z.number(),
      userId: z.number(),
      resolution: z.string().optional()
    }))
    .mutation(({ input }) => closeCase(input.caseId, input.userId, input.resolution)),

  // Permissions and authorization
  checkPermissions: publicProcedure
    .input(permissionCheckSchema)
    .query(({ input }) => checkPermissions(input)),

  getUserRole: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserRole(input.userId)),

  // Statistics and reporting
  getCaseStatistics: publicProcedure
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(({ input }) => getCaseStatistics(input?.userId))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC Case Management Server listening at port: ${port}`);
}

start();