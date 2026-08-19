import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "DOCTOR", "STAFF"]),
  npi: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const token = app.jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      { expiresIn: "12h" }
    );
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req) => {
    return { user: req.authedUser };
  });

  // Only admins can create new accounts — keeps per-user accounts
  // meaningful (audit trail of who looked up what) rather than open
  // self-signup for a doctor-facing internal tool.
  app.post(
    "/auth/users",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req, reply) => {
      const body = createUserSchema.parse(req.body);
      const [existing] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      if (existing) {
        return reply.code(409).send({ error: "Email already registered" });
      }
      const [user] = await db
        .insert(users)
        .values({
          email: body.email,
          name: body.name,
          role: body.role,
          npi: body.npi,
          passwordHash: await hashPassword(body.password),
        })
        .returning();
      return reply.code(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    }
  );

  app.get("/auth/users", { preHandler: [requireAuth, requireRole("ADMIN")] }, async () => {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);
    return { users: rows };
  });

  app.patch(
    "/auth/users/:id/active",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      const [user] = await db.update(users).set({ active }).where(eq(users.id, id)).returning();
      return { id: user.id, active: user.active };
    }
  );
}
