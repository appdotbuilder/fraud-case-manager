import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { type FraudCase } from '../schema';

export async function getFraudCaseById(id: number, userId?: number): Promise<FraudCase | null> {
  try {
    // Get the case with user information for permission checking
    const result = await db.select()
      .from(fraudCasesTable)
      .leftJoin(usersTable, eq(fraudCasesTable.created_by, usersTable.id))
      .where(eq(fraudCasesTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const caseData = result[0].fraud_cases;
    const creatorData = result[0].users;

    // If userId is provided, check permissions
    if (userId !== undefined) {
      // Get the requesting user's role
      const userResult = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      if (userResult.length === 0) {
        return null; // User doesn't exist
      }

      const userRole = userResult[0].role;

      // Permission logic:
      // - admin: can view all cases
      // - investigator: can view cases they created or are assigned to
      // - analyst: can view cases they created or are assigned to
      // - viewer: can view all cases (read-only role)
      if (userRole === 'admin' || userRole === 'viewer') {
        // Admin and viewer can see all cases
      } else if (userRole === 'investigator' || userRole === 'analyst') {
        // Can only view cases they created or are assigned to
        if (caseData.created_by !== userId && caseData.assigned_to !== userId) {
          return null; // No permission to view this case
        }
      } else {
        return null; // Unknown role
      }
    }

    return {
      id: caseData.id,
      txid: caseData.txid,
      description: caseData.description,
      status: caseData.status,
      priority: caseData.priority,
      assigned_to: caseData.assigned_to,
      created_by: caseData.created_by,
      created_at: caseData.created_at,
      updated_at: caseData.updated_at
    };
  } catch (error) {
    console.error('Failed to get fraud case by ID:', error);
    throw error;
  }
}