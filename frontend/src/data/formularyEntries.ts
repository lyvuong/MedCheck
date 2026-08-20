import { collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import type { FormularyEntry } from "./types";
import { chunk, IN_QUERY_CHUNK_SIZE } from "./util";

const col = collection(db, "formularyEntries");

function docId(planId: string, medicationId: string): string {
  return `${planId}_${medicationId}`;
}

function fromDoc(id: string, data: DocumentData): FormularyEntry {
  return {
    id,
    planId: data.planId,
    medicationId: data.medicationId,
    tier: data.tier,
    covered: data.covered,
    priorAuthRequired: data.priorAuthRequired,
    stepTherapyRequired: data.stepTherapyRequired,
    quantityLimit: data.quantityLimit ?? null,
    estimatedCopayCents: data.estimatedCopayCents ?? null,
    estimatedCoinsurancePct: data.estimatedCoinsurancePct ?? null,
    notes: data.notes ?? null,
    dataSource: data.dataSource,
  };
}

export async function getEntry(planId: string, medicationId: string): Promise<FormularyEntry | null> {
  const snap = await getDoc(doc(col, docId(planId, medicationId)));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/** Upserts by the deterministic `${planId}_${medicationId}` doc ID — a
 * natural upsert via `setDoc(..., {merge:true})`, doubling as the unique
 * (planId, medicationId) constraint. `merge:true` also means any
 * `createdAt` set by the CMS import/seed tooling is left untouched. */
export async function upsertEntry(input: {
  planId: string;
  medicationId: string;
  tier: string;
  covered: boolean;
  priorAuthRequired?: boolean;
  stepTherapyRequired?: boolean;
  quantityLimit?: string | null;
  estimatedCopayCents?: number | null;
  estimatedCoinsurancePct?: number | null;
  notes?: string | null;
}): Promise<void> {
  const ref = doc(col, docId(input.planId, input.medicationId));
  await setDoc(
    ref,
    {
      planId: input.planId,
      medicationId: input.medicationId,
      tier: input.tier,
      covered: input.covered,
      priorAuthRequired: input.priorAuthRequired ?? false,
      stepTherapyRequired: input.stepTherapyRequired ?? false,
      quantityLimit: input.quantityLimit ?? null,
      estimatedCopayCents: input.estimatedCopayCents ?? null,
      estimatedCoinsurancePct: input.estimatedCoinsurancePct ?? null,
      notes: input.notes ?? null,
      dataSource: "MANUAL",
      sourceUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Replaces the SQL join `formularyEntries INNER JOIN medications ...
 * WHERE planId = ? AND covered = true AND medicationId IN (...)` —
 * Firestore's `in` caps at 30 values, so this chunks and runs in
 * parallel. */
export async function listCoveredEntriesForPlanAmongMedications(
  planId: string,
  medicationIds: string[]
): Promise<FormularyEntry[]> {
  if (medicationIds.length === 0) return [];
  const results = await Promise.all(
    chunk(medicationIds, IN_QUERY_CHUNK_SIZE).map((ids) =>
      getDocs(query(col, where("planId", "==", planId), where("medicationId", "in", ids), where("covered", "==", true)))
    )
  );
  return results.flatMap((snap) => snap.docs.map((d) => fromDoc(d.id, d.data())));
}
