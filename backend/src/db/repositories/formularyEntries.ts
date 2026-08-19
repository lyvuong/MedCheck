import { firestore } from "../firestore.js";
import { formularyEntriesCol } from "../collections.js";
import type { FormularyEntry, CoverageTier, DataSource } from "../collections.js";
import { toDate, chunk, IN_QUERY_CHUNK_SIZE } from "./util.js";

function docId(planId: string, medicationId: string): string {
  return `${planId}_${medicationId}`;
}

function fromDoc(id: string, data: FirebaseFirestore.DocumentData): FormularyEntry {
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
    sourceUpdatedAt: data.sourceUpdatedAt ? toDate(data.sourceUpdatedAt) : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getEntry(planId: string, medicationId: string): Promise<FormularyEntry | null> {
  const snap = await formularyEntriesCol.doc(docId(planId, medicationId)).get();
  if (!snap.exists) return null;
  return fromDoc(snap.id, snap.data()!);
}

/**
 * Upserts by the deterministic `${planId}_${medicationId}` doc ID, which
 * directly implements the `(planId, medicationId)` unique index Postgres
 * enforced — `set(..., {merge:true})` is a natural upsert here, no
 * transaction required.
 */
export async function upsertEntry(input: {
  planId: string;
  medicationId: string;
  tier: CoverageTier;
  covered: boolean;
  priorAuthRequired?: boolean;
  stepTherapyRequired?: boolean;
  quantityLimit?: string | null;
  estimatedCopayCents?: number | null;
  estimatedCoinsurancePct?: number | null;
  notes?: string | null;
  dataSource: DataSource;
  sourceUpdatedAt?: Date;
}): Promise<FormularyEntry> {
  const id = docId(input.planId, input.medicationId);
  const ref = formularyEntriesCol.doc(id);
  const existing = await ref.get();
  const now = new Date();
  const data = {
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
    dataSource: input.dataSource,
    sourceUpdatedAt: input.sourceUpdatedAt ?? now,
    updatedAt: now,
    createdAt: existing.exists ? existing.data()!.createdAt : now,
  };
  await ref.set(data, { merge: true });
  return fromDoc(id, data);
}

export async function listEntriesForPlan(planId: string, limit = 100): Promise<FormularyEntry[]> {
  const snap = await formularyEntriesCol
    .where("planId", "==", planId)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function listRecentEntries(limit = 100): Promise<FormularyEntry[]> {
  const snap = await formularyEntriesCol.orderBy("updatedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

/**
 * Replaces the SQL join `formularyEntries INNER JOIN medications ... WHERE
 * planId = ? AND covered = true AND medicationId IN (...)` — Firestore's
 * `in` operator caps at 30 values, so this chunks and runs queries in
 * parallel.
 */
export async function listCoveredEntriesForPlanAmongMedications(
  planId: string,
  medicationIds: string[]
): Promise<FormularyEntry[]> {
  if (medicationIds.length === 0) return [];
  const results = await Promise.all(
    chunk(medicationIds, IN_QUERY_CHUNK_SIZE).map((ids) =>
      formularyEntriesCol
        .where("planId", "==", planId)
        .where("medicationId", "in", ids)
        .where("covered", "==", true)
        .get()
    )
  );
  return results.flatMap((snap) => snap.docs.map((d) => fromDoc(d.id, d.data())));
}

export async function deleteEntry(id: string): Promise<void> {
  await formularyEntriesCol.doc(id).delete();
}

const BATCH_DELETE_SIZE = 500; // Firestore's per-batch write limit.

async function deleteWhereField(field: "planId" | "medicationId", value: string): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await formularyEntriesCol.where(field, "==", value).limit(BATCH_DELETE_SIZE).get();
    if (snap.empty) break;
    const batch = firestore.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.docs.length;
    if (snap.docs.length < BATCH_DELETE_SIZE) break;
  }
  return deleted;
}

/** Replaces Postgres's `ON DELETE CASCADE` from insurance_plans. */
export async function deleteFormularyEntriesForPlan(planId: string): Promise<number> {
  return deleteWhereField("planId", planId);
}

/** Replaces Postgres's `ON DELETE CASCADE` from medications. */
export async function deleteFormularyEntriesForMedication(medicationId: string): Promise<number> {
  return deleteWhereField("medicationId", medicationId);
}
