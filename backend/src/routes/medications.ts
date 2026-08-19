import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { or, ilike, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { medications } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function medicationRoutes(app: FastifyInstance) {
  app.get("/medications/search", { preHandler: requireAuth }, async (req) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    const like = `%${q}%`;
    const rows = await db
      .select()
      .from(medications)
      .where(
        or(
          ilike(medications.name, like),
          ilike(medications.genericName, like),
          ilike(medications.ndc, like)
        )
      )
      .orderBy(asc(medications.name))
      .limit(20);
    return { medications: rows };
  });
}
