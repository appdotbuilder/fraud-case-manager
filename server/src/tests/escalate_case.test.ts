import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, fraudCasesTable, caseEscalationsTable } from '../db/schema';
import { type EscalateCaseInput } from '../schema';
import { escalateCase } from '../handlers/escalate_case';
import { eq } from 'drizzle-orm';

describe('escalateCase', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test users
  const createTestUsers = async () => {
    const userResults = await db.insert(usersTable)
      .values([
        {
          username: 'analyst1',
          email: 'analyst1@example.com',
          role: 'analyst'
        },
        {
          username: 'investigator1',
          email: 'investigator1@example.com',
          role: 'investigator'
        },
        {
          username: 'admin1',
          email: 'admin1@example.com',
          role: 'admin'
        }
      ])
      .returning()
      .execute();

    return userResults;
  };

  // Helper function to create test case
  const createTestCase = async (createdBy: number) => {
    const caseResults = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-12345',
        description: 'Suspicious transaction requiring investigation',
        status: 'open',
        priority: 'medium',
        created_by: createdBy,
        assigned_to: null
      })
      .returning()
      .execute();

    return caseResults[0];
  };

  it('should escalate a case successfully', async () => {
    const users = await createTestUsers();
    const testCase = await createTestCase(users[0].id);

    const escalationInput: EscalateCaseInput = {
      case_id: testCase.id,
      escalated_by: users[0].id,
      escalated_to: users[2].id,
      new_status: 'escalated',
      new_priority: 'high',
      reason: 'Complex fraud pattern detected requiring senior review'
    };

    const result = await escalateCase(escalationInput);

    // Verify case updates
    expect(result.case.id).toEqual(testCase.id);
    expect(result.case.status).toEqual('escalated');
    expect(result.case.priority).toEqual('high');
    expect(result.case.assigned_to).toEqual(users[2].id);
    expect(result.case.updated_at).toBeInstanceOf(Date);

    // Verify escalation record
    expect(result.escalation.case_id).toEqual(testCase.id);
    expect(result.escalation.escalated_by).toEqual(users[0].id);
    expect(result.escalation.escalated_to).toEqual(users[2].id);
    expect(result.escalation.previous_status).toEqual('open');
    expect(result.escalation.new_status).toEqual('escalated');
    expect(result.escalation.previous_priority).toEqual('medium');
    expect(result.escalation.new_priority).toEqual('high');
    expect(result.escalation.reason).toEqual('Complex fraud pattern detected requiring senior review');
    expect(result.escalation.created_at).toBeInstanceOf(Date);
  });

  it('should escalate case priority only without changing status', async () => {
    const users = await createTestUsers();
    const testCase = await createTestCase(users[0].id);

    const escalationInput: EscalateCaseInput = {
      case_id: testCase.id,
      escalated_by: users[1].id,
      new_priority: 'critical',
      reason: 'Urgent investigation required due to high transaction volume'
    };

    const result = await escalateCase(escalationInput);

    // Status should remain unchanged since not provided
    expect(result.case.status).toEqual('open');
    expect(result.case.priority).toEqual('critical');
    expect(result.case.assigned_to).toBeNull();

    // Escalation should record the change correctly
    expect(result.escalation.previous_status).toEqual('open');
    expect(result.escalation.new_status).toEqual('escalated'); // Default value
    expect(result.escalation.previous_priority).toEqual('medium');
    expect(result.escalation.new_priority).toEqual('critical');
    expect(result.escalation.escalated_to).toBeNull();
  });

  it('should save escalation to database correctly', async () => {
    const users = await createTestUsers();
    const testCase = await createTestCase(users[0].id);

    const escalationInput: EscalateCaseInput = {
      case_id: testCase.id,
      escalated_by: users[1].id,
      escalated_to: users[2].id,
      new_status: 'in_progress',
      new_priority: 'high',
      reason: 'Escalating to senior investigator for immediate attention'
    };

    const result = await escalateCase(escalationInput);

    // Verify escalation was saved to database
    const savedEscalations = await db.select()
      .from(caseEscalationsTable)
      .where(eq(caseEscalationsTable.id, result.escalation.id))
      .execute();

    expect(savedEscalations).toHaveLength(1);
    expect(savedEscalations[0].case_id).toEqual(testCase.id);
    expect(savedEscalations[0].escalated_by).toEqual(users[1].id);
    expect(savedEscalations[0].escalated_to).toEqual(users[2].id);
    expect(savedEscalations[0].reason).toEqual('Escalating to senior investigator for immediate attention');

    // Verify case was updated in database
    const updatedCases = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, testCase.id))
      .execute();

    expect(updatedCases).toHaveLength(1);
    expect(updatedCases[0].status).toEqual('in_progress');
    expect(updatedCases[0].priority).toEqual('high');
    expect(updatedCases[0].assigned_to).toEqual(users[2].id);
  });

  it('should handle escalation of already escalated case', async () => {
    const users = await createTestUsers();
    
    // Create case that's already been escalated
    const caseResults = await db.insert(fraudCasesTable)
      .values({
        txid: 'TXN-67890',
        description: 'Previously escalated case',
        status: 'escalated',
        priority: 'high',
        created_by: users[0].id,
        assigned_to: users[1].id
      })
      .returning()
      .execute();

    const testCase = caseResults[0];

    const escalationInput: EscalateCaseInput = {
      case_id: testCase.id,
      escalated_by: users[1].id,
      escalated_to: users[2].id,
      new_status: 'resolved',
      new_priority: 'critical',
      reason: 'Further escalation to admin due to complexity'
    };

    const result = await escalateCase(escalationInput);

    // Should record the previous escalated state
    expect(result.escalation.previous_status).toEqual('escalated');
    expect(result.escalation.previous_priority).toEqual('high');
    expect(result.escalation.new_status).toEqual('resolved');
    expect(result.escalation.new_priority).toEqual('critical');
    
    expect(result.case.status).toEqual('resolved');
    expect(result.case.priority).toEqual('critical');
    expect(result.case.assigned_to).toEqual(users[2].id);
  });

  it('should throw error when case does not exist', async () => {
    const users = await createTestUsers();

    const escalationInput: EscalateCaseInput = {
      case_id: 99999, // Non-existent case ID
      escalated_by: users[0].id,
      new_priority: 'high',
      reason: 'Escalation reason'
    };

    await expect(escalateCase(escalationInput)).rejects.toThrow(/Case with ID 99999 not found/i);
  });

  it('should handle escalation with null escalated_to', async () => {
    const users = await createTestUsers();
    const testCase = await createTestCase(users[0].id);

    const escalationInput: EscalateCaseInput = {
      case_id: testCase.id,
      escalated_by: users[1].id,
      escalated_to: null,
      new_priority: 'high',
      reason: 'Priority escalation without specific assignee'
    };

    const result = await escalateCase(escalationInput);

    expect(result.escalation.escalated_to).toBeNull();
    expect(result.case.assigned_to).toBeNull();
    expect(result.case.priority).toEqual('high');
  });
});