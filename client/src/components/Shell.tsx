import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id="encurta-logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b48cff" />
            <stop offset="1" stopColor="#7a3cf5" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#encurta-logo-grad)" />
        <path
          d="M13 19l6-6M11.5 15.5l-1.8 1.8a3.5 3.5 0 0 0 5 5l1.8-1.8M20.5 16.5l1.8-1.8a3.5 3.5 0 0 0-5-5l-1.8 1.8"
          stroke="#fff"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      Encurta
    </span>
  );
}

export function Shell() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/"><Logo /></Link>
        <div className="topbar__user">
          <span className="muted">{user?.name}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>Sair</button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
