import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, type UserRole } from '../schema';
import { eq } from 'drizzle-orm';

export async function getUsers(role?: UserRole): Promise<User[]> {
  try {
    // Build query with conditional where clause
    const results = role !== undefined
      ? await db.select()
          .from(usersTable)
          .where(eq(usersTable.role, role))
          .execute()
      : await db.select()
          .from(usersTable)
          .execute();

    // Return users with proper type conversion
    return results.map(user => ({
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}