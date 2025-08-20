import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, fraudCasesTable } from '../db/schema';
import { getFraudCaseByTxid } from '../handlers/get_fraud_case_by_txid';

describe('getFraudCaseByTxid', () => {
  let testUser: any;
  let testInvestigator: any;
  let testViewer: any;
  let testAdmin: any;
  let testCase: any;

  beforeEach(async () => {
    await createDB();

    // Create test users with different roles
    const userResults = await db.insert(usersTable)
      .values([
        {
          username: 'testuser',
          email: 'test@example.com',
          role: 'analyst'
        },
        {
          username: 'investigator',
          email: 'investigator@example.com',
          role: 'investigator'
        },
        {
          username: 'viewer',
          email: 'viewer@example.com',
          role: 'viewer'
        },
        {
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        }
      ])
      .returning()
      .execute();

    [testUser, testInvestigator, testViewer, testAdmin] = userResults;

    // Create a test fraud case
    const caseResults = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX123456789',
        description: 'Suspicious transaction involving large amount',
        status: 'open',
        priority: 'high',
        created_by: testUser.id,
        assigned_to: testInvestigator.id
      })
      .returning()
      .execute();

    testCase = caseResults[0];
  });

  afterEach(resetDB);

  it('should return fraud case when txid exists', async () => {
    const result = await getFraudCaseByTxid('TX123456789');

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX123456789');
    expect(result!.description).toEqual('Suspicious transaction involving large amount');
    expect(result!.status).toEqual('open');
    expect(result!.priority).toEqual('high');
    expect(result!.created_by).toEqual(testUser.id);
    expect(result!.assigned_to).toEqual(testInvestigator.id);
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when txid does not exist', async () => {
    const result = await getFraudCaseByTxid('NONEXISTENT_TXID');

    expect(result).toBeNull();
  });

  it('should allow admin to access any case', async () => {
    const result = await getFraudCaseByTxid('TX123456789', testAdmin.id);

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX123456789');
  });

  it('should allow investigator to access any case', async () => {
    const result = await getFraudCaseByTxid('TX123456789', testInvestigator.id);

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX123456789');
  });

  it('should allow analyst to access any case', async () => {
    const result = await getFraudCaseByTxid('TX123456789', testUser.id);

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX123456789');
  });

  it('should allow viewer to access case they created', async () => {
    // Create a case created by the viewer
    await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_VIEWER_CREATED',
        description: 'Case created by viewer',
        status: 'open',
        priority: 'medium',
        created_by: testViewer.id
      })
      .execute();

    const result = await getFraudCaseByTxid('TX_VIEWER_CREATED', testViewer.id);

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX_VIEWER_CREATED');
    expect(result!.created_by).toEqual(testViewer.id);
  });

  it('should allow viewer to access case assigned to them', async () => {
    // Create a case assigned to the viewer
    await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_VIEWER_ASSIGNED',
        description: 'Case assigned to viewer',
        status: 'open',
        priority: 'medium',
        created_by: testUser.id,
        assigned_to: testViewer.id
      })
      .execute();

    const result = await getFraudCaseByTxid('TX_VIEWER_ASSIGNED', testViewer.id);

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX_VIEWER_ASSIGNED');
    expect(result!.assigned_to).toEqual(testViewer.id);
  });

  it('should deny viewer access to case they neither created nor are assigned to', async () => {
    // Try to access the original test case (not created by or assigned to viewer)
    await expect(
      getFraudCaseByTxid('TX123456789', testViewer.id)
    ).rejects.toThrow(/insufficient permissions/i);
  });

  it('should throw error when user does not exist', async () => {
    await expect(
      getFraudCaseByTxid('TX123456789', 99999)
    ).rejects.toThrow(/user not found/i);
  });

  it('should return null when case does not exist even with permission check', async () => {
    const result = await getFraudCaseByTxid('NONEXISTENT_TXID', testAdmin.id);

    expect(result).toBeNull();
  });

  it('should work without userId parameter (no permission check)', async () => {
    const result = await getFraudCaseByTxid('TX123456789');

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX123456789');
  });

  it('should handle case with null assigned_to field', async () => {
    // Create a case with no assignee
    await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_NO_ASSIGNEE',
        description: 'Case with no assignee',
        status: 'open',
        priority: 'low',
        created_by: testUser.id,
        assigned_to: null
      })
      .execute();

    const result = await getFraudCaseByTxid('TX_NO_ASSIGNEE', testAdmin.id);

    expect(result).not.toBeNull();
    expect(result!.txid).toEqual('TX_NO_ASSIGNEE');
    expect(result!.assigned_to).toBeNull();
  });
});