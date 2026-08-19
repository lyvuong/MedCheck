import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchPlans } from "../db/repositories/insurancePlans.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/plans/search", { preHandler: requireAuth }, async (req) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    const plans = await searchPlans(q, 20);
    return { plans };
  });
}
