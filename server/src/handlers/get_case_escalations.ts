import { db } from '../db';
import { caseEscalationsTable, usersTable, fraudCasesTable } from '../db/schema';
import { type CaseEscalation } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getCaseEscalations(caseId: number, userId?: number): Promise<CaseEscalation[]> {
  try {
    // First, verify that the case exists
    const caseExists = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, caseId))
      .limit(1)
      .execute();

    if (caseExists.length === 0) {
      throw new Error('Fraud case not found');
    }

    // If userId is provided, validate that the user exists and has appropriate permissions
    if (userId !== undefined) {
      const user = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1)
        .execute();

      if (user.length === 0) {
        throw new Error('User not found');
      }

      // Check if user has permission to view escalation history
      // Only admin, investigator, and analyst roles can view escalation history
      // Viewers have limited access
      const userRole = user[0].role;
      if (userRole === 'viewer') {
        throw new Error('Insufficient permissions to view escalation history');
      }
    }

    // Fetch all escalations for the case, ordered by creation date (newest first)
    const escalations = await db.select()
      .from(caseEscalationsTable)
      .where(eq(caseEscalationsTable.case_id, caseId))
      .orderBy(caseEscalationsTable.created_at)
      .execute();

    // Return escalations with proper date coercion
    return escalations.map(escalation => ({
      ...escalation,
      created_at: new Date(escalation.created_at)
    }));
  } catch (error) {
    console.error('Failed to get case escalations:', error);
    throw error;
  }
}