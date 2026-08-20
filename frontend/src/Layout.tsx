import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ThemeToggle } from "./ThemeToggle";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="MedCheck Logo" className="brand-logo" />
          <span>MedCheck</span>
        </Link>
        <nav>
          <Link to="/">Lookup</Link>
          <Link to="/about">About</Link>
          {(user?.role === "ADMIN" || user?.role === "STAFF") && <Link to="/admin">Admin</Link>}
        </nav>
        <div className="user-chip">
          <ThemeToggle />
          <div className="user-profile-badge">
            <span>{user?.name || user?.email}</span>
            {user?.role && <span className="user-role-tag">{user.role}</span>}
          </div>
          <button
            className="link-button"
            style={{ fontSize: "0.85rem" }}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
