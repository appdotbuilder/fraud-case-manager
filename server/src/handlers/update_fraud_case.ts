import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type UpdateFraudCaseInput, type FraudCase } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function updateFraudCase(input: UpdateFraudCaseInput, userId: number): Promise<FraudCase> {
  try {
    // First, verify the case exists
    const existingCase = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, input.id))
      .execute();

    if (existingCase.length === 0) {
      throw new Error(`Fraud case with id ${input.id} not found`);
    }

    const caseRecord = existingCase[0];

    // Get user's role for permission validation
    const userResult = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (userResult.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    const user = userResult[0];

    // Permission validation: only assigned investigators/analysts or admins can update cases
    const canUpdate = user.role === 'admin' || 
                     (user.role === 'investigator' && caseRecord.assigned_to === userId) ||
                     (user.role === 'analyst' && caseRecord.assigned_to === userId);

    if (!canUpdate) {
      throw new Error('Insufficient permissions to update this fraud case');
    }

    // If assigned_to is being changed and is not null, verify the assignee exists
    if (input.assigned_to !== undefined && input.assigned_to !== null) {
      const assigneeResult = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.assigned_to))
        .execute();

      if (assigneeResult.length === 0) {
        throw new Error(`User with id ${input.assigned_to} not found`);
      }
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.txid !== undefined) {
      updateData.txid = input.txid;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }

    if (input.assigned_to !== undefined) {
      updateData.assigned_to = input.assigned_to;
    }

    // Update the fraud case
    const result = await db.update(fraudCasesTable)
      .set(updateData)
      .where(eq(fraudCasesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Update fraud case failed:', error);
    throw error;
  }
}