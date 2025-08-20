import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type FraudCase } from '../schema';
import { eq, and } from 'drizzle-orm';

export const closeCase = async (caseId: number, userId: number, resolution?: string): Promise<FraudCase> => {
  try {
    // First, verify the user exists and get their role
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Get the current case
    const cases = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, caseId))
      .execute();

    if (cases.length === 0) {
      throw new Error('Case not found');
    }

    const fraudCase = cases[0];

    // Validate that the case is in 'resolved' status
    if (fraudCase.status !== 'resolved') {
      throw new Error('Case must be in resolved status to be closed');
    }

    // Check permissions: only assigned investigator or admin can close cases
    const canClose = user.role === 'admin' || 
                    (fraudCase.assigned_to === userId && 
                     (user.role === 'investigator' || user.role === 'analyst'));

    if (!canClose) {
      throw new Error('Insufficient permissions to close this case');
    }

    // Update the case status to closed
    const result = await db.update(fraudCasesTable)
      .set({
        status: 'closed',
        updated_at: new Date()
      })
      .where(eq(fraudCasesTable.id, caseId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Case closure failed:', error);
    throw error;
  }
};