// A sentinel above any realistic Unicode character, so `field < lower + PREFIX_END`
// matches every string that starts with `lower` — used for prefix-range search
// queries (Firestore has no substring search).
export const PREFIX_END = String.fromCharCode(0xf8ff);

// Firestore's `in` operator accepts at most 30 values per query.
export const IN_QUERY_CHUNK_SIZE = 30;

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
