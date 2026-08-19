import { lookupLogsCol } from "../collections.js";

export async function createLookupLog(input: {
  userId: string;
  medicationQuery: string;
  planId?: string;
  resultSummary?: string;
}): Promise<void> {
  await lookupLogsCol.add({
    userId: input.userId,
    medicationQuery: input.medicationQuery,
    planId: input.planId ?? null,
    resultSummary: input.resultSummary ?? null,
    createdAt: new Date(),
  });
}
