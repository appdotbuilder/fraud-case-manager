import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, fraudCasesTable } from '../db/schema';
import { type CreateUserInput, type CreateFraudCaseInput, type CaseFilters } from '../schema';
import { getFraudCases } from '../handlers/get_fraud_cases';

// Test data
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

describe('getFraudCases', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all fraud cases when no filters are applied', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, investigatorUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const investigator = createdUsers[1];

    // Create test fraud cases
    const testCases: CreateFraudCaseInput[] = [
      {
        txid: 'TXN001',
        description: 'Suspicious payment transaction',
        priority: 'high',
        created_by: admin.id
      },
      {
        txid: 'TXN002', 
        description: 'Potential money laundering case',
        priority: 'medium',
        created_by: investigator.id
      }
    ];

    await db.insert(fraudCasesTable)
      .values(testCases.map(testCase => ({
        ...testCase,
        status: 'open' as const
      })))
      .execute();

    const results = await getFraudCases();

    expect(results).toHaveLength(2);
    expect(results[0].txid).toEqual('TXN001');
    expect(results[0].description).toEqual('Suspicious payment transaction');
    expect(results[0].priority).toEqual('high');
    expect(results[0].status).toEqual('open');
    expect(results[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter cases by status', async () => {
    // Create test user
    const createdUsers = await db.insert(usersTable)
      .values([adminUser])
      .returning()
      .execute();

    const admin = createdUsers[0];

    // Create cases with different statuses
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Open case',
          priority: 'medium',
          status: 'open',
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'In progress case', 
          priority: 'medium',
          status: 'in_progress',
          created_by: admin.id
        },
        {
          txid: 'TXN003',
          description: 'Resolved case',
          priority: 'medium', 
          status: 'resolved',
          created_by: admin.id
        }
      ])
      .execute();

    const filters: CaseFilters = { status: 'in_progress' };
    const results = await getFraudCases(filters);

    expect(results).toHaveLength(1);
    expect(results[0].status).toEqual('in_progress');
    expect(results[0].txid).toEqual('TXN002');
  });

  it('should filter cases by priority', async () => {
    // Create test user
    const createdUsers = await db.insert(usersTable)
      .values([adminUser])
      .returning()
      .execute();

    const admin = createdUsers[0];

    // Create cases with different priorities
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Critical case',
          priority: 'critical',
          status: 'open',
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'Low priority case',
          priority: 'low', 
          status: 'open',
          created_by: admin.id
        }
      ])
      .execute();

    const filters: CaseFilters = { priority: 'critical' };
    const results = await getFraudCases(filters);

    expect(results).toHaveLength(1);
    expect(results[0].priority).toEqual('critical');
    expect(results[0].txid).toEqual('TXN001');
  });

  it('should filter cases by assigned_to', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, investigatorUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const investigator = createdUsers[1];

    // Create cases with different assignees
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Case assigned to investigator',
          priority: 'medium',
          status: 'open',
          assigned_to: investigator.id,
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'Unassigned case',
          priority: 'medium',
          status: 'open',
          assigned_to: null,
          created_by: admin.id
        }
      ])
      .execute();

    const filters: CaseFilters = { assigned_to: investigator.id };
    const results = await getFraudCases(filters);

    expect(results).toHaveLength(1);
    expect(results[0].assigned_to).toEqual(investigator.id);
    expect(results[0].txid).toEqual('TXN001');
  });

  it('should filter cases by created_by', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, investigatorUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const investigator = createdUsers[1];

    // Create cases by different creators
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Case created by admin',
          priority: 'medium',
          status: 'open',
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'Case created by investigator',
          priority: 'medium',
          status: 'open',
          created_by: investigator.id
        }
      ])
      .execute();

    const filters: CaseFilters = { created_by: investigator.id };
    const results = await getFraudCases(filters);

    expect(results).toHaveLength(1);
    expect(results[0].created_by).toEqual(investigator.id);
    expect(results[0].txid).toEqual('TXN002');
  });

  it('should filter cases by txid', async () => {
    // Create test user
    const createdUsers = await db.insert(usersTable)
      .values([adminUser])
      .returning()
      .execute();

    const admin = createdUsers[0];

    // Create multiple cases
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'First case',
          priority: 'medium',
          status: 'open',
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'Second case',
          priority: 'medium',
          status: 'open',
          created_by: admin.id
        }
      ])
      .execute();

    const filters: CaseFilters = { txid: 'TXN001' };
    const results = await getFraudCases(filters);

    expect(results).toHaveLength(1);
    expect(results[0].txid).toEqual('TXN001');
    expect(results[0].description).toEqual('First case');
  });

  it('should apply multiple filters together', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, investigatorUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const investigator = createdUsers[1];

    // Create various cases
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'High priority open case by investigator',
          priority: 'high',
          status: 'open',
          created_by: investigator.id
        },
        {
          txid: 'TXN002',
          description: 'High priority closed case by investigator',
          priority: 'high',
          status: 'closed',
          created_by: investigator.id
        },
        {
          txid: 'TXN003',
          description: 'Low priority open case by investigator',
          priority: 'low',
          status: 'open',
          created_by: investigator.id
        },
        {
          txid: 'TXN004',
          description: 'High priority open case by admin',
          priority: 'high',
          status: 'open',
          created_by: admin.id
        }
      ])
      .execute();

    const filters: CaseFilters = { 
      priority: 'high', 
      status: 'open', 
      created_by: investigator.id 
    };
    const results = await getFraudCases(filters);

    expect(results).toHaveLength(1);
    expect(results[0].txid).toEqual('TXN001');
    expect(results[0].priority).toEqual('high');
    expect(results[0].status).toEqual('open');
    expect(results[0].created_by).toEqual(investigator.id);
  });

  it('should respect viewer permissions - only show assigned cases', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, viewerUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const viewer = createdUsers[1];

    // Create cases - some assigned to viewer, some not
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Case assigned to viewer',
          priority: 'medium',
          status: 'open',
          assigned_to: viewer.id,
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'Case not assigned to viewer',
          priority: 'medium',
          status: 'open',
          assigned_to: admin.id,
          created_by: admin.id
        },
        {
          txid: 'TXN003',
          description: 'Unassigned case',
          priority: 'medium',
          status: 'open',
          assigned_to: null,
          created_by: admin.id
        }
      ])
      .execute();

    const results = await getFraudCases(undefined, viewer.id);

    expect(results).toHaveLength(1);
    expect(results[0].txid).toEqual('TXN001');
    expect(results[0].assigned_to).toEqual(viewer.id);
  });

  it('should respect analyst permissions - show created or assigned cases', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, analystUser, investigatorUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const analyst = createdUsers[1];
    const investigator = createdUsers[2];

    // Create cases - some created by analyst, some assigned to analyst, some neither
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Case created by analyst',
          priority: 'medium',
          status: 'open',
          assigned_to: investigator.id,
          created_by: analyst.id
        },
        {
          txid: 'TXN002',
          description: 'Case assigned to analyst',
          priority: 'medium',
          status: 'open',
          assigned_to: analyst.id,
          created_by: admin.id
        },
        {
          txid: 'TXN003',
          description: 'Case neither created nor assigned to analyst',
          priority: 'medium',
          status: 'open',
          assigned_to: investigator.id,
          created_by: admin.id
        }
      ])
      .execute();

    const results = await getFraudCases(undefined, analyst.id);

    expect(results).toHaveLength(2);
    const txids = results.map(r => r.txid).sort();
    expect(txids).toEqual(['TXN001', 'TXN002']);
  });

  it('should allow admin and investigator to see all cases', async () => {
    // Create test users
    const createdUsers = await db.insert(usersTable)
      .values([adminUser, investigatorUser, analystUser])
      .returning()
      .execute();

    const admin = createdUsers[0];
    const investigator = createdUsers[1];
    const analyst = createdUsers[2];

    // Create cases by different users
    await db.insert(fraudCasesTable)
      .values([
        {
          txid: 'TXN001',
          description: 'Case by admin',
          priority: 'medium',
          status: 'open',
          created_by: admin.id
        },
        {
          txid: 'TXN002',
          description: 'Case by analyst',
          priority: 'medium',
          status: 'open',
          created_by: analyst.id
        }
      ])
      .execute();

    // Admin should see all cases
    const adminResults = await getFraudCases(undefined, admin.id);
    expect(adminResults).toHaveLength(2);

    // Investigator should see all cases
    const investigatorResults = await getFraudCases(undefined, investigator.id);
    expect(investigatorResults).toHaveLength(2);
  });

  it('should throw error when user is not found', async () => {
    // Create test user
    const createdUsers = await db.insert(usersTable)
      .values([adminUser])
      .returning()
      .execute();

    const admin = createdUsers[0];

    // Create a test case
    await db.insert(fraudCasesTable)
      .values([{
        txid: 'TXN001',
        description: 'Test case',
        priority: 'medium',
        status: 'open',
        created_by: admin.id
      }])
      .execute();

    // Try to get cases with non-existent user ID
    await expect(getFraudCases(undefined, 9999)).rejects.toThrow(/User not found/i);
  });

  it('should work with empty database', async () => {
    const results = await getFraudCases();
    expect(results).toHaveLength(0);
  });
});