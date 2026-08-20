import { Timestamp } from "firebase-admin/firestore";

export function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value as string);
}

// Firestore's `in` operator accepts at most 30 values per query.
export const IN_QUERY_CHUNK_SIZE = 30;

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
