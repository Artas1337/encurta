import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Shell } from './components/Shell';
import { AuthPage } from './pages/AuthPage';
import { LinksPage } from './pages/LinksPage';
import { LinkStatsPage } from './pages/LinkStatsPage';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">Carregando…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">Carregando…</div>;
  return user ? <Navigate to="/" replace /> : children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthPage /></GuestOnly>} />
          <Route element={<Protected><Shell /></Protected>}>
            <Route index element={<LinksPage />} />
            <Route path="links/:id" element={<LinkStatsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
