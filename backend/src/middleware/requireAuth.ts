import type { FastifyRequest, FastifyReply } from "fastify";

export interface AuthedUser {
  id: string;
  email: string;
  role: "ADMIN" | "DOCTOR" | "STAFF";
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authedUser?: AuthedUser;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await req.jwtVerify<AuthedUser>();
    req.authedUser = payload;
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: AuthedUser["role"][]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.authedUser || !roles.includes(req.authedUser.role)) {
      reply.code(403).send({ error: "Forbidden" });
    }
  };
}
