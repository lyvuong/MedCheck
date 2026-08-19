import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findUserByEmail, createUser, listUsers, setUserActive } from "../db/repositories/users.js";
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
    const user = await findUserByEmail(body.email);
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
      try {
        const user = await createUser({
          email: body.email,
          name: body.name,
          role: body.role,
          npi: body.npi,
          passwordHash: await hashPassword(body.password),
        });
        return reply.code(201).send({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "EMAIL_TAKEN") {
          return reply.code(409).send({ error: "Email already registered" });
        }
        throw err;
      }
    }
  );

  app.get("/auth/users", { preHandler: [requireAuth, requireRole("ADMIN")] }, async () => {
    const rows = await listUsers();
    return {
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt,
      })),
    };
  });

  app.patch(
    "/auth/users/:id/active",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      const user = await setUserActive(id, active);
      return { id: user.id, active: user.active };
    }
  );
}
