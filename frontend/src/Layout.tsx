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
      <footer className="app-footer">
        <div className="footer-content">
          <span className="copyright-text">
            © {new Date().getFullYear()} MedCheck · Created by Ly Vuong · MIT License
          </span>
          <Link to="/about" className="footer-info-link" title="About MedCheck & System Information">
            <svg className="footer-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>About & Info</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
