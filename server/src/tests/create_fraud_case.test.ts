import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type CreateFraudCaseInput } from '../schema';
import { createFraudCase } from '../handlers/create_fraud_case';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'test_investigator',
  email: 'investigator@test.com',
  role: 'investigator' as const
};

// Test input with all fields specified
const testInput: CreateFraudCaseInput = {
  txid: 'TX123456789',
  description: 'Suspicious transaction detected with unusual patterns',
  priority: 'high',
  created_by: 0 // Will be set after user creation
};

describe('createFraudCase', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a fraud case with all fields', async () => {
    // Create prerequisite user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, created_by: userId };

    const result = await createFraudCase(input);

    // Basic field validation
    expect(result.txid).toEqual('TX123456789');
    expect(result.description).toEqual(testInput.description);
    expect(result.status).toEqual('open'); // Always starts as 'open'
    expect(result.priority).toEqual('high');
    expect(result.assigned_to).toBeNull(); // Initially unassigned
    expect(result.created_by).toEqual(userId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle medium priority correctly', async () => {
    // Create prerequisite user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    
    // Note: Zod's default('medium') would be applied during parsing,
    // but the TypeScript type still requires priority to be explicitly provided
    const inputWithMediumPriority: CreateFraudCaseInput = {
      txid: 'TX987654321',
      description: 'Another suspicious transaction',
      priority: 'medium',
      created_by: userId
    };

    const result = await createFraudCase(inputWithMediumPriority);

    expect(result.priority).toEqual('medium');
    expect(result.status).toEqual('open');
    expect(result.assigned_to).toBeNull();
  });

  it('should save fraud case to database', async () => {
    // Create prerequisite user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, created_by: userId };

    const result = await createFraudCase(input);

    // Query database to verify case was saved
    const cases = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, result.id))
      .execute();

    expect(cases).toHaveLength(1);
    expect(cases[0].txid).toEqual('TX123456789');
    expect(cases[0].description).toEqual(testInput.description);
    expect(cases[0].status).toEqual('open');
    expect(cases[0].priority).toEqual('high');
    expect(cases[0].assigned_to).toBeNull();
    expect(cases[0].created_by).toEqual(userId);
    expect(cases[0].created_at).toBeInstanceOf(Date);
    expect(cases[0].updated_at).toBeInstanceOf(Date);
  });

  it('should fail when creator user does not exist', async () => {
    const invalidInput = {
      ...testInput,
      created_by: 99999 // Non-existent user ID
    };

    await expect(createFraudCase(invalidInput)).rejects.toThrow(/User with ID 99999 does not exist/i);
  });

  it('should fail when txid is duplicate', async () => {
    // Create prerequisite user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, created_by: userId };

    // Create first case successfully
    await createFraudCase(input);

    // Attempt to create second case with same txid
    const duplicateInput = {
      ...input,
      description: 'Different description but same TXID'
    };

    await expect(createFraudCase(duplicateInput)).rejects.toThrow();
  });

  it('should create multiple cases with different txids', async () => {
    // Create prerequisite user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create first case
    const input1 = {
      txid: 'TX111111111',
      description: 'First suspicious transaction',
      priority: 'low' as const,
      created_by: userId
    };

    // Create second case
    const input2 = {
      txid: 'TX222222222',
      description: 'Second suspicious transaction',
      priority: 'critical' as const,
      created_by: userId
    };

    const result1 = await createFraudCase(input1);
    const result2 = await createFraudCase(input2);

    // Verify both cases were created with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.txid).toEqual('TX111111111');
    expect(result2.txid).toEqual('TX222222222');
    expect(result1.priority).toEqual('low');
    expect(result2.priority).toEqual('critical');

    // Verify both cases exist in database
    const allCases = await db.select()
      .from(fraudCasesTable)
      .execute();

    expect(allCases).toHaveLength(2);
  });
});