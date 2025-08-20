import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, fraudCasesTable, caseEscalationsTable } from '../db/schema';
import { getCaseEscalations } from '../handlers/get_case_escalations';
import { eq } from 'drizzle-orm';

describe('getCaseEscalations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch escalation history for a case', async () => {
    // Create a test user (admin)
    const adminUser = await db.insert(usersTable)
      .values({
        username: 'admin_user',
        email: 'admin@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    // Create a test user (investigator)
    const investigatorUser = await db.insert(usersTable)
      .values({
        username: 'investigator_user',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    // Create a fraud case
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_12345',
        description: 'Test fraud case',
        status: 'open',
        priority: 'medium',
        created_by: adminUser[0].id
      })
      .returning()
      .execute();

    // Create escalation records
    const escalation1 = await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: adminUser[0].id,
        escalated_to: investigatorUser[0].id,
        previous_status: 'open',
        new_status: 'in_progress',
        previous_priority: 'medium',
        new_priority: 'high',
        reason: 'First escalation - increased priority'
      })
      .returning()
      .execute();

    const escalation2 = await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: investigatorUser[0].id,
        escalated_to: null,
        previous_status: 'in_progress',
        new_status: 'escalated',
        previous_priority: 'high',
        new_priority: 'critical',
        reason: 'Second escalation - critical priority needed'
      })
      .returning()
      .execute();

    // Test fetching escalations
    const result = await getCaseEscalations(fraudCase[0].id, adminUser[0].id);

    expect(result).toHaveLength(2);
    
    // Check first escalation
    expect(result[0].id).toEqual(escalation1[0].id);
    expect(result[0].case_id).toEqual(fraudCase[0].id);
    expect(result[0].escalated_by).toEqual(adminUser[0].id);
    expect(result[0].escalated_to).toEqual(investigatorUser[0].id);
    expect(result[0].previous_status).toEqual('open');
    expect(result[0].new_status).toEqual('in_progress');
    expect(result[0].previous_priority).toEqual('medium');
    expect(result[0].new_priority).toEqual('high');
    expect(result[0].reason).toEqual('First escalation - increased priority');
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Check second escalation
    expect(result[1].id).toEqual(escalation2[0].id);
    expect(result[1].case_id).toEqual(fraudCase[0].id);
    expect(result[1].escalated_by).toEqual(investigatorUser[0].id);
    expect(result[1].escalated_to).toBeNull();
    expect(result[1].previous_status).toEqual('in_progress');
    expect(result[1].new_status).toEqual('escalated');
    expect(result[1].previous_priority).toEqual('high');
    expect(result[1].new_priority).toEqual('critical');
    expect(result[1].reason).toEqual('Second escalation - critical priority needed');
    expect(result[1].created_at).toBeInstanceOf(Date);
  });

  it('should work without userId parameter', async () => {
    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        username: 'test_user',
        email: 'test@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    // Create a fraud case
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_67890',
        description: 'Test fraud case',
        status: 'open',
        priority: 'medium',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create an escalation
    await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: user[0].id,
        escalated_to: null,
        previous_status: 'open',
        new_status: 'in_progress',
        previous_priority: 'medium',
        new_priority: 'high',
        reason: 'Escalation without user validation'
      })
      .returning()
      .execute();

    // Test fetching escalations without userId
    const result = await getCaseEscalations(fraudCase[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].case_id).toEqual(fraudCase[0].id);
    expect(result[0].reason).toEqual('Escalation without user validation');
  });

  it('should return empty array when no escalations exist', async () => {
    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        username: 'test_user',
        email: 'test@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    // Create a fraud case without any escalations
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_NO_ESCALATIONS',
        description: 'Case with no escalations',
        status: 'open',
        priority: 'low',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Test fetching escalations for case with no escalations
    const result = await getCaseEscalations(fraudCase[0].id, user[0].id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should allow investigator to view escalations', async () => {
    // Create investigator user
    const investigatorUser = await db.insert(usersTable)
      .values({
        username: 'investigator_user',
        email: 'investigator@test.com',
        role: 'investigator'
      })
      .returning()
      .execute();

    // Create a fraud case
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_INVESTIGATOR',
        description: 'Test case for investigator',
        status: 'open',
        priority: 'medium',
        created_by: investigatorUser[0].id
      })
      .returning()
      .execute();

    // Create an escalation
    await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: investigatorUser[0].id,
        escalated_to: null,
        previous_status: 'open',
        new_status: 'in_progress',
        previous_priority: 'medium',
        new_priority: 'high',
        reason: 'Investigator escalation'
      })
      .returning()
      .execute();

    // Should allow investigator to view escalations
    const result = await getCaseEscalations(fraudCase[0].id, investigatorUser[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].reason).toEqual('Investigator escalation');
  });

  it('should allow analyst to view escalations', async () => {
    // Create analyst user
    const analystUser = await db.insert(usersTable)
      .values({
        username: 'analyst_user',
        email: 'analyst@test.com',
        role: 'analyst'
      })
      .returning()
      .execute();

    // Create a fraud case
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_ANALYST',
        description: 'Test case for analyst',
        status: 'open',
        priority: 'medium',
        created_by: analystUser[0].id
      })
      .returning()
      .execute();

    // Create an escalation
    await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: analystUser[0].id,
        escalated_to: null,
        previous_status: 'open',
        new_status: 'in_progress',
        previous_priority: 'medium',
        new_priority: 'high',
        reason: 'Analyst escalation'
      })
      .returning()
      .execute();

    // Should allow analyst to view escalations
    const result = await getCaseEscalations(fraudCase[0].id, analystUser[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].reason).toEqual('Analyst escalation');
  });

  it('should throw error when case does not exist', async () => {
    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        username: 'test_user',
        email: 'test@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    // Test with non-existent case ID
    await expect(getCaseEscalations(99999, user[0].id))
      .rejects.toThrow(/fraud case not found/i);
  });

  it('should throw error when user does not exist', async () => {
    // Create a test user and case
    const user = await db.insert(usersTable)
      .values({
        username: 'test_user',
        email: 'test@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_USER_NOT_FOUND',
        description: 'Test case',
        status: 'open',
        priority: 'medium',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Test with non-existent user ID
    await expect(getCaseEscalations(fraudCase[0].id, 99999))
      .rejects.toThrow(/user not found/i);
  });

  it('should throw error when viewer tries to access escalations', async () => {
    // Create viewer user
    const viewerUser = await db.insert(usersTable)
      .values({
        username: 'viewer_user',
        email: 'viewer@test.com',
        role: 'viewer'
      })
      .returning()
      .execute();

    // Create admin user for case creation
    const adminUser = await db.insert(usersTable)
      .values({
        username: 'admin_user',
        email: 'admin@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    // Create a fraud case
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_VIEWER_ACCESS',
        description: 'Test case for viewer access',
        status: 'open',
        priority: 'medium',
        created_by: adminUser[0].id
      })
      .returning()
      .execute();

    // Should throw error when viewer tries to access escalations
    await expect(getCaseEscalations(fraudCase[0].id, viewerUser[0].id))
      .rejects.toThrow(/insufficient permissions/i);
  });

  it('should order escalations by creation date', async () => {
    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        username: 'test_user',
        email: 'test@test.com',
        role: 'admin'
      })
      .returning()
      .execute();

    // Create a fraud case
    const fraudCase = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_ORDERING',
        description: 'Test case for ordering',
        status: 'open',
        priority: 'medium',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create multiple escalations (they will be ordered by creation time)
    const escalation1 = await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: user[0].id,
        escalated_to: null,
        previous_status: 'open',
        new_status: 'in_progress',
        previous_priority: 'medium',
        new_priority: 'high',
        reason: 'First escalation'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const escalation2 = await db.insert(caseEscalationsTable)
      .values({
        case_id: fraudCase[0].id,
        escalated_by: user[0].id,
        escalated_to: null,
        previous_status: 'in_progress',
        new_status: 'escalated',
        previous_priority: 'high',
        new_priority: 'critical',
        reason: 'Second escalation'
      })
      .returning()
      .execute();

    // Test that escalations are returned in chronological order
    const result = await getCaseEscalations(fraudCase[0].id, user[0].id);

    expect(result).toHaveLength(2);
    expect(result[0].id).toEqual(escalation1[0].id);
    expect(result[1].id).toEqual(escalation2[0].id);
    expect(result[0].created_at.getTime()).toBeLessThanOrEqual(result[1].created_at.getTime());
  });
});