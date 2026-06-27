import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  login: (matricula: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    let ativo = true;
    const timeout = window.setTimeout(() => {
      if (ativo) setLoading(false);
    }, 8000);

    api.me()
      .then((u) => {
        if (ativo) setUsuario(u);
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => {
        if (ativo) {
          window.clearTimeout(timeout);
          setLoading(false);
        }
      });

    return () => {
      ativo = false;
      window.clearTimeout(timeout);
    };
  }, []);

  const login = async (matricula: string, senha: string) => {
    const { token, usuario: u } = await api.login(matricula, senha);
    localStorage.setItem('token', token);
    setUsuario(u);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
