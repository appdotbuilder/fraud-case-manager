import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Simple test input
const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  role: 'investigator'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('investigator');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].role).toEqual('investigator');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create users with different roles', async () => {
    const adminInput: CreateUserInput = {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    };

    const viewerInput: CreateUserInput = {
      username: 'viewer',
      email: 'viewer@example.com',
      role: 'viewer'
    };

    const adminResult = await createUser(adminInput);
    const viewerResult = await createUser(viewerInput);

    expect(adminResult.role).toEqual('admin');
    expect(viewerResult.role).toEqual('viewer');
    expect(adminResult.id).not.toEqual(viewerResult.id);
  });

  it('should enforce unique username constraint', async () => {
    await createUser(testInput);

    const duplicateInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com',
      role: 'analyst'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value/i);
  });

  it('should enforce unique email constraint', async () => {
    await createUser(testInput);

    const duplicateEmailInput: CreateUserInput = {
      username: 'differentuser',
      email: 'test@example.com', // Same email
      role: 'analyst'
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow(/duplicate key value/i);
  });

  it('should create users with all valid roles', async () => {
    const roles = ['admin', 'investigator', 'analyst', 'viewer'] as const;
    
    for (const role of roles) {
      const input: CreateUserInput = {
        username: `user_${role}`,
        email: `${role}@example.com`,
        role: role
      };

      const result = await createUser(input);
      expect(result.role).toEqual(role);
      expect(result.username).toEqual(`user_${role}`);
      expect(result.email).toEqual(`${role}@example.com`);
    }
  });

  it('should set timestamps correctly', async () => {
    const beforeCreation = new Date();
    const result = await createUser(testInput);
    const afterCreation = new Date();

    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at >= beforeCreation).toBe(true);
    expect(result.created_at <= afterCreation).toBe(true);
    expect(result.updated_at >= beforeCreation).toBe(true);
    expect(result.updated_at <= afterCreation).toBe(true);
  });
});