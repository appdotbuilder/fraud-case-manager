import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type FraudCase, type CaseFilters } from '../schema';
import { eq, and, or, type SQL } from 'drizzle-orm';

export async function getFraudCases(filters?: CaseFilters, userId?: number): Promise<FraudCase[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        conditions.push(eq(fraudCasesTable.status, filters.status));
      }

      if (filters.priority) {
        conditions.push(eq(fraudCasesTable.priority, filters.priority));
      }

      if (filters.assigned_to !== undefined) {
        conditions.push(eq(fraudCasesTable.assigned_to, filters.assigned_to));
      }

      if (filters.created_by) {
        conditions.push(eq(fraudCasesTable.created_by, filters.created_by));
      }

      if (filters.txid) {
        conditions.push(eq(fraudCasesTable.txid, filters.txid));
      }
    }

    // Apply permission-based filtering if userId is provided
    if (userId !== undefined) {
      // Get user role to determine permissions
      const userResult = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];

      // Apply role-based restrictions
      if (user.role === 'viewer') {
        // Viewers can only see cases assigned to them
        conditions.push(eq(fraudCasesTable.assigned_to, userId));
      } else if (user.role === 'analyst') {
        // Analysts can see cases they created OR are assigned to
        conditions.push(
          or(
            eq(fraudCasesTable.assigned_to, userId),
            eq(fraudCasesTable.created_by, userId)
          )!
        );
      }
      // Investigators and admins can see all cases (no additional restrictions)
    }

    // Execute query with or without conditions
    const results = conditions.length > 0
      ? await db.select()
          .from(fraudCasesTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select()
          .from(fraudCasesTable)
          .execute();

    return results;

  } catch (error) {
    console.error('Failed to get fraud cases:', error);
    throw error;
  }
}