import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import type { InsurancePlan } from "./types";
import { PREFIX_END } from "./util";

const col = collection(db, "insurancePlans");

function fromDoc(id: string, data: DocumentData): InsurancePlan {
  return {
    id,
    payerName: data.payerName,
    planName: data.planName,
    planType: data.planType ?? null,
    state: data.state ?? null,
    dataSource: data.dataSource,
  };
}

export async function getPlanById(id: string): Promise<InsurancePlan | null> {
  const snap = await getDoc(doc(col, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

export async function getPlansByIds(ids: string[]): Promise<InsurancePlan[]> {
  const uniqueIds = [...new Set(ids)];
  const snaps = await Promise.all(uniqueIds.map((id) => getDoc(doc(col, id))));
  return snaps.filter((s) => s.exists()).map((s) => fromDoc(s.id, s.data()));
}

async function prefixQuery(field: string, q: string, max: number) {
  const lower = q.toLowerCase();
  const snap = await getDocs(
    query(col, where(field, ">=", lower), where(field, "<", lower + PREFIX_END), orderBy(field), fsLimit(max))
  );
  return snap.docs;
}

/** Prefix-match only — Firestore has no substring search. Runs two range
 * queries in parallel (payer name, plan name) and merges/dedupes. */
export async function searchPlans(q: string, max = 20): Promise<InsurancePlan[]> {
  const [byPayer, byPlan] = await Promise.all([
    prefixQuery("payerNameLower", q, max),
    prefixQuery("planNameLower", q, max),
  ]);
  const seen = new Map<string, InsurancePlan>();
  for (const d of [...byPayer, ...byPlan]) {
    if (!seen.has(d.id)) seen.set(d.id, fromDoc(d.id, d.data()));
  }
  return [...seen.values()]
    .sort((a, b) => a.payerName.localeCompare(b.payerName) || a.planName.localeCompare(b.planName))
    .slice(0, max);
}

export async function createManualPlan(input: {
  payerName: string;
  planName: string;
  planType?: string;
  state?: string;
}): Promise<InsurancePlan> {
  const data = {
    payerName: input.payerName,
    planName: input.planName,
    planType: input.planType ?? null,
    state: input.state ?? null,
    payerNameLower: input.payerName.toLowerCase(),
    planNameLower: input.planName.toLowerCase(),
    dataSource: "MANUAL" as const,
  };
  const ref = await addDoc(col, data);
  return fromDoc(ref.id, data);
}
