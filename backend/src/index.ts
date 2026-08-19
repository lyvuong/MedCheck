import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { medicationRoutes } from "./routes/medications.js";
import { planRoutes } from "./routes/plans.js";
import { coverageRoutes } from "./routes/coverage.js";
import { adminRoutes } from "./routes/admin.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";
import { hashPassword } from "./auth/password.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });
await app.register(jwt, { secret: config.jwtSecret });

app.get("/health", async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(medicationRoutes);
await app.register(planRoutes);
await app.register(coverageRoutes);
await app.register(adminRoutes);

// Convenience: on first boot, if no users exist yet and
// BOOTSTRAP_ADMIN_EMAIL/PASSWORD are set, create the first admin account
// so there's a way to log in at all on a fresh self-hosted install.
async function bootstrapAdmin() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) return;
  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) {
    app.log.warn(
      "No users exist and BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD are not set — set them in .env and restart, or run the seed script, to create a login."
    );
    return;
  }
  await db.insert(users).values({
    email: config.bootstrapAdminEmail,
    name: "Admin",
    role: "ADMIN",
    passwordHash: await hashPassword(config.bootstrapAdminPassword),
  });
  app.log.info(`Bootstrapped admin account: ${config.bootstrapAdminEmail}`);
}

await bootstrapAdmin();

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
