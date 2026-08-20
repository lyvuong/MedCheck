import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Medication } from "./types";
import { PREFIX_END } from "./util";

const col = collection(db, "medications");

function fromDoc(id: string, data: DocumentData): Medication {
  return {
    id,
    name: data.name,
    genericName: data.genericName ?? null,
    ndc: data.ndc ?? null,
    drugClass: data.drugClass ?? null,
    strength: data.strength ?? null,
    form: data.form ?? null,
  };
}

export async function getMedicationById(id: string): Promise<Medication | null> {
  const snap = await getDoc(doc(col, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

export async function getMedicationsByDrugClass(drugClass: string, max = 200): Promise<Medication[]> {
  const snap = await getDocs(query(col, where("drugClass", "==", drugClass), fsLimit(max)));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

async function prefixQuery(field: string, q: string, max: number) {
  const lower = q.toLowerCase();
  const snap = await getDocs(
    query(col, where(field, ">=", lower), where(field, "<", lower + PREFIX_END), orderBy(field), fsLimit(max))
  );
  return snap.docs;
}

/** Prefix-match on name, generic name, or drug class (so browsing by
 * class — e.g. "Statin" — surfaces every drug in it), plus an exact NDC
 * check (NDC is the doc ID when known). */
export async function searchMedications(q: string, max = 20): Promise<Medication[]> {
  const [byName, byGeneric, byClass, byNdc] = await Promise.all([
    prefixQuery("nameLower", q, max),
    prefixQuery("genericNameLower", q, max),
    prefixQuery("drugClassLower", q, max),
    q.includes("/") ? Promise.resolve(null) : getDoc(doc(col, q)),
  ]);
  const seen = new Map<string, Medication>();
  for (const d of [...byName, ...byGeneric, ...byClass]) {
    if (!seen.has(d.id)) seen.set(d.id, fromDoc(d.id, d.data()));
  }
  if (byNdc?.exists() && !seen.has(byNdc.id)) {
    seen.set(byNdc.id, fromDoc(byNdc.id, byNdc.data()));
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, max);
}

export async function createManualMedication(input: {
  name: string;
  genericName?: string;
  ndc?: string;
  drugClass?: string;
  strength?: string;
  form?: string;
}): Promise<Medication> {
  const ref = input.ndc ? doc(col, input.ndc) : doc(col);
  const data = {
    name: input.name,
    genericName: input.genericName ?? null,
    ndc: input.ndc ?? null,
    drugClass: input.drugClass ?? null,
    strength: input.strength ?? null,
    form: input.form ?? null,
    nameLower: input.name.toLowerCase(),
    genericNameLower: (input.genericName ?? "").toLowerCase(),
    drugClassLower: (input.drugClass ?? "").toLowerCase(),
  };
  await setDoc(ref, data, { merge: true });
  return fromDoc(ref.id, data);
}
