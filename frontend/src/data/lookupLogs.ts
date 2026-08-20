import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function createLookupLog(input: {
  userEmail: string;
  medicationQuery: string;
  planId?: string;
  resultSummary?: string;
}): Promise<void> {
  await addDoc(collection(db, "lookupLogs"), {
    userId: input.userEmail,
    medicationQuery: input.medicationQuery,
    planId: input.planId ?? null,
    resultSummary: input.resultSummary ?? null,
    createdAt: serverTimestamp(),
  });
}
