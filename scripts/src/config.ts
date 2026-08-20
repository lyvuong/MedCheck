function required(name: string): string {
  const v = process.env[name];
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  firestoreProjectId: required("FIRESTORE_PROJECT_ID"),
  // Path to a service-account JSON file. Falls back to
  // applicationDefault() (ambient gcloud/CI credentials) when unset.
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
};
