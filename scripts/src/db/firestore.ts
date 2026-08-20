import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { config } from "../config.js";

// Prefer an explicit service-account file (mounted into the container —
// see docker-compose.yml) so this works the same in local dev and
// self-hosted deployment. Falls back to applicationDefault() for
// environments (e.g. Cloud Run) that already have ambient credentials.
const credential = config.googleApplicationCredentials
  ? cert(JSON.parse(readFileSync(config.googleApplicationCredentials, "utf8")))
  : applicationDefault();

const app = initializeApp({
  credential,
  projectId: config.firestoreProjectId,
});

export const firestore = getFirestore(app);
