import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import { getUserRoleDoc } from "./data/users";
import type { AuthedUser } from "./data/types";

// Mirrors the owner allow-list hardcoded in firestore.rules — keep these
// two in sync. Either address always has full admin access with no
// Firestore `users/{email}` doc required.
const OWNER_EMAILS = ["lyvuong@gmail.com", "lyvuong@lv5.org"];

interface AuthState {
  user: AuthedUser | null;
  loading: boolean;
  // Signed in to Google, but no active users/{email} role doc exists yet.
  noAccess: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

async function resolveUser(fbUser: FirebaseUser): Promise<AuthedUser | null> {
  const email = fbUser.email;
  if (!email) return null;
  if (OWNER_EMAILS.includes(email)) {
    return { id: email, email, role: "ADMIN", name: fbUser.displayName ?? email };
  }
  const roleDoc = await getUserRoleDoc(email);
  if (!roleDoc || !roleDoc.active) return null;
  return { id: email, email, role: roleDoc.role, name: roleDoc.name ?? fbUser.displayName ?? email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      if (!fbUser) {
        setUser(null);
        setNoAccess(false);
        setLoading(false);
        return;
      }
      try {
        const resolved = await resolveUser(fbUser);
        setUser(resolved);
        setNoAccess(resolved === null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function login() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  function logout() {
    void signOut(auth);
  }

  return <AuthContext.Provider value={{ user, loading, noAccess, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
