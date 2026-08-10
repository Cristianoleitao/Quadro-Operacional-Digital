import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(matricula, senha);
      navigate(redirect && redirect.startsWith('/') ? redirect : '/', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="shrink-0 border-b border-slate-700 bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-xl">
              Quadro Operacional Digital
            </h1>
            <p className="truncate text-xs text-slate-400 sm:text-sm">
              Oficina de Manutenção de Ônibus
            </p>
          </div>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/cadastro"
              className="rounded-lg border border-emerald-500/50 bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Cadastro
            </Link>
            <Link
              to="/quadro"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Quadro TV
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-2xl"
          >
            {erro && (
              <div className="mb-4 rounded border border-red-600 bg-red-900/50 p-3 text-sm text-red-200">
                {erro}
              </div>
            )}

            <label className="mb-4 block">
              <span className="text-sm font-medium text-slate-300">Matrícula</span>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                placeholder="Ex: MEC001"
                required
              />
            </label>

            <label className="mb-6 block">
              <span className="text-sm font-medium text-slate-300">Senha</span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
