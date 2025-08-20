import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type PermissionCheck, type UserRole } from '../schema';

export async function checkPermissions(check: PermissionCheck): Promise<boolean> {
  try {
    // Get user role first
    const userRole = await getUserRole(check.user_id);
    
    if (!userRole) {
      return false; // User not found
    }

    // Admin has full access to everything
    if (userRole === 'admin') {
      return true;
    }

    // Define permissions matrix based on role
    const permissions = {
      investigator: {
        case: ['create', 'read', 'update', 'escalate', 'assign'],
        user: ['read'], // Can read user info for assignments
        escalation: ['create', 'read']
      },
      analyst: {
        case: ['read', 'update', 'escalate'], // Cannot create or assign cases
        user: ['read'], // Can read user info
        escalation: ['create', 'read'] // Can escalate with restrictions
      },
      viewer: {
        case: ['read'], // Read-only access
        user: ['read'], // Can read user info
        escalation: ['read'] // Can view escalation history
      }
    };

    // Check if the role has permission for the requested action on the resource
    const rolePermissions = permissions[userRole];
    if (!rolePermissions || !rolePermissions[check.resource]) {
      return false;
    }

    return rolePermissions[check.resource].includes(check.action);
  } catch (error) {
    console.error('Permission check failed:', error);
    return false; // Fail closed - deny access on error
  }
}

export async function getUserRole(userId: number): Promise<UserRole | null> {
  try {
    const result = await db.select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (result.length === 0) {
      return null; // User not found
    }

    return result[0].role;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return null;
  }
}