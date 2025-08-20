import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function getUserById(id: number): Promise<User | null> {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('User lookup failed:', error);
    throw error;
  }
}