import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, fraudCasesTable } from '../db/schema';
import { getCaseStatistics } from '../handlers/get_case_statistics';
import { eq } from 'drizzle-orm';
import type { CreateUserInput, CreateFraudCaseInput } from '../schema';

describe('getCaseStatistics', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test users with different roles
  const testUsers: CreateUserInput[] = [
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
      username: 'viewer_user',
      email: 'viewer@test.com',
      role: 'viewer'
    }
  ];

  let createdUsers: { id: number; role: string }[] = [];

  // Helper to create test users
  const createTestUsers = async () => {
    const results = await Promise.all(
      testUsers.map(async (user) => {
        const result = await db.insert(usersTable)
          .values(user)
          .returning();
        return { id: result[0].id, role: user.role };
      })
    );
    createdUsers = results;
    return results;
  };

  // Helper to create test cases
  const createTestCases = async (users: { id: number; role: string }[]) => {
    const adminUser = users.find(u => u.role === 'admin')!;
    const investigatorUser = users.find(u => u.role === 'investigator')!;
    const viewerUser = users.find(u => u.role === 'viewer')!;

    const testCases: CreateFraudCaseInput[] = [
      {
        txid: 'TX001',
        description: 'Test fraud case 1',
        priority: 'low',
        created_by: adminUser.id
      },
      {
        txid: 'TX002', 
        description: 'Test fraud case 2',
        priority: 'medium',
        created_by: adminUser.id
      },
      {
        txid: 'TX003',
        description: 'Test fraud case 3', 
        priority: 'high',
        created_by: investigatorUser.id
      },
      {
        txid: 'TX004',
        description: 'Test fraud case 4',
        priority: 'critical',
        created_by: investigatorUser.id
      }
    ];

    // Create cases with different statuses and assignments
    const cases = await Promise.all([
      // Case 1: open, low priority, unassigned
      db.insert(fraudCasesTable)
        .values({
          ...testCases[0],
          status: 'open',
          assigned_to: null
        })
        .returning(),

      // Case 2: in_progress, medium priority, assigned to investigator
      db.insert(fraudCasesTable)
        .values({
          ...testCases[1],
          status: 'in_progress',
          assigned_to: investigatorUser.id
        })
        .returning(),

      // Case 3: escalated, high priority, assigned to viewer  
      db.insert(fraudCasesTable)
        .values({
          ...testCases[2],
          status: 'escalated',
          assigned_to: viewerUser.id
        })
        .returning(),

      // Case 4: resolved, critical priority, assigned to investigator
      db.insert(fraudCasesTable)
        .values({
          ...testCases[3],
          status: 'resolved',
          assigned_to: investigatorUser.id
        })
        .returning()
    ]);

    return cases.map(result => result[0]);
  };

  it('should return statistics for all cases when no user specified', async () => {
    const users = await createTestUsers();
    await createTestCases(users);

    const statistics = await getCaseStatistics();

    expect(statistics.totalCases).toBe(4);
    expect(statistics.casesByStatus.open).toBe(1);
    expect(statistics.casesByStatus.in_progress).toBe(1);
    expect(statistics.casesByStatus.escalated).toBe(1);
    expect(statistics.casesByStatus.resolved).toBe(1);
    expect(statistics.casesByStatus.closed).toBe(0);
    
    expect(statistics.casesByPriority.low).toBe(1);
    expect(statistics.casesByPriority.medium).toBe(1);
    expect(statistics.casesByPriority.high).toBe(1);
    expect(statistics.casesByPriority.critical).toBe(1);
    
    expect(statistics.unassignedCases).toBe(1);
    expect(statistics.escalatedCases).toBe(1);
    expect(typeof statistics.averageResolutionTime).toBe('number');
  });

  it('should return all statistics for admin user', async () => {
    const users = await createTestUsers();
    await createTestCases(users);
    
    const adminUser = users.find(u => u.role === 'admin')!;
    const statistics = await getCaseStatistics(adminUser.id);

    expect(statistics.totalCases).toBe(4);
    expect(statistics.casesByStatus.open).toBe(1);
    expect(statistics.casesByStatus.in_progress).toBe(1);
    expect(statistics.casesByStatus.escalated).toBe(1);
    expect(statistics.casesByStatus.resolved).toBe(1);
    expect(statistics.unassignedCases).toBe(1);
  });

  it('should return all statistics for investigator user', async () => {
    const users = await createTestUsers();
    await createTestCases(users);
    
    const investigatorUser = users.find(u => u.role === 'investigator')!;
    const statistics = await getCaseStatistics(investigatorUser.id);

    expect(statistics.totalCases).toBe(4);
    expect(statistics.casesByStatus.open).toBe(1);
    expect(statistics.casesByStatus.in_progress).toBe(1);
    expect(statistics.casesByStatus.escalated).toBe(1);
    expect(statistics.casesByStatus.resolved).toBe(1);
    expect(statistics.unassignedCases).toBe(1);
  });

  it('should return filtered statistics for viewer user (only assigned cases)', async () => {
    const users = await createTestUsers();
    await createTestCases(users);
    
    const viewerUser = users.find(u => u.role === 'viewer')!;
    const statistics = await getCaseStatistics(viewerUser.id);

    // Viewer should only see their assigned case (case 3: escalated, high priority)
    expect(statistics.totalCases).toBe(1);
    expect(statistics.casesByStatus.open).toBe(0);
    expect(statistics.casesByStatus.in_progress).toBe(0);
    expect(statistics.casesByStatus.escalated).toBe(1);
    expect(statistics.casesByStatus.resolved).toBe(0);
    expect(statistics.casesByStatus.closed).toBe(0);
    
    expect(statistics.casesByPriority.low).toBe(0);
    expect(statistics.casesByPriority.medium).toBe(0);
    expect(statistics.casesByPriority.high).toBe(1);
    expect(statistics.casesByPriority.critical).toBe(0);
    
    expect(statistics.unassignedCases).toBe(0);
    expect(statistics.escalatedCases).toBe(1);
  });

  it('should handle empty database', async () => {
    const statistics = await getCaseStatistics();

    expect(statistics.totalCases).toBe(0);
    expect(statistics.casesByStatus.open).toBe(0);
    expect(statistics.casesByStatus.in_progress).toBe(0);
    expect(statistics.casesByStatus.escalated).toBe(0);
    expect(statistics.casesByStatus.resolved).toBe(0);
    expect(statistics.casesByStatus.closed).toBe(0);
    
    expect(statistics.casesByPriority.low).toBe(0);
    expect(statistics.casesByPriority.medium).toBe(0);
    expect(statistics.casesByPriority.high).toBe(0);
    expect(statistics.casesByPriority.critical).toBe(0);
    
    expect(statistics.unassignedCases).toBe(0);
    expect(statistics.escalatedCases).toBe(0);
    expect(statistics.averageResolutionTime).toBe(0);
  });

  it('should calculate average resolution time correctly', async () => {
    const users = await createTestUsers();
    const adminUser = users.find(u => u.role === 'admin')!;

    // Create a resolved case and manually update timestamps to simulate resolution time
    const caseResult = await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_RESOLVED',
        description: 'Resolved test case',
        priority: 'medium',
        status: 'resolved',
        created_by: adminUser.id,
        assigned_to: adminUser.id
      })
      .returning();

    const caseId = caseResult[0].id;

    // Update the case to have a specific resolution time (simulate 2 days)
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    
    await db.update(fraudCasesTable)
      .set({ 
        created_at: twoDaysAgo,
        updated_at: now 
      })
      .where(eq(fraudCasesTable.id, caseId));

    const statistics = await getCaseStatistics();

    expect(statistics.averageResolutionTime).toBeGreaterThan(1.5);
    expect(statistics.averageResolutionTime).toBeLessThan(2.5);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 99999;

    await expect(getCaseStatistics(nonExistentUserId))
      .rejects
      .toThrow(/User with ID 99999 not found/);
  });

  it('should handle viewer with no assigned cases', async () => {
    const users = await createTestUsers();
    const viewerUser = users.find(u => u.role === 'viewer')!;
    
    // Create some cases but don't assign any to the viewer
    const adminUser = users.find(u => u.role === 'admin')!;
    await db.insert(fraudCasesTable)
      .values({
        txid: 'TX_UNASSIGNED',
        description: 'Unassigned case',
        priority: 'medium',
        status: 'open',
        created_by: adminUser.id,
        assigned_to: null
      })
      .returning();

    const statistics = await getCaseStatistics(viewerUser.id);

    expect(statistics.totalCases).toBe(0);
    expect(statistics.unassignedCases).toBe(0);
    expect(statistics.escalatedCases).toBe(0);
    expect(Object.values(statistics.casesByStatus).every(count => count === 0)).toBe(true);
    expect(Object.values(statistics.casesByPriority).every(count => count === 0)).toBe(true);
  });

  it('should handle cases with all different statuses and priorities', async () => {
    const users = await createTestUsers();
    const adminUser = users.find(u => u.role === 'admin')!;

    // Create cases covering all statuses and priorities
    const statuses = ['open', 'in_progress', 'escalated', 'resolved', 'closed'] as const;
    const priorities = ['low', 'medium', 'high', 'critical'] as const;

    let caseCounter = 1;
    for (const status of statuses) {
      for (const priority of priorities) {
        await db.insert(fraudCasesTable)
          .values({
            txid: `TX_${status.toUpperCase()}_${priority.toUpperCase()}_${caseCounter}`,
            description: `Case with ${status} status and ${priority} priority`,
            priority,
            status,
            created_by: adminUser.id,
            assigned_to: caseCounter % 2 === 0 ? adminUser.id : null // Alternate assigned/unassigned
          })
          .returning();
        caseCounter++;
      }
    }

    const statistics = await getCaseStatistics();

    expect(statistics.totalCases).toBe(20); // 5 statuses × 4 priorities
    
    // Check each status has 4 cases (one for each priority)
    statuses.forEach(status => {
      expect(statistics.casesByStatus[status]).toBe(4);
    });
    
    // Check each priority has 5 cases (one for each status)  
    priorities.forEach(priority => {
      expect(statistics.casesByPriority[priority]).toBe(5);
    });
    
    expect(statistics.unassignedCases).toBe(10); // Half are unassigned
    expect(statistics.escalatedCases).toBe(4); // All escalated status cases
  });
});