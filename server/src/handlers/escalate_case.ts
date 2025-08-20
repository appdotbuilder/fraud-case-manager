import { db } from '../db';
import { fraudCasesTable, caseEscalationsTable } from '../db/schema';
import { type EscalateCaseInput, type CaseEscalation, type FraudCase } from '../schema';
import { eq } from 'drizzle-orm';

export const escalateCase = async (input: EscalateCaseInput): Promise<{ case: FraudCase; escalation: CaseEscalation }> => {
  try {
    // First, fetch the current case to get the previous status and priority
    const existingCases = await db.select()
      .from(fraudCasesTable)
      .where(eq(fraudCasesTable.id, input.case_id))
      .execute();

    if (existingCases.length === 0) {
      throw new Error(`Case with ID ${input.case_id} not found`);
    }

    const existingCase = existingCases[0];

    // Prepare the escalation record
    const escalationData = {
      case_id: input.case_id,
      escalated_by: input.escalated_by,
      escalated_to: input.escalated_to || null,
      previous_status: existingCase.status,
      new_status: input.new_status || 'escalated',
      previous_priority: existingCase.priority,
      new_priority: input.new_priority,
      reason: input.reason
    };

    // Insert the escalation record
    const escalationResults = await db.insert(caseEscalationsTable)
      .values(escalationData)
      .returning()
      .execute();

    const escalation = escalationResults[0];

    // Update the case with new priority and optionally new status and assignee
    const updateData: any = {
      priority: input.new_priority,
      updated_at: new Date()
    };

    if (input.new_status) {
      updateData.status = input.new_status;
    }

    if (input.escalated_to !== undefined) {
      updateData.assigned_to = input.escalated_to;
    }

    const updatedCaseResults = await db.update(fraudCasesTable)
      .set(updateData)
      .where(eq(fraudCasesTable.id, input.case_id))
      .returning()
      .execute();

    const updatedCase = updatedCaseResults[0];

    return {
      case: updatedCase,
      escalation: escalation
    };
  } catch (error) {
    console.error('Case escalation failed:', error);
    throw error;
  }
};