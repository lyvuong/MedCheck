import { firestore } from "../firestore.js";
import { insurancePlansCol } from "../collections.js";
import type { InsurancePlan, DataSource } from "../collections.js";
import { toDate } from "./util.js";
import { deleteFormularyEntriesForPlan } from "./formularyEntries.js";

// A sentinel above any realistic Unicode character, so `field < lower + PREFIX_END`
// matches every string that starts with `lower`. Built via fromCharCode to avoid
// embedding an invisible private-use-area character literally in source.
const PREFIX_END = String.fromCharCode(0xf8ff);

function fromDoc(id: string, data: FirebaseFirestore.DocumentData): InsurancePlan {
  return {
    id,
    payerName: data.payerName,
    planName: data.planName,
    planType: data.planType ?? null,
    contractId: data.contractId ?? null,
    planId: data.planId ?? null,
    segmentId: data.segmentId ?? null,
    planYear: data.planYear ?? null,
    state: data.state ?? null,
    dataSource: data.dataSource,
    sourceUpdatedAt: data.sourceUpdatedAt ? toDate(data.sourceUpdatedAt) : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getPlanById(id: string): Promise<InsurancePlan | null> {
  const snap = await insurancePlansCol.doc(id).get();
  if (!snap.exists) return null;
  return fromDoc(snap.id, snap.data()!);
}

export async function getPlansByIds(ids: string[]): Promise<InsurancePlan[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  const snaps = await firestore.getAll(...uniqueIds.map((id) => insurancePlansCol.doc(id)));
  return snaps.filter((s) => s.exists).map((s) => fromDoc(s.id, s.data()!));
}

export async function findPlanByExactName(planName: string): Promise<InsurancePlan | null> {
  const snap = await insurancePlansCol.where("planName", "==", planName).limit(1).get();
  if (snap.empty) return null;
  return fromDoc(snap.docs[0].id, snap.docs[0].data());
}

async function prefixQuery(field: string, q: string, limit: number) {
  const lower = q.toLowerCase();
  const snap = await insurancePlansCol
    .where(field, ">=", lower)
    .where(field, "<", lower + PREFIX_END)
    .orderBy(field)
    .limit(limit)
    .get();
  return snap.docs;
}

/**
 * Prefix-match only (no substring search — Firestore has no native
 * equivalent to SQL ILIKE '%q%'). Runs two range queries in parallel
 * since Firestore can't OR across two different fields' ranges in one
 * query, then merges/dedupes client-side.
 */
export async function searchPlans(q: string, limit = 20): Promise<InsurancePlan[]> {
  const [byPayer, byPlan] = await Promise.all([
    prefixQuery("payerNameLower", q, limit),
    prefixQuery("planNameLower", q, limit),
  ]);
  const seen = new Map<string, InsurancePlan>();
  for (const d of [...byPayer, ...byPlan]) {
    if (!seen.has(d.id)) seen.set(d.id, fromDoc(d.id, d.data()));
  }
  return [...seen.values()]
    .sort((a, b) => a.payerName.localeCompare(b.payerName) || a.planName.localeCompare(b.planName))
    .slice(0, limit);
}

export async function createManualPlan(input: {
  payerName: string;
  planName: string;
  planType?: string;
  state?: string;
}): Promise<InsurancePlan> {
  const now = new Date();
  const ref = insurancePlansCol.doc();
  const data = {
    payerName: input.payerName,
    planName: input.planName,
    planType: input.planType ?? null,
    state: input.state ?? null,
    payerNameLower: input.payerName.toLowerCase(),
    planNameLower: input.planName.toLowerCase(),
    dataSource: "MANUAL" as DataSource,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return fromDoc(ref.id, data);
}

/**
 * Upserts a CMS-sourced plan keyed by the compound identity Postgres used
 * to enforce as a unique index: (contractId, planId, segmentId, planYear).
 * Firestore has no compound-unique-index primitive, so this is emulated
 * with a query-then-write inside a transaction on a denormalized
 * `cmsIdentityKey` field.
 */
export async function upsertCmsPlan(input: {
  contractId: string;
  planId: string;
  segmentId: string;
  planYear: number;
  payerName: string;
  planName: string;
  planType: string | null;
  state: string | null;
}): Promise<InsurancePlan> {
  const cmsIdentityKey = `${input.contractId}|${input.planId}|${input.segmentId}|${input.planYear}`;
  return firestore.runTransaction(async (tx) => {
    const existingSnap = await tx.get(
      insurancePlansCol.where("cmsIdentityKey", "==", cmsIdentityKey).limit(1)
    );
    const now = new Date();
    const existingDoc = existingSnap.empty ? null : existingSnap.docs[0];
    const ref = existingDoc ? existingDoc.ref : insurancePlansCol.doc();
    const createdAt = existingDoc ? toDate(existingDoc.data().createdAt) : now;
    const data = {
      contractId: input.contractId,
      planId: input.planId,
      segmentId: input.segmentId,
      planYear: input.planYear,
      payerName: input.payerName,
      planName: input.planName,
      planType: input.planType,
      state: input.state,
      payerNameLower: input.payerName.toLowerCase(),
      planNameLower: input.planName.toLowerCase(),
      cmsIdentityKey,
      dataSource: "CMS_PUF" as DataSource,
      sourceUpdatedAt: now,
      createdAt,
      updatedAt: now,
    };
    tx.set(ref, data, { merge: true });
    return fromDoc(ref.id, data);
  });
}

export async function deletePlan(id: string): Promise<void> {
  await deleteFormularyEntriesForPlan(id);
  await insurancePlansCol.doc(id).delete();
}
