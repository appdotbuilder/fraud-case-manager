import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, fraudCasesTable } from '../db/schema';
import { type CreateUserInput, type CreateFraudCaseInput } from '../schema';
import { getFraudCaseById } from '../handlers/get_fraud_case_by_id';

// Test user data
const adminUser: CreateUserInput = {
  username: 'admin_user',
  email: 'admin@test.com',
  role: 'admin'
};

const investigatorUser: CreateUserInput = {
  username: 'investigator_user',
  email: 'investigator@test.com',
  role: 'investigator'
};

const analystUser: CreateUserInput = {
  username: 'analyst_user',
  email: 'analyst@test.com',
  role: 'analyst'
};

const viewerUser: CreateUserInput = {
  username: 'viewer_user',
  email: 'viewer@test.com',
  role: 'viewer'
};

// Test case data
const testCase: CreateFraudCaseInput = {
  txid: 'TXN-123456789',
  description: 'Suspicious transaction detected involving multiple accounts',
  priority: 'high',
  created_by: 1 // Will be updated with actual user ID
};

describe('getFraudCaseById', () => {
  let adminId: number;
  let investigatorId: number;
  let analystId: number;
  let viewerId: number;
  let caseId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const adminResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();
    adminId = adminResult[0].id;

    const investigatorResult = await db.insert(usersTable)
      .values(investigatorUser)
      .returning()
      .execute();
    investigatorId = investigatorResult[0].id;

    const analystResult = await db.insert(usersTable)
      .values(analystUser)
      .returning()
      .execute();
    analystId = analystResult[0].id;

    const viewerResult = await db.insert(usersTable)
      .values(viewerUser)
      .returning()
      .execute();
    viewerId = viewerResult[0].id;

    // Create test case
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        ...testCase,
        created_by: investigatorId,
        assigned_to: analystId
      })
      .returning()
      .execute();
    caseId = caseResult[0].id;
  });

  afterEach(resetDB);

  it('should return fraud case when found without user permission check', async () => {
    const result = await getFraudCaseById(caseId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(caseId);
    expect(result!.txid).toEqual('TXN-123456789');
    expect(result!.description).toEqual('Suspicious transaction detected involving multiple accounts');
    expect(result!.status).toEqual('open');
    expect(result!.priority).toEqual('high');
    expect(result!.assigned_to).toEqual(analystId);
    expect(result!.created_by).toEqual(investigatorId);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when case not found', async () => {
    const result = await getFraudCaseById(99999);

    expect(result).toBeNull();
  });

  it('should allow admin to view any case', async () => {
    const result = await getFraudCaseById(caseId, adminId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(caseId);
    expect(result!.txid).toEqual('TXN-123456789');
  });

  it('should allow viewer to view any case', async () => {
    const result = await getFraudCaseById(caseId, viewerId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(caseId);
    expect(result!.txid).toEqual('TXN-123456789');
  });

  it('should allow case creator to view their own case', async () => {
    const result = await getFraudCaseById(caseId, investigatorId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(caseId);
    expect(result!.created_by).toEqual(investigatorId);
  });

  it('should allow assigned user to view the case', async () => {
    const result = await getFraudCaseById(caseId, analystId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(caseId);
    expect(result!.assigned_to).toEqual(analystId);
  });

  it('should deny access to investigator not involved with the case', async () => {
    // Create another investigator not involved with the case
    const otherInvestigator = await db.insert(usersTable)
      .values({
        username: 'other_investigator',
        email: 'other@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const result = await getFraudCaseById(caseId, otherInvestigator[0].id);

    expect(result).toBeNull();
  });

  it('should deny access to analyst not involved with the case', async () => {
    // Create another analyst not involved with the case
    const otherAnalyst = await db.insert(usersTable)
      .values({
        username: 'other_analyst',
        email: 'other_analyst@test.com',
        role: 'analyst'
      })
      .returning()
      .execute();

    const result = await getFraudCaseById(caseId, otherAnalyst[0].id);

    expect(result).toBeNull();
  });

  it('should return null for non-existent user', async () => {
    const result = await getFraudCaseById(caseId, 99999);

    expect(result).toBeNull();
  });

  it('should handle case with no assignee correctly', async () => {
    // Create a case with no assignee
    const unassignedCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-UNASSIGNED',
        description: 'Unassigned case',
        priority: 'medium',
        created_by: investigatorId,
        assigned_to: null
      })
      .returning()
      .execute();

    // Creator should be able to view it
    const result = await getFraudCaseById(unassignedCase[0].id, investigatorId);

    expect(result).not.toBeNull();
    expect(result!.assigned_to).toBeNull();
    expect(result!.txid).toEqual('TXN-UNASSIGNED');

    // Other investigator should not be able to view it
    const otherInvestigator = await db.insert(usersTable)
      .values({
        username: 'other_inv_2',
        email: 'other_inv_2@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    const deniedResult = await getFraudCaseById(unassignedCase[0].id, otherInvestigator[0].id);
    expect(deniedResult).toBeNull();
  });

  it('should handle invalid case ID gracefully', async () => {
    // Test with a negative ID which should be handled gracefully
    const result = await getFraudCaseById(-1, adminId);
    expect(result).toBeNull();
  });
});