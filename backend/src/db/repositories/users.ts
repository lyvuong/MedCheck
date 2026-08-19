import { usersCol } from "../collections.js";
import type { User, UserRole } from "../collections.js";
import { toDate } from "./util.js";

function docId(email: string): string {
  return email.trim().toLowerCase();
}

function fromDoc(id: string, data: FirebaseFirestore.DocumentData): User {
  return {
    id,
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.name,
    role: data.role,
    npi: data.npi ?? null,
    active: data.active,
    createdAt: toDate(data.createdAt),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const snap = await usersCol.doc(docId(email)).get();
  if (!snap.exists) return null;
  return fromDoc(snap.id, snap.data()!);
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  npi?: string;
}): Promise<User> {
  const id = docId(input.email);
  const now = new Date();
  const data = {
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name,
    role: input.role,
    npi: input.npi ?? null,
    active: true,
    createdAt: now,
  };
  try {
    // create() fails atomically server-side if the doc already exists —
    // the Firestore equivalent of the `.unique()` constraint on email.
    await usersCol.doc(id).create(data);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: unknown }).code === 6) {
      throw new Error("EMAIL_TAKEN");
    }
    throw err;
  }
  return fromDoc(id, data);
}

export async function listUsers(): Promise<User[]> {
  const snap = await usersCol.orderBy("createdAt").get();
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function setUserActive(id: string, active: boolean): Promise<User> {
  const ref = usersCol.doc(id);
  await ref.update({ active });
  const snap = await ref.get();
  return fromDoc(snap.id, snap.data()!);
}

export async function countUsers(): Promise<number> {
  const agg = await usersCol.count().get();
  return agg.data().count;
}
