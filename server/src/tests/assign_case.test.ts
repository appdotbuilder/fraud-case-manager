import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { assignCase } from '../handlers/assign_case';
import { eq } from 'drizzle-orm';

describe('assignCase', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let adminUser: any;
  let investigatorUser: any;
  let analystUser: any;
  let viewerUser: any;
  let fraudCase: any;

  beforeEach(async () => {
    // Create test users with different roles
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'admin_user',
          email: 'admin@test.com',
          role: 'admin'
        },
        {
          username: 'investigator_user',
          email: 'investigator@test.com',
          role: 'investigator'
        },
        {
          username: 'analyst_user',
          email: 'analyst@test.com',
          role: 'analyst'
        },
        {
          username: 'viewer_user',
          email: 'viewer@test.com',
          role: 'viewer'
        }
      ])
      .returning()
      .execute();

    [adminUser, investigatorUser, analystUser, viewerUser] = users;

    // Create a test fraud case
    const cases = await db.insert(fraudCasesTable)
      .values({
        txid: 'TEST-TX-12345',
        description: 'Test fraud case for assignment',
        status: 'open',
        priority: 'medium',
        created_by: adminUser.id
      })
      .returning()
      .execute();

    fraudCase = cases[0];
  });

  it('should assign case to investigator when assigned by admin', async () => {
    const result = await assignCase(fraudCase.id, investigatorUser.id, adminUser.id);

    expect(result.id).toEqual(fraudCase.id);
    expect(result.assigned_to).toEqual(investigatorUser.id);
    expect(result.status).toEqual('in_progress');
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify in database
    const dbCase = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, fraudCase.id))
      .execute();

    expect(dbCase[0].assigned_to).toEqual(investigatorUser.id);
    expect(dbCase[0].status).toEqual('in_progress');
  });

  it('should assign case to analyst when assigned by investigator', async () => {
    const result = await assignCase(fraudCase.id, analystUser.id, investigatorUser.id);

    expect(result.assigned_to).toEqual(analystUser.id);
    expect(result.status).toEqual('in_progress');

    // Verify in database
    const dbCase = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, fraudCase.id))
      .execute();

    expect(dbCase[0].assigned_to).toEqual(analystUser.id);
    expect(dbCase[0].status).toEqual('in_progress');
  });

  it('should allow analyst to assign cases', async () => {
    const result = await assignCase(fraudCase.id, investigatorUser.id, analystUser.id);

    expect(result.assigned_to).toEqual(investigatorUser.id);
    expect(result.status).toEqual('in_progress');
  });

  it('should throw error when case does not exist', async () => {
    await expect(assignCase(99999, investigatorUser.id, adminUser.id))
      .rejects.toThrow(/case not found/i);
  });

  it('should throw error when assignee does not exist', async () => {
    await expect(assignCase(fraudCase.id, 99999, adminUser.id))
      .rejects.toThrow(/assignee user not found/i);
  });

  it('should throw error when assigner does not exist', async () => {
    await expect(assignCase(fraudCase.id, investigatorUser.id, 99999))
      .rejects.toThrow(/assigner user not found/i);
  });

  it('should throw error when assignee has viewer role', async () => {
    await expect(assignCase(fraudCase.id, viewerUser.id, adminUser.id))
      .rejects.toThrow(/assignee must have investigator or analyst role/i);
  });

  it('should throw error when assigner has viewer role', async () => {
    await expect(assignCase(fraudCase.id, investigatorUser.id, viewerUser.id))
      .rejects.toThrow(/assigner must have admin, investigator, or analyst role/i);
  });

  it('should update existing assignment', async () => {
    // First assignment
    await assignCase(fraudCase.id, investigatorUser.id, adminUser.id);

    // Reassign to different user
    const result = await assignCase(fraudCase.id, analystUser.id, adminUser.id);

    expect(result.assigned_to).toEqual(analystUser.id);
    expect(result.status).toEqual('in_progress');

    // Verify only one case exists with new assignment
    const dbCases = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, fraudCase.id))
      .execute();

    expect(dbCases).toHaveLength(1);
    expect(dbCases[0].assigned_to).toEqual(analystUser.id);
  });

  it('should preserve other case fields during assignment', async () => {
    const result = await assignCase(fraudCase.id, investigatorUser.id, adminUser.id);

    expect(result.txid).toEqual(fraudCase.txid);
    expect(result.description).toEqual(fraudCase.description);
    expect(result.priority).toEqual(fraudCase.priority);
    expect(result.created_by).toEqual(fraudCase.created_by);
    expect(result.created_at).toEqual(fraudCase.created_at);
  });
});