import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import {
  esquecerAba,
  guardarConta,
  listarContas,
  removerConta,
  tokenDaAba,
  tokenDaConta,
  usarTokenNaAba,
} from '../lib/sessoes';
import { SETOR_LABELS, type Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  contas: Usuario[];
  loading: boolean;
  login: (matricula: string, senha: string) => Promise<void>;
  entrarComo: (usuarioId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function tituloDaAba(usuario: Usuario | null): string {
  if (!usuario?.nome) return 'Quadro Operacional Digital';
  const setor = usuario.setor
    ? SETOR_LABELS[usuario.setor]
    : usuario.especialidade?.trim().toUpperCase() === 'ENCARREGADO'
      ? 'Encarregado'
      : usuario.especialidade?.trim();
  return setor ? `${usuario.nome} · ${setor}` : usuario.nome;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [contas, setContas] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const atualizarContas = () => setContas(listarContas());

  useEffect(() => {
    document.title = tituloDaAba(usuario);
  }, [usuario]);

  useEffect(() => {
    atualizarContas();
    const token = tokenDaAba();
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
        if (!ativo) return;
        guardarConta(token, u);
        setUsuario(u);
        atualizarContas();
      })
      .catch(() => {
        esquecerAba();
        if (ativo) {
          setUsuario(null);
          atualizarContas();
        }
      })
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
    guardarConta(token, u);
    setUsuario(u);
    atualizarContas();
  };

  const entrarComo = async (usuarioId: string) => {
    const token = tokenDaConta(usuarioId);
    if (!token) throw new Error('Conta não encontrada neste navegador');

    const anterior = tokenDaAba();
    usarTokenNaAba(token);
    try {
      const u = await api.me();
      guardarConta(token, u);
      setUsuario(u);
      atualizarContas();
    } catch (err) {
      if (anterior && anterior !== token) usarTokenNaAba(anterior);
      else esquecerAba();
      removerConta(usuarioId);
      atualizarContas();
      throw err instanceof Error ? err : new Error('Não foi possível entrar nesta conta');
    }
  };

  const logout = () => {
    esquecerAba();
    setUsuario(null);
    atualizarContas();
  };

  return (
    <AuthContext.Provider value={{ usuario, contas, loading, login, entrarComo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
