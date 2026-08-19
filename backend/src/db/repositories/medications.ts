import { firestore } from "../firestore.js";
import { medicationsCol } from "../collections.js";
import type { Medication } from "../collections.js";
import { toDate } from "./util.js";

const PREFIX_END = String.fromCharCode(0xf8ff);

function fromDoc(id: string, data: FirebaseFirestore.DocumentData): Medication {
  return {
    id,
    name: data.name,
    genericName: data.genericName ?? null,
    ndc: data.ndc ?? null,
    rxcui: data.rxcui ?? null,
    drugClass: data.drugClass ?? null,
    strength: data.strength ?? null,
    form: data.form ?? null,
    createdAt: toDate(data.createdAt),
  };
}

export async function getMedicationById(id: string): Promise<Medication | null> {
  const snap = await medicationsCol.doc(id).get();
  if (!snap.exists) return null;
  return fromDoc(snap.id, snap.data()!);
}

export async function getMedicationsByIds(ids: string[]): Promise<Medication[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  const snaps = await firestore.getAll(...uniqueIds.map((id) => medicationsCol.doc(id)));
  return snaps.filter((s) => s.exists).map((s) => fromDoc(s.id, s.data()!));
}

export async function getMedicationsByDrugClass(drugClass: string, limit = 200): Promise<Medication[]> {
  const snap = await medicationsCol.where("drugClass", "==", drugClass).limit(limit).get();
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

async function prefixQuery(field: string, q: string, limit: number) {
  const lower = q.toLowerCase();
  const snap = await medicationsCol
    .where(field, ">=", lower)
    .where(field, "<", lower + PREFIX_END)
    .orderBy(field)
    .limit(limit)
    .get();
  return snap.docs;
}

/**
 * Prefix-match only (no substring search — see insurancePlans.ts's
 * searchPlans for the same tradeoff). Also checks an exact NDC match
 * since NDC is the medication's doc ID when known.
 */
export async function searchMedications(q: string, limit = 20): Promise<Medication[]> {
  const [byName, byGeneric, byNdc] = await Promise.all([
    prefixQuery("nameLower", q, limit),
    prefixQuery("genericNameLower", q, limit),
    medicationsCol.doc(q).get(),
  ]);
  const seen = new Map<string, Medication>();
  for (const d of [...byName, ...byGeneric]) {
    if (!seen.has(d.id)) seen.set(d.id, fromDoc(d.id, d.data()));
  }
  if (byNdc.exists && !seen.has(byNdc.id)) {
    seen.set(byNdc.id, fromDoc(byNdc.id, byNdc.data()!));
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
}

export async function createManualMedication(input: {
  name: string;
  genericName?: string;
  ndc?: string;
  drugClass?: string;
  strength?: string;
  form?: string;
}): Promise<Medication> {
  const ref = input.ndc ? medicationsCol.doc(input.ndc) : medicationsCol.doc();
  const existing = await ref.get();
  const createdAt = existing.exists ? toDate(existing.data()!.createdAt) : new Date();
  const data = {
    name: input.name,
    genericName: input.genericName ?? null,
    ndc: input.ndc ?? null,
    drugClass: input.drugClass ?? null,
    strength: input.strength ?? null,
    form: input.form ?? null,
    nameLower: input.name.toLowerCase(),
    genericNameLower: (input.genericName ?? "").toLowerCase(),
    createdAt,
  };
  await ref.set(data, { merge: true });
  return fromDoc(ref.id, data);
}

/** Upserts a CMS-sourced medication keyed by NDC (the doc ID) — a natural
 * upsert via `set(..., {merge:true})`, no transaction needed since the
 * doc ID itself is the unique key. */
export async function upsertCmsMedication(input: {
  ndc: string;
  rxcui?: string;
  name: string;
}): Promise<Medication> {
  const ref = medicationsCol.doc(input.ndc);
  const existing = await ref.get();
  const existingData = existing.data();
  const name = existing.exists ? existingData!.name : input.name;
  const data = {
    ndc: input.ndc,
    rxcui: input.rxcui ?? existingData?.rxcui ?? null,
    name,
    genericName: existingData?.genericName ?? null,
    drugClass: existingData?.drugClass ?? null,
    strength: existingData?.strength ?? null,
    form: existingData?.form ?? null,
    nameLower: name.toLowerCase(),
    genericNameLower: (existingData?.genericName ?? "").toLowerCase(),
    createdAt: existing.exists ? toDate(existingData!.createdAt) : new Date(),
  };
  await ref.set(data, { merge: true });
  return fromDoc(ref.id, data);
}
