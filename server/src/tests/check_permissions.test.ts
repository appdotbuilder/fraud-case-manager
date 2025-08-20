import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type PermissionCheck, type CreateUserInput } from '../schema';
import { checkPermissions, getUserRole } from '../handlers/check_permissions';

// Test users for different roles
const adminUser: CreateUserInput = {
  username: 'admin_user',
  email: 'admin@example.com',
  role: 'admin'
};

const investigatorUser: CreateUserInput = {
  username: 'investigator_user',
  email: 'investigator@example.com',
  role: 'investigator'
};

const analystUser: CreateUserInput = {
  username: 'analyst_user',
  email: 'analyst@example.com',
  role: 'analyst'
};

const viewerUser: CreateUserInput = {
  username: 'viewer_user',
  email: 'viewer@example.com',
  role: 'viewer'
};

describe('getUserRole', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user role when user exists', async () => {
    // Create a test user
    const result = await db.insert(usersTable)
      .values({
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      })
      .returning()
      .execute();

    const userId = result[0].id;
    const role = await getUserRole(userId);

    expect(role).toEqual('admin');
  });

  it('should return null when user does not exist', async () => {
    const role = await getUserRole(999); // Non-existent user ID
    expect(role).toBeNull();
  });
});

describe('checkPermissions - Admin Role', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let adminId: number;

  beforeEach(async () => {
    const result = await db.insert(usersTable)
      .values({
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      })
      .returning()
      .execute();
    adminId = result[0].id;
  });

  it('should grant admin full access to all case operations', async () => {
    const actions = ['create', 'read', 'update', 'delete', 'escalate', 'assign'] as const;
    
    for (const action of actions) {
      const check: PermissionCheck = {
        user_id: adminId,
        action: action,
        resource: 'case'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(true);
    }
  });

  it('should grant admin full access to all user operations', async () => {
    const actions = ['create', 'read', 'update', 'delete', 'escalate', 'assign'] as const;
    
    for (const action of actions) {
      const check: PermissionCheck = {
        user_id: adminId,
        action: action,
        resource: 'user'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(true);
    }
  });

  it('should grant admin full access to all escalation operations', async () => {
    const actions = ['create', 'read', 'update', 'delete', 'escalate', 'assign'] as const;
    
    for (const action of actions) {
      const check: PermissionCheck = {
        user_id: adminId,
        action: action,
        resource: 'escalation'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(true);
    }
  });
});

describe('checkPermissions - Investigator Role', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let investigatorId: number;

  beforeEach(async () => {
    const result = await db.insert(usersTable)
      .values({
        username: investigatorUser.username,
        email: investigatorUser.email,
        role: investigatorUser.role
      })
      .returning()
      .execute();
    investigatorId = result[0].id;
  });

  it('should allow investigator to create, read, update, escalate, and assign cases', async () => {
    const allowedActions = ['create', 'read', 'update', 'escalate', 'assign'] as const;
    
    for (const action of allowedActions) {
      const check: PermissionCheck = {
        user_id: investigatorId,
        action: action,
        resource: 'case'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(true);
    }
  });

  it('should deny investigator delete access to cases', async () => {
    const check: PermissionCheck = {
      user_id: investigatorId,
      action: 'delete',
      resource: 'case'
    };
    
    const hasPermission = await checkPermissions(check);
    expect(hasPermission).toBe(false);
  });

  it('should allow investigator to read users but not modify them', async () => {
    const readCheck: PermissionCheck = {
      user_id: investigatorId,
      action: 'read',
      resource: 'user'
    };
    
    const hasReadPermission = await checkPermissions(readCheck);
    expect(hasReadPermission).toBe(true);

    // Test denied operations
    const deniedActions = ['create', 'update', 'delete', 'escalate', 'assign'] as const;
    for (const action of deniedActions) {
      const check: PermissionCheck = {
        user_id: investigatorId,
        action: action,
        resource: 'user'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(false);
    }
  });

  it('should allow investigator to create and read escalations', async () => {
    const allowedActions = ['create', 'read'] as const;
    
    for (const action of allowedActions) {
      const check: PermissionCheck = {
        user_id: investigatorId,
        action: action,
        resource: 'escalation'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(true);
    }
  });
});

describe('checkPermissions - Analyst Role', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let analystId: number;

  beforeEach(async () => {
    const result = await db.insert(usersTable)
      .values({
        username: analystUser.username,
        email: analystUser.email,
        role: analystUser.role
      })
      .returning()
      .execute();
    analystId = result[0].id;
  });

  it('should allow analyst to read, update, and escalate cases', async () => {
    const allowedActions = ['read', 'update', 'escalate'] as const;
    
    for (const action of allowedActions) {
      const check: PermissionCheck = {
        user_id: analystId,
        action: action,
        resource: 'case'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(true);
    }
  });

  it('should deny analyst create, delete, and assign access to cases', async () => {
    const deniedActions = ['create', 'delete', 'assign'] as const;
    
    for (const action of deniedActions) {
      const check: PermissionCheck = {
        user_id: analystId,
        action: action,
        resource: 'case'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(false);
    }
  });

  it('should allow analyst to read users only', async () => {
    const readCheck: PermissionCheck = {
      user_id: analystId,
      action: 'read',
      resource: 'user'
    };
    
    const hasReadPermission = await checkPermissions(readCheck);
    expect(hasReadPermission).toBe(true);

    // Test denied operations
    const deniedActions = ['create', 'update', 'delete', 'escalate', 'assign'] as const;
    for (const action of deniedActions) {
      const check: PermissionCheck = {
        user_id: analystId,
        action: action,
        resource: 'user'
      };
      
      const hasPermission = await checkPermissions(check);
      expect(hasPermission).toBe(false);
    }
  });
});

describe('checkPermissions - Viewer Role', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let viewerId: number;

  beforeEach(async () => {
    const result = await db.insert(usersTable)
      .values({
        username: viewerUser.username,
        email: viewerUser.email,
        role: viewerUser.role
      })
      .returning()
      .execute();
    viewerId = result[0].id;
  });

  it('should allow viewer to read cases, users, and escalations only', async () => {
    const resources = ['case', 'user', 'escalation'] as const;
    
    for (const resource of resources) {
      const readCheck: PermissionCheck = {
        user_id: viewerId,
        action: 'read',
        resource: resource
      };
      
      const hasPermission = await checkPermissions(readCheck);
      expect(hasPermission).toBe(true);
    }
  });

  it('should deny viewer all write operations', async () => {
    const resources = ['case', 'user', 'escalation'] as const;
    const writeActions = ['create', 'update', 'delete', 'escalate', 'assign'] as const;
    
    for (const resource of resources) {
      for (const action of writeActions) {
        const check: PermissionCheck = {
          user_id: viewerId,
          action: action,
          resource: resource
        };
        
        const hasPermission = await checkPermissions(check);
        expect(hasPermission).toBe(false);
      }
    }
  });
});

describe('checkPermissions - Edge Cases', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should deny permissions for non-existent user', async () => {
    const check: PermissionCheck = {
      user_id: 999, // Non-existent user
      action: 'read',
      resource: 'case'
    };
    
    const hasPermission = await checkPermissions(check);
    expect(hasPermission).toBe(false);
  });

  it('should handle database errors gracefully', async () => {
    // Test with an invalid user ID that might cause database errors
    const check: PermissionCheck = {
      user_id: -1, // Invalid user ID
      action: 'read',
      resource: 'case'
    };
    
    const hasPermission = await checkPermissions(check);
    expect(hasPermission).toBe(false);
  });
});