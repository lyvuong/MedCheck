import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { or, ilike, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { insurancePlans } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/plans/search", { preHandler: requireAuth }, async (req) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    const like = `%${q}%`;
    const rows = await db
      .select()
      .from(insurancePlans)
      .where(or(ilike(insurancePlans.payerName, like), ilike(insurancePlans.planName, like)))
      .orderBy(asc(insurancePlans.payerName), asc(insurancePlans.planName))
      .limit(20);
    return { plans: rows };
  });
}
