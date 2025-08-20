import { db } from '../db';
import { fraudCasesTable, usersTable } from '../db/schema';
import { type CaseStatus, type CasePriority } from '../schema';
import { eq, isNull, count, sql, avg, and } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface CaseStatistics {
    totalCases: number;
    casesByStatus: Record<CaseStatus, number>;
    casesByPriority: Record<CasePriority, number>;
    unassignedCases: number;
    averageResolutionTime: number; // in days
    escalatedCases: number;
}

export async function getCaseStatistics(userId?: number): Promise<CaseStatistics> {
    try {
        // Initialize statistics with default values
        const statistics: CaseStatistics = {
            totalCases: 0,
            casesByStatus: {
                open: 0,
                in_progress: 0,
                escalated: 0,
                resolved: 0,
                closed: 0
            },
            casesByPriority: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            },
            unassignedCases: 0,
            averageResolutionTime: 0,
            escalatedCases: 0
        };

        // Build base query conditions
        const conditions: SQL<unknown>[] = [];
        
        if (userId !== undefined) {
            // Get user role to determine filtering
            const userResult = await db.select()
                .from(usersTable)
                .where(eq(usersTable.id, userId));
            
            if (userResult.length === 0) {
                throw new Error(`User with ID ${userId} not found`);
            }
            
            const user = userResult[0];
            
            // Viewers can only see their assigned cases
            if (user.role === 'viewer') {
                conditions.push(eq(fraudCasesTable.assigned_to, userId));
            }
            // Admin, investigator, and analyst can see all cases (no additional filtering)
        }

        // Get total cases count
        const totalQuery = db.select({ count: count() })
            .from(fraudCasesTable);
        
        const totalResult = conditions.length > 0
            ? await totalQuery.where(and(...conditions))
            : await totalQuery;
        statistics.totalCases = totalResult[0]?.count || 0;

        // Get cases by status
        const statusCounts = await Promise.all([
            'open', 'in_progress', 'escalated', 'resolved', 'closed'
        ].map(async (status) => {
            const statusConditions = [...conditions, eq(fraudCasesTable.status, status as CaseStatus)];
            
            const statusQuery = db.select({ count: count() })
                .from(fraudCasesTable);
            
            const result = statusConditions.length > 0
                ? await statusQuery.where(and(...statusConditions))
                : await statusQuery;
            
            return { status: status as CaseStatus, count: result[0]?.count || 0 };
        }));

        statusCounts.forEach(({ status, count: statusCount }) => {
            statistics.casesByStatus[status] = statusCount;
        });

        // Get cases by priority
        const priorityCounts = await Promise.all([
            'low', 'medium', 'high', 'critical'
        ].map(async (priority) => {
            const priorityConditions = [...conditions, eq(fraudCasesTable.priority, priority as CasePriority)];
            
            const priorityQuery = db.select({ count: count() })
                .from(fraudCasesTable);
            
            const result = priorityConditions.length > 0
                ? await priorityQuery.where(and(...priorityConditions))
                : await priorityQuery;
            
            return { priority: priority as CasePriority, count: result[0]?.count || 0 };
        }));

        priorityCounts.forEach(({ priority, count: priorityCount }) => {
            statistics.casesByPriority[priority] = priorityCount;
        });

        // Get unassigned cases count
        const unassignedConditions = [...conditions, isNull(fraudCasesTable.assigned_to)];
        
        const unassignedQuery = db.select({ count: count() })
            .from(fraudCasesTable);
        
        const unassignedResult = unassignedConditions.length > 0
            ? await unassignedQuery.where(and(...unassignedConditions))
            : await unassignedQuery;
        statistics.unassignedCases = unassignedResult[0]?.count || 0;

        // Get escalated cases count (status = 'escalated')
        statistics.escalatedCases = statistics.casesByStatus.escalated;

        // Calculate average resolution time for resolved and closed cases
        const resolutionConditions = [...conditions];
        resolutionConditions.push(
            sql`${fraudCasesTable.status} IN ('resolved', 'closed')`
        );

        const resolutionQuery = db.select({
            avgDays: avg(sql`EXTRACT(epoch FROM (${fraudCasesTable.updated_at} - ${fraudCasesTable.created_at})) / 86400`)
        }).from(fraudCasesTable);

        const resolutionResult = resolutionConditions.length > 0
            ? await resolutionQuery.where(and(...resolutionConditions))
            : await resolutionQuery;
        const avgResolutionTime = resolutionResult[0]?.avgDays;
        statistics.averageResolutionTime = avgResolutionTime ? parseFloat(avgResolutionTime.toString()) : 0;

        return statistics;
    } catch (error) {
        console.error('Failed to get case statistics:', error);
        throw error;
    }
}