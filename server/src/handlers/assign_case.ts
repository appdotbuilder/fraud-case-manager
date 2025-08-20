import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type FraudCase } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function assignCase(caseId: number, assignedTo: number, assignedBy: number): Promise<FraudCase> {
  try {
    // Validate that the case exists
    const existingCase = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, caseId))
      .execute();

    if (existingCase.length === 0) {
      throw new Error('Case not found');
    }

    // Validate that the assignee exists and has proper role
    const assignee = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, assignedTo))
      .execute();

    if (assignee.length === 0) {
      throw new Error('Assignee user not found');
    }

    // Check if assignee has proper role (investigator or analyst can be assigned cases)
    const validRoles = ['investigator', 'analyst'];
    if (!validRoles.includes(assignee[0].role)) {
      throw new Error('Assignee must have investigator or analyst role');
    }

    // Validate that the assigner exists and has authority (admin, investigator, or analyst)
    const assigner = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, assignedBy))
      .execute();

    if (assigner.length === 0) {
      throw new Error('Assigner user not found');
    }

    // Check if assigner has authority to assign cases
    const authorizedRoles = ['admin', 'investigator', 'analyst'];
    if (!authorizedRoles.includes(assigner[0].role)) {
      throw new Error('Assigner must have admin, investigator, or analyst role');
    }

    // Update the case assignment and status
    const result = await db.update(fraudCasesTable)
      .set({
        assigned_to: assignedTo,
        status: 'in_progress',
        updated_at: new Date()
      })
      .where(eq(fraudCasesTable.id, caseId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Case assignment failed:', error);
    throw error;
  }
}