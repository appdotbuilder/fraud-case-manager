import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type UpdateFraudCaseInput } from '../schema';
import { updateFraudCase } from '../handlers/update_fraud_case';
import { eq } from 'drizzle-orm';

describe('updateFraudCase', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test user
  const createTestUser = async (role: 'admin' | 'investigator' | 'analyst' | 'viewer' = 'investigator') => {
    const userResult = await db.insert(usersTable)
      .values({
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        role: role
      })
      .returning()
      .execute();
    return userResult[0];
  };

  // Helper function to create test fraud case
  const createTestCase = async (createdBy: number, assignedTo?: number) => {
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: `TX${Date.now()}`,
        description: 'Test fraud case for updating',
        status: 'open',
        priority: 'medium',
        created_by: createdBy,
        assigned_to: assignedTo
      })
      .returning()
      .execute();
    return caseResult[0];
  };

  it('should update fraud case fields successfully', async () => {
    // Create test user and case
    const user = await createTestUser('investigator');
    const fraudCase = await createTestCase(user.id, user.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      description: 'Updated description for fraud case',
      status: 'in_progress',
      priority: 'high'
    };

    const result = await updateFraudCase(updateInput, user.id);

    // Verify updated fields
    expect(result.id).toEqual(fraudCase.id);
    expect(result.description).toEqual('Updated description for fraud case');
    expect(result.status).toEqual('in_progress');
    expect(result.priority).toEqual('high');
    expect(result.txid).toEqual(fraudCase.txid); // Unchanged
    expect(result.assigned_to).toEqual(fraudCase.assigned_to); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > fraudCase.updated_at).toBe(true);
  });

  it('should update only specified fields', async () => {
    // Create test user and case
    const user = await createTestUser('investigator');
    const fraudCase = await createTestCase(user.id, user.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      priority: 'critical'
    };

    const result = await updateFraudCase(updateInput, user.id);

    // Only priority should be updated
    expect(result.priority).toEqual('critical');
    expect(result.description).toEqual(fraudCase.description);
    expect(result.status).toEqual(fraudCase.status);
    expect(result.txid).toEqual(fraudCase.txid);
  });

  it('should update assignment to another user', async () => {
    // Create test users and case
    const user1 = await createTestUser('investigator');
    const user2 = await createTestUser('analyst');
    const admin = await createTestUser('admin');
    const fraudCase = await createTestCase(user1.id, user1.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      assigned_to: user2.id
    };

    const result = await updateFraudCase(updateInput, admin.id);

    expect(result.assigned_to).toEqual(user2.id);
  });

  it('should allow admin to update any case', async () => {
    // Create investigator and admin users
    const investigator = await createTestUser('investigator');
    const admin = await createTestUser('admin');
    const fraudCase = await createTestCase(investigator.id, investigator.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      status: 'resolved',
      priority: 'low'
    };

    const result = await updateFraudCase(updateInput, admin.id);

    expect(result.status).toEqual('resolved');
    expect(result.priority).toEqual('low');
  });

  it('should allow assigned investigator to update their case', async () => {
    // Create users
    const creator = await createTestUser('investigator');
    const assignee = await createTestUser('investigator');
    const fraudCase = await createTestCase(creator.id, assignee.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      status: 'escalated'
    };

    const result = await updateFraudCase(updateInput, assignee.id);

    expect(result.status).toEqual('escalated');
  });

  it('should allow assigned analyst to update their case', async () => {
    // Create users
    const creator = await createTestUser('investigator');
    const assignee = await createTestUser('analyst');
    const fraudCase = await createTestCase(creator.id, assignee.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      description: 'Updated by analyst'
    };

    const result = await updateFraudCase(updateInput, assignee.id);

    expect(result.description).toEqual('Updated by analyst');
  });

  it('should throw error for non-existent case', async () => {
    const user = await createTestUser('admin');

    const updateInput: UpdateFraudCaseInput = {
      id: 99999,
      description: 'This should fail'
    };

    await expect(updateFraudCase(updateInput, user.id))
      .rejects.toThrow(/Fraud case with id 99999 not found/i);
  });

  it('should throw error for non-existent user', async () => {
    const user = await createTestUser('investigator');
    const fraudCase = await createTestCase(user.id, user.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      description: 'This should fail'
    };

    await expect(updateFraudCase(updateInput, 99999))
      .rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should throw error for insufficient permissions - viewer role', async () => {
    const creator = await createTestUser('investigator');
    const viewer = await createTestUser('viewer');
    const fraudCase = await createTestCase(creator.id, creator.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      description: 'Viewer should not be able to update'
    };

    await expect(updateFraudCase(updateInput, viewer.id))
      .rejects.toThrow(/Insufficient permissions to update this fraud case/i);
  });

  it('should throw error for non-assigned investigator trying to update', async () => {
    const creator = await createTestUser('investigator');
    const otherInvestigator = await createTestUser('investigator');
    const fraudCase = await createTestCase(creator.id, creator.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      description: 'Non-assigned investigator should not be able to update'
    };

    await expect(updateFraudCase(updateInput, otherInvestigator.id))
      .rejects.toThrow(/Insufficient permissions to update this fraud case/i);
  });

  it('should throw error when assigning to non-existent user', async () => {
    const admin = await createTestUser('admin');
    const fraudCase = await createTestCase(admin.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      assigned_to: 99999
    };

    await expect(updateFraudCase(updateInput, admin.id))
      .rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should update case in database', async () => {
    const user = await createTestUser('admin');
    const fraudCase = await createTestCase(user.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      txid: 'UPDATED_TX123',
      status: 'closed'
    };

    await updateFraudCase(updateInput, user.id);

    // Verify case was updated in database
    const updatedCase = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, fraudCase.id))
      .execute();

    expect(updatedCase).toHaveLength(1);
    expect(updatedCase[0].txid).toEqual('UPDATED_TX123');
    expect(updatedCase[0].status).toEqual('closed');
    expect(updatedCase[0].updated_at).toBeInstanceOf(Date);
    expect(updatedCase[0].updated_at > fraudCase.updated_at).toBe(true);
  });

  it('should handle setting assigned_to to null', async () => {
    const admin = await createTestUser('admin');
    const assignee = await createTestUser('investigator');
    const fraudCase = await createTestCase(admin.id, assignee.id);

    const updateInput: UpdateFraudCaseInput = {
      id: fraudCase.id,
      assigned_to: null
    };

    const result = await updateFraudCase(updateInput, admin.id);

    expect(result.assigned_to).toBeNull();
  });
});