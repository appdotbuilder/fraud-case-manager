import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUserById } from '../handlers/get_user_by_id';

// Test user data
const testUserInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  role: 'investigator'
};

const testAdminInput: CreateUserInput = {
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin'
};

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when found', async () => {
    // Create a test user first
    const insertResults = await db.insert(usersTable)
      .values({
        username: testUserInput.username,
        email: testUserInput.email,
        role: testUserInput.role
      })
      .returning()
      .execute();

    const createdUser = insertResults[0];
    
    // Test the handler
    const result = await getUserById(createdUser.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.username).toEqual('testuser');
    expect(result!.email).toEqual('test@example.com');
    expect(result!.role).toEqual('investigator');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when user not found', async () => {
    const result = await getUserById(999);
    expect(result).toBeNull();
  });

  it('should return correct user when multiple users exist', async () => {
    // Create multiple users
    const insertResults = await db.insert(usersTable)
      .values([
        {
          username: testUserInput.username,
          email: testUserInput.email,
          role: testUserInput.role
        },
        {
          username: testAdminInput.username,
          email: testAdminInput.email,
          role: testAdminInput.role
        }
      ])
      .returning()
      .execute();

    const firstUser = insertResults[0];
    const secondUser = insertResults[1];

    // Test getting the first user
    const result1 = await getUserById(firstUser.id);
    expect(result1).not.toBeNull();
    expect(result1!.username).toEqual('testuser');
    expect(result1!.role).toEqual('investigator');

    // Test getting the second user
    const result2 = await getUserById(secondUser.id);
    expect(result2).not.toBeNull();
    expect(result2!.username).toEqual('admin');
    expect(result2!.role).toEqual('admin');
  });

  it('should handle different user roles correctly', async () => {
    const roles = ['admin', 'investigator', 'analyst', 'viewer'] as const;
    const createdUsers = [];

    // Create users with different roles
    for (let i = 0; i < roles.length; i++) {
      const insertResult = await db.insert(usersTable)
        .values({
          username: `user${i}`,
          email: `user${i}@example.com`,
          role: roles[i]
        })
        .returning()
        .execute();
      
      createdUsers.push(insertResult[0]);
    }

    // Verify each user can be retrieved with correct role
    for (let i = 0; i < createdUsers.length; i++) {
      const result = await getUserById(createdUsers[i].id);
      expect(result).not.toBeNull();
      expect(result!.role).toEqual(roles[i]);
      expect(result!.username).toEqual(`user${i}`);
    }
  });

  it('should return user with all required fields populated', async () => {
    // Create user
    const insertResults = await db.insert(usersTable)
      .values({
        username: testUserInput.username,
        email: testUserInput.email,
        role: testUserInput.role
      })
      .returning()
      .execute();

    const createdUser = insertResults[0];
    const result = await getUserById(createdUser.id);

    expect(result).not.toBeNull();
    
    // Verify all required fields are present
    expect(typeof result!.id).toBe('number');
    expect(typeof result!.username).toBe('string');
    expect(typeof result!.email).toBe('string');
    expect(typeof result!.role).toBe('string');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    
    // Verify field values
    expect(result!.id).toBeGreaterThan(0);
    expect(result!.username.length).toBeGreaterThan(0);
    expect(result!.email).toContain('@');
    expect(['admin', 'investigator', 'analyst', 'viewer']).toContain(result!.role);
  });
});