import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">اقرأ</span>
          <span className="brand-sub">التعرف على القارئ والآية</span>
        </Link>

        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            التحليل
          </NavLink>
          {admin && (
            <NavLink
              to="/admin/speakers"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              إدارة القرّاء
            </NavLink>
          )}
          {admin ? (
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              خروج
            </button>
          ) : (
            <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>
              دخول المشرف
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
