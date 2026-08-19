import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          MedCheck
        </Link>
        <nav>
          {(user?.role === "ADMIN" || user?.role === "STAFF") && <Link to="/admin">Admin</Link>}
        </nav>
        <div className="user-chip">
          <span>{user?.name}</span>
          <button
            className="link-button"
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
