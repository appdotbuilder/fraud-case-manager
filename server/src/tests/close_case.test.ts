import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { closeCase } from '../handlers/close_case';
import { eq } from 'drizzle-orm';

describe('closeCase', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should close a resolved case by assigned investigator', async () => {
    // Create test user (investigator)
    const userResult = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const investigator = userResult[0];

    // Create a resolved fraud case assigned to the investigator
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'resolved',
        priority: 'medium',
        assigned_to: investigator.id,
        created_by: investigator.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Close the case
    const result = await closeCase(fraudCase.id, investigator.id);

    // Verify the case was closed
    expect(result.id).toEqual(fraudCase.id);
    expect(result.status).toEqual('closed');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > fraudCase.updated_at).toBe(true);
  });

  it('should close a resolved case by admin', async () => {
    // Create test users
    const adminResult = await db.insert(usersTable)
      .values({
        username: 'admin1',
        email: 'admin@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    const investigatorResult = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const admin = adminResult[0];
    const investigator = investigatorResult[0];

    // Create a resolved fraud case assigned to investigator
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'resolved',
        priority: 'high',
        assigned_to: investigator.id,
        created_by: investigator.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Admin closes the case
    const result = await closeCase(fraudCase.id, admin.id);

    // Verify the case was closed
    expect(result.id).toEqual(fraudCase.id);
    expect(result.status).toEqual('closed');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should allow analyst to close assigned case', async () => {
    // Create test user (analyst)
    const userResult = await db.insert(usersTable)
      .values({
        username: 'analyst1',
        email: 'analyst@test.com',
        role: 'analyst'
      })
      .returning()
      .execute();

    const analyst = userResult[0];

    // Create a resolved fraud case assigned to the analyst
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-67890',
        description: 'Transaction analysis completed',
        status: 'resolved',
        priority: 'low',
        assigned_to: analyst.id,
        created_by: analyst.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Close the case
    const result = await closeCase(fraudCase.id, analyst.id);

    // Verify the case was closed
    expect(result.status).toEqual('closed');
  });

  it('should save case closure to database', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const investigator = userResult[0];

    // Create a resolved fraud case
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'resolved',
        priority: 'medium',
        assigned_to: investigator.id,
        created_by: investigator.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Close the case
    await closeCase(fraudCase.id, investigator.id);

    // Verify in database
    const updatedCases = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, fraudCase.id))
      .execute();

    expect(updatedCases).toHaveLength(1);
    expect(updatedCases[0].status).toEqual('closed');
    expect(updatedCases[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent case', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const investigator = userResult[0];

    // Try to close non-existent case
    await expect(closeCase(999999, investigator.id)).rejects.toThrow(/case not found/i);
  });

  it('should throw error for non-existent user', async () => {
    // Create a resolved fraud case with no assigned user
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'resolved',
        priority: 'medium',
        assigned_to: null,
        created_by: 1 // Assuming user 1 exists but we won't create it
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Try to close case with non-existent user
    await expect(closeCase(fraudCase.id, 999999)).rejects.toThrow(/user not found/i);
  });

  it('should throw error when case is not in resolved status', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const investigator = userResult[0];

    // Create an open fraud case (not resolved)
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'open',
        priority: 'medium',
        assigned_to: investigator.id,
        created_by: investigator.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Try to close the case
    await expect(closeCase(fraudCase.id, investigator.id)).rejects.toThrow(/must be in resolved status/i);
  });

  it('should throw error for insufficient permissions - viewer role', async () => {
    // Create test users
    const viewerResult = await db.insert(usersTable)
      .values({
        username: 'viewer1',
        email: 'viewer@test.com',
        role: 'viewer'
      })
      .returning()
      .execute();

    const investigatorResult = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const viewer = viewerResult[0];
    const investigator = investigatorResult[0];

    // Create a resolved fraud case assigned to investigator
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'resolved',
        priority: 'medium',
        assigned_to: investigator.id,
        created_by: investigator.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Viewer tries to close the case
    await expect(closeCase(fraudCase.id, viewer.id)).rejects.toThrow(/insufficient permissions/i);
  });

  it('should throw error for unassigned investigator trying to close case', async () => {
    // Create test users
    const investigator1Result = await db.insert(usersTable)
      .values({
        username: 'investigator1',
        email: 'investigator1@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const investigator2Result = await db.insert(usersTable)
      .values({
        username: 'investigator2',
        email: 'investigator2@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const investigator1 = investigator1Result[0];
    const investigator2 = investigator2Result[0];

    // Create a resolved fraud case assigned to investigator1
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction detected',
        status: 'resolved',
        priority: 'medium',
        assigned_to: investigator1.id,
        created_by: investigator1.id
      })
      .returning()
      .execute();

    const fraudCase = caseResult[0];

    // Investigator2 tries to close the case (not assigned)
    await expect(closeCase(fraudCase.id, investigator2.id)).rejects.toThrow(/insufficient permissions/i);
  });
});