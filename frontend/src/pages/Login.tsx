import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ThemeToggle } from "../ThemeToggle";

export function Login() {
  const { user, noAccess, login, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  async function onClick() {
    setError(null);
    setSubmitting(true);
    try {
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (noAccess) {
    return (
      <div className="centered-page">
        <ThemeToggle />
        <div className="card login-card">
          <h1>MedCheck</h1>
          <p className="subtitle">You're signed in, but don't have access yet.</p>
          <p className="muted">Ask the admin to grant your account access, then try again.</p>
          <button className="link-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-page">
      <ThemeToggle />
      <div className="card login-card">
        <h1>MedCheck</h1>
        <p className="subtitle">Medication coverage lookup</p>
        {error && <div className="error">{error}</div>}
        <button onClick={onClick} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
