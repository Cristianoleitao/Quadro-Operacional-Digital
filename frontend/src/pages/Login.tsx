import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeaderPublico } from '../components/HeaderPublico';

export default function Login() {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, entrarComo, contas } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const aviso =
    typeof location.state === 'object' &&
    location.state &&
    'aviso' in location.state &&
    typeof (location.state as { aviso?: unknown }).aviso === 'string'
      ? (location.state as { aviso: string }).aviso
      : '';

  const continuar = async (usuarioId: string, nome: string) => {
    setErro('');
    setLoading(true);
    try {
      await entrarComo(usuarioId);
      navigate(redirect && redirect.startsWith('/') ? redirect : '/', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : `Não foi possível entrar como ${nome}`);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="flex min-h-[100dvh] flex-col bg-slate-900">
      <HeaderPublico />

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:p-8"
          >
            {aviso && (
              <div className="mb-4 rounded border border-emerald-600 bg-emerald-900/40 p-3 text-sm text-emerald-200">
                {aviso}
              </div>
            )}
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

            <p className="mt-4 text-xs text-slate-400">
              Entrar com outra matrícula não encerra as contas já abertas em outras abas.
            </p>

            {contas.some((conta) => conta.role === 'PROFISSIONAL') && (
              <div className="mt-4 border-t border-slate-700 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Contas neste navegador
                </p>
                <div className="mt-2 space-y-2">
                  {contas.filter((conta) => conta.role === 'PROFISSIONAL').map((conta) => (
                    <button
                      key={conta.id}
                      type="button"
                      disabled={loading}
                      onClick={() => void continuar(conta.id, conta.nome)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-left text-sm text-white hover:border-blue-500 disabled:opacity-50"
                    >
                      <span className="font-semibold">{conta.nome}</span>
                      <span className="font-mono text-xs text-slate-400">{conta.matricula}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
