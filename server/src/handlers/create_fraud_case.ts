import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type CreateFraudCaseInput, type FraudCase } from '../schema';
import { eq } from 'drizzle-orm';

export const createFraudCase = async (input: CreateFraudCaseInput): Promise<FraudCase> => {
  try {
    // Validate that the creator exists
    const creator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (creator.length === 0) {
      throw new Error(`User with ID ${input.created_by} does not exist`);
    }

    // Insert fraud case record
    const result = await db.insert(fraudCasesTable)
      .values({
        txid: input.txid,
        description: input.description,
        status: 'open', // Always starts as 'open'
        priority: input.priority, // Priority is required in input type
        assigned_to: null, // Initially unassigned
        created_by: input.created_by
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Fraud case creation failed:', error);
    throw error;
  }
};