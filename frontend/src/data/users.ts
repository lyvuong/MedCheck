import { collection, doc, getDoc, getDocs, setDoc, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import type { UserRole, UserRoleDoc } from "./types";

const col = collection(db, "users");

function fromDoc(id: string, data: DocumentData): UserRoleDoc {
  return {
    email: id,
    role: data.role,
    name: data.name ?? null,
    npi: data.npi ?? null,
    active: data.active,
  };
}

export async function getUserRoleDoc(email: string): Promise<UserRoleDoc | null> {
  const snap = await getDoc(doc(col, email));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/** Owner-only per firestore.rules (`allow list: if isOwner()`). */
export async function listUserRoleDocs(): Promise<UserRoleDoc[]> {
  const snap = await getDocs(col);
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function setUserRole(email: string, role: UserRole, name?: string): Promise<void> {
  await setDoc(doc(col, email), { role, name: name ?? null, active: true }, { merge: true });
}

export async function setUserActive(email: string, active: boolean): Promise<void> {
  await setDoc(doc(col, email), { active }, { merge: true });
}
