import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPlanById } from "../db/repositories/insurancePlans.js";
import { getMedicationById, getMedicationsByDrugClass } from "../db/repositories/medications.js";
import {
  getEntry,
  upsertEntry,
  listCoveredEntriesForPlanAmongMedications,
} from "../db/repositories/formularyEntries.js";
import { createLookupLog } from "../db/repositories/lookupLogs.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getEnabledLiveProviders } from "../providers/registry.js";
import type { CoverageResult } from "../providers/types.js";

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

export async function coverageRoutes(app: FastifyInstance) {
  app.get("/coverage/check", { preHandler: requireAuth }, async (req, reply) => {
    const { planId, medicationId } = z
      .object({ planId: z.string().min(1), medicationId: z.string().min(1) })
      .parse(req.query);

    const [plan, medication] = await Promise.all([getPlanById(planId), getMedicationById(medicationId)]);
    if (!plan || !medication) {
      return reply.code(404).send({ error: "Plan or medication not found" });
    }

    const entry = await getEntry(planId, medicationId);

    let result: CoverageResult;
    if (entry) {
      result = {
        covered: entry.covered,
        tier: entry.tier,
        priorAuthRequired: entry.priorAuthRequired,
        stepTherapyRequired: entry.stepTherapyRequired,
        quantityLimit: entry.quantityLimit,
        estimatedCopayCents: entry.estimatedCopayCents,
        estimatedCoinsurancePct: entry.estimatedCoinsurancePct,
        notes: entry.notes,
        source: entry.dataSource,
        sourceUpdatedAt: entry.sourceUpdatedAt,
      };
    } else {
      // Nothing pre-loaded (manual entry or CMS import) for this
      // plan/medication pair — try any configured live provider (e.g.
      // Weno) before giving up and reporting "unknown".
      let liveResult: CoverageResult | null = null;
      for (const provider of getEnabledLiveProviders()) {
        liveResult = await provider.checkCoverage({ plan, medication });
        if (liveResult) break;
      }

      if (liveResult) {
        result = liveResult;
        // Cache it so future lookups for this plan/drug are instant and
        // don't re-spend a live API transaction.
        await upsertEntry({
          planId,
          medicationId,
          tier: liveResult.tier,
          covered: liveResult.covered,
          priorAuthRequired: liveResult.priorAuthRequired,
          stepTherapyRequired: liveResult.stepTherapyRequired,
          quantityLimit: liveResult.quantityLimit,
          estimatedCopayCents: liveResult.estimatedCopayCents,
          estimatedCoinsurancePct: liveResult.estimatedCoinsurancePct,
          notes: liveResult.notes,
          dataSource: "WENO",
          sourceUpdatedAt: liveResult.sourceUpdatedAt ?? new Date(),
        });
      } else {
        result = {
          covered: false,
          tier: "UNKNOWN",
          priorAuthRequired: false,
          stepTherapyRequired: false,
          notes: "No formulary data available for this plan/medication combination yet.",
          source: "MANUAL",
        };
      }
    }

    // Covered alternatives: same drug class, actually covered, cheapest
    // tier first. Only meaningful if we know the drug's class. Firestore
    // has no server-side join, so this narrows by drugClass first (an
    // indexed lookup on medications), then intersects with this plan's
    // covered formulary entries for those candidate medication IDs.
    let alternatives: { id: string; name: string; tier: string; estimatedCost: string | null }[] = [];
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
      userId: req.authedUser!.id,
      medicationQuery: medication.name,
      planId,
      resultSummary: `${result.covered ? "covered" : "not covered"} / ${result.tier}`,
    });

    return {
      plan: { id: plan.id, payerName: plan.payerName, planName: plan.planName },
      medication: { id: medication.id, name: medication.name, drugClass: medication.drugClass },
      coverage: { ...result, estimatedCost: formatCost(result) },
      alternatives,
    };
  });
}
