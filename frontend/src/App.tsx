import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import QuadroOperacional from './pages/QuadroOperacional';
import ProfissionalPage from './pages/ProfissionalPage';
import AdminPage from './pages/AdminPage';
import GerenciaPage from './pages/GerenciaPage';
import CadastroProfissionalPage from './pages/CadastroProfissionalPage';
import EstoquePage from './pages/EstoquePage';
import MotoristaPage from './pages/MotoristaPage';
import RevisaoPage from './pages/RevisaoPage';
import type { ReactNode } from 'react';
import type { Role } from './types';

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { usuario, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!usuario) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (roles && !roles.includes(usuario.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
      <p className="text-slate-400">Carregando...</p>
    </div>
  );
}

function HomeRedirect() {
  const { usuario, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!usuario) return <Navigate to="/login" replace />;

  switch (usuario.role) {
    case 'ADMINISTRADOR':
      return <Navigate to="/admin" replace />;
    case 'GERENCIA':
      return <Navigate to="/gerencia" replace />;
    case 'PROFISSIONAL':
      return <Navigate to="/profissional" replace />;
    case 'ESTOQUE':
      return <Navigate to="/estoque" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<CadastroProfissionalPage />} />
          <Route path="/motorista" element={<MotoristaPage />} />
          <Route path="/revisao" element={<RevisaoPage />} />
          <Route path="/quadro" element={<QuadroOperacional />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['ADMINISTRADOR']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gerencia"
            element={
              <ProtectedRoute roles={['GERENCIA']}>
                <GerenciaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profissional"
            element={
              <ProtectedRoute roles={['PROFISSIONAL']}>
                <ProfissionalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estoque"
            element={
              <ProtectedRoute roles={['ESTOQUE']}>
                <EstoquePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
