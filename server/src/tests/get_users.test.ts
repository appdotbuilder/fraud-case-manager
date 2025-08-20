import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UserRole } from '../schema';
import { getUsers } from '../handlers/get_users';
import { eq } from 'drizzle-orm';

// Test users with different roles
const testUsers: CreateUserInput[] = [
  {
    username: 'admin_user',
    email: 'admin@test.com',
    role: 'admin'
  },
  {
    username: 'investigator1',
    email: 'investigator1@test.com',
    role: 'investigator'
  },
  {
    username: 'investigator2',
    email: 'investigator2@test.com',
    role: 'investigator'
  },
  {
    username: 'analyst_user',
    email: 'analyst@test.com',
    role: 'analyst'
  },
  {
    username: 'viewer_user',
    email: 'viewer@test.com',
    role: 'viewer'
  }
];

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    
    expect(result).toEqual([]);
  });

  it('should return all users when no role filter is provided', async () => {
    // Create test users
    for (const user of testUsers) {
      await db.insert(usersTable).values(user).execute();
    }

    const result = await getUsers();

    expect(result).toHaveLength(5);
    
    // Verify all roles are included
    const roles = result.map(user => user.role);
    expect(roles).toContain('admin');
    expect(roles).toContain('investigator');
    expect(roles).toContain('analyst');
    expect(roles).toContain('viewer');
    
    // Verify structure
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should filter users by admin role', async () => {
    // Create test users
    for (const user of testUsers) {
      await db.insert(usersTable).values(user).execute();
    }

    const result = await getUsers('admin');

    expect(result).toHaveLength(1);
    expect(result[0].role).toEqual('admin');
    expect(result[0].username).toEqual('admin_user');
    expect(result[0].email).toEqual('admin@test.com');
  });

  it('should filter users by investigator role', async () => {
    // Create test users
    for (const user of testUsers) {
      await db.insert(usersTable).values(user).execute();
    }

    const result = await getUsers('investigator');

    expect(result).toHaveLength(2);
    result.forEach(user => {
      expect(user.role).toEqual('investigator');
    });

    const usernames = result.map(user => user.username);
    expect(usernames).toContain('investigator1');
    expect(usernames).toContain('investigator2');
  });

  it('should filter users by analyst role', async () => {
    // Create test users
    for (const user of testUsers) {
      await db.insert(usersTable).values(user).execute();
    }

    const result = await getUsers('analyst');

    expect(result).toHaveLength(1);
    expect(result[0].role).toEqual('analyst');
    expect(result[0].username).toEqual('analyst_user');
  });

  it('should filter users by viewer role', async () => {
    // Create test users
    for (const user of testUsers) {
      await db.insert(usersTable).values(user).execute();
    }

    const result = await getUsers('viewer');

    expect(result).toHaveLength(1);
    expect(result[0].role).toEqual('viewer');
    expect(result[0].username).toEqual('viewer_user');
  });

  it('should return empty array when filtering by role that does not exist', async () => {
    // Create only admin users
    await db.insert(usersTable).values({
      username: 'admin_only',
      email: 'admin@test.com',
      role: 'admin'
    }).execute();

    const result = await getUsers('investigator');
    
    expect(result).toHaveLength(0);
  });

  it('should verify users are saved to database correctly', async () => {
    const userInput = testUsers[0];
    await db.insert(usersTable).values(userInput).execute();

    // Verify through direct database query
    const savedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, 'admin_user'))
      .execute();

    expect(savedUsers).toHaveLength(1);
    expect(savedUsers[0].username).toEqual('admin_user');
    expect(savedUsers[0].email).toEqual('admin@test.com');
    expect(savedUsers[0].role).toEqual('admin');
    expect(savedUsers[0].created_at).toBeInstanceOf(Date);
    expect(savedUsers[0].updated_at).toBeInstanceOf(Date);

    // Verify through handler
    const handlerResult = await getUsers();
    expect(handlerResult).toHaveLength(1);
    expect(handlerResult[0].username).toEqual('admin_user');
  });

  it('should handle multiple users with same role correctly', async () => {
    // Create multiple investigators
    const investigators = [
      { username: 'inv1', email: 'inv1@test.com', role: 'investigator' as UserRole },
      { username: 'inv2', email: 'inv2@test.com', role: 'investigator' as UserRole },
      { username: 'inv3', email: 'inv3@test.com', role: 'investigator' as UserRole }
    ];

    for (const user of investigators) {
      await db.insert(usersTable).values(user).execute();
    }

    const result = await getUsers('investigator');
    
    expect(result).toHaveLength(3);
    result.forEach(user => {
      expect(user.role).toEqual('investigator');
    });

    // Verify usernames are unique
    const usernames = result.map(user => user.username);
    expect(new Set(usernames).size).toEqual(3);
  });
});