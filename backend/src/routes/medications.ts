import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchMedications } from "../db/repositories/medications.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function medicationRoutes(app: FastifyInstance) {
  app.get("/medications/search", { preHandler: requireAuth }, async (req) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    const medications = await searchMedications(q, 20);
    return { medications };
  });
}
