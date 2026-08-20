import { getPlanById } from "./insurancePlans";
import { getMedicationById, getMedicationsByDrugClass } from "./medications";
import { getEntry, listCoveredEntriesForPlanAmongMedications } from "./formularyEntries";
import { createLookupLog } from "./lookupLogs";
import type { CoverageCheckResult } from "./types";

const tierRank: Record<string, number> = {
  TIER_1_PREFERRED_GENERIC: 1,
  TIER_2_GENERIC: 2,
  TIER_3_PREFERRED_BRAND: 3,
  TIER_4_NON_PREFERRED_DRUG: 4,
  TIER_5_SPECIALTY: 5,
  NOT_COVERED: 99,
  UNKNOWN: 50,
};

function formatCost(entry: {
  estimatedCopayCents?: number | null;
  estimatedCoinsurancePct?: number | null;
}): string | null {
  if (entry.estimatedCopayCents != null) {
    return `$${(entry.estimatedCopayCents / 100).toFixed(2)} copay`;
  }
  if (entry.estimatedCoinsurancePct != null) {
    return `${entry.estimatedCoinsurancePct}% coinsurance`;
  }
  return null;
}

export async function checkCoverage(
  planId: string,
  medicationId: string,
  userEmail: string
): Promise<CoverageCheckResult> {
  const [plan, medication] = await Promise.all([getPlanById(planId), getMedicationById(medicationId)]);
  if (!plan || !medication) {
    throw new Error("Plan or medication not found");
  }

  const entry = await getEntry(planId, medicationId);
  const coverage = entry
    ? {
        covered: entry.covered,
        tier: entry.tier,
        priorAuthRequired: entry.priorAuthRequired,
        stepTherapyRequired: entry.stepTherapyRequired,
        quantityLimit: entry.quantityLimit ?? null,
        estimatedCost: formatCost(entry),
        notes: entry.notes ?? null,
        source: entry.dataSource,
      }
    : {
        covered: false,
        tier: "UNKNOWN",
        priorAuthRequired: false,
        stepTherapyRequired: false,
        quantityLimit: null,
        estimatedCost: null,
        notes: "No formulary data available for this plan/medication combination yet.",
        source: "MANUAL",
      };

  // Covered alternatives: same drug class, actually covered, cheapest
  // tier first. Firestore has no server-side join, so this narrows by
  // drugClass first (an indexed lookup), then intersects with this
  // plan's covered formulary entries for those candidate medication IDs.
  let alternatives: CoverageCheckResult["alternatives"] = [];
  if (medication.drugClass) {
    const candidates = await getMedicationsByDrugClass(medication.drugClass);
    const candidateIds = candidates.filter((m) => m.id !== medicationId).map((m) => m.id);
    const entries = await listCoveredEntriesForPlanAmongMedications(planId, candidateIds);
    const medById = new Map(candidates.map((m) => [m.id, m]));

    alternatives = entries
      .sort((a, b) => tierRank[a.tier] - tierRank[b.tier])
      .slice(0, 5)
      .map((e) => ({
        id: e.medicationId,
        name: medById.get(e.medicationId)!.name,
        tier: e.tier,
        estimatedCost: formatCost(e),
      }));
  }

  await createLookupLog({
    userEmail,
    medicationQuery: medication.name,
    planId,
    resultSummary: `${coverage.covered ? "covered" : "not covered"} / ${coverage.tier}`,
  });

  return {
    plan: { id: plan.id, payerName: plan.payerName, planName: plan.planName },
    medication: { id: medication.id, name: medication.name, drugClass: medication.drugClass },
    coverage,
    alternatives,
  };
}
