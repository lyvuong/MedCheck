function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required(
    "JWT_SECRET",
    process.env.NODE_ENV === "production" ? undefined : "dev-only-insecure-secret"
  ),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  // Path to a mounted Firebase service-account JSON file. Falls back to
  // applicationDefault() (e.g. ambient Cloud Run credentials) when unset.
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  firestoreProjectId: process.env.FIRESTORE_PROJECT_ID,
};
