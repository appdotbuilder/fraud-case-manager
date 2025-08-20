import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type FraudCase } from '../schema';
import { eq } from 'drizzle-orm';

export async function getFraudCaseByTxid(txid: string, userId?: number): Promise<FraudCase | null> {
  try {
    // Query the fraud case by txid
    const results = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.txid, txid))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const fraudCase = results[0];

    // If userId is provided, perform permission validation
    if (userId !== undefined) {
      // Get the user's role to check permissions
      const userResults = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      if (userResults.length === 0) {
        throw new Error('User not found');
      }

      const user = userResults[0];

      // Permission check: viewers and above can read cases they created or are assigned to
      // Investigators, analysts, and admins can read all cases
      const canRead = 
        user.role === 'admin' ||
        user.role === 'investigator' ||
        user.role === 'analyst' ||
        (user.role === 'viewer' && (fraudCase.created_by === userId || fraudCase.assigned_to === userId));

      if (!canRead) {
        throw new Error('Insufficient permissions to access this case');
      }
    }

    return fraudCase;
  } catch (error) {
    console.error('Failed to get fraud case by txid:', error);
    throw error;
  }
}