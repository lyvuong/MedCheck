import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createManualPlan, getPlansByIds } from "../db/repositories/insurancePlans.js";
import { createManualMedication, getMedicationsByIds } from "../db/repositories/medications.js";
import {
  upsertEntry,
  listEntriesForPlan,
  listRecentEntries,
  deleteEntry,
} from "../db/repositories/formularyEntries.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

const planSchema = z.object({
  payerName: z.string().min(1),
  planName: z.string().min(1),
  planType: z.string().optional(),
  state: z.string().optional(),
});

const medicationSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  ndc: z.string().optional(),
  drugClass: z.string().optional(),
  strength: z.string().optional(),
  form: z.string().optional(),
});

const coverageTiers = [
  "TIER_1_PREFERRED_GENERIC",
  "TIER_2_GENERIC",
  "TIER_3_PREFERRED_BRAND",
  "TIER_4_NON_PREFERRED_DRUG",
  "TIER_5_SPECIALTY",
  "NOT_COVERED",
  "UNKNOWN",
] as const;

const formularyEntrySchema = z.object({
  planId: z.string().min(1),
  medicationId: z.string().min(1),
  tier: z.enum(coverageTiers),
  covered: z.boolean(),
  priorAuthRequired: z.boolean().default(false),
  stepTherapyRequired: z.boolean().default(false),
  quantityLimit: z.string().optional(),
  estimatedCopayCents: z.number().int().optional(),
  estimatedCoinsurancePct: z.number().optional(),
  notes: z.string().optional(),
});

// Admin + staff can maintain manually-entered formulary data (the
// "MANUAL" data source). Doctors get read-only access via the search /
// coverage-check routes only.
export async function adminRoutes(app: FastifyInstance) {
  const canEdit = { preHandler: [requireAuth, requireRole("ADMIN", "STAFF")] };

  app.post("/admin/plans", canEdit, async (req, reply) => {
    const body = planSchema.parse(req.body);
    const plan = await createManualPlan(body);
    return reply.code(201).send({ plan });
  });

  app.post("/admin/medications", canEdit, async (req, reply) => {
    const body = medicationSchema.parse(req.body);
    const medication = await createManualMedication(body);
    return reply.code(201).send({ medication });
  });

  app.post("/admin/formulary-entries", canEdit, async (req, reply) => {
    const body = formularyEntrySchema.parse(req.body);
    const entry = await upsertEntry({ ...body, dataSource: "MANUAL", sourceUpdatedAt: new Date() });
    return reply.code(201).send({ entry });
  });

  app.get("/admin/formulary-entries", canEdit, async (req) => {
    const { planId } = z.object({ planId: z.string().min(1).optional() }).parse(req.query);
    const entries = planId ? await listEntriesForPlan(planId, 100) : await listRecentEntries(100);

    const [meds, plans] = await Promise.all([
      getMedicationsByIds(entries.map((e) => e.medicationId)),
      getPlansByIds(entries.map((e) => e.planId)),
    ]);
    const medById = new Map(meds.map((m) => [m.id, m]));
    const planById = new Map(plans.map((p) => [p.id, p]));

    const rows = entries.map((entry) => ({
      entry,
      medication: medById.get(entry.medicationId),
      plan: planById.get(entry.planId),
    }));
    return { entries: rows };
  });

  app.delete("/admin/formulary-entries/:id", canEdit, async (req) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    await deleteEntry(id);
    return { ok: true };
  });
}
