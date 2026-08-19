import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { insurancePlans, medications, formularyEntries } from "../db/schema.js";
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
  planId: z.string().uuid(),
  medicationId: z.string().uuid(),
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
    const [plan] = await db
      .insert(insurancePlans)
      .values({ ...body, dataSource: "MANUAL" })
      .returning();
    return reply.code(201).send({ plan });
  });

  app.post("/admin/medications", canEdit, async (req, reply) => {
    const body = medicationSchema.parse(req.body);
    const [medication] = await db.insert(medications).values(body).returning();
    return reply.code(201).send({ medication });
  });

  app.post("/admin/formulary-entries", canEdit, async (req, reply) => {
    const body = formularyEntrySchema.parse(req.body);
    const [entry] = await db
      .insert(formularyEntries)
      .values({ ...body, dataSource: "MANUAL", sourceUpdatedAt: new Date() })
      .onConflictDoUpdate({
        target: [formularyEntries.planId, formularyEntries.medicationId],
        set: { ...body, dataSource: "MANUAL", sourceUpdatedAt: new Date(), updatedAt: new Date() },
      })
      .returning();
    return reply.code(201).send({ entry });
  });

  app.get("/admin/formulary-entries", canEdit, async (req) => {
    const { planId } = z.object({ planId: z.string().uuid().optional() }).parse(req.query);
    const rows = await db
      .select({ entry: formularyEntries, medication: medications, plan: insurancePlans })
      .from(formularyEntries)
      .innerJoin(medications, eq(formularyEntries.medicationId, medications.id))
      .innerJoin(insurancePlans, eq(formularyEntries.planId, insurancePlans.id))
      .where(planId ? eq(formularyEntries.planId, planId) : undefined)
      .orderBy(desc(formularyEntries.updatedAt))
      .limit(100);
    return { entries: rows };
  });

  app.delete("/admin/formulary-entries/:id", canEdit, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await db.delete(formularyEntries).where(eq(formularyEntries.id, id));
    return { ok: true };
  });
}
