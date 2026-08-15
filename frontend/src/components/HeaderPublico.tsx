import { Link, useLocation } from 'react-router-dom';
import { BotaoVoltarLogin } from './BotaoVoltarLogin';

export function HeaderPublico() {
  const { pathname } = useLocation();
  const ehLogin = pathname === '/login';

  return (
    <header className="shrink-0 border-b border-slate-700 bg-slate-950/80">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-xl">
            Quadro Operacional Digital
          </h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">
            Oficina de Manutenção de Ônibus
          </p>
        </div>
        <nav className="flex flex-wrap shrink-0 items-center gap-2">
          <Link
            to="/revisao"
            className="rounded-lg border border-violet-500/50 bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-600"
          >
            Revisão
          </Link>
          <Link
            to="/motorista"
            className="rounded-lg border border-sky-500/50 bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-600"
          >
            Motorista
          </Link>
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
          {!ehLogin ? <BotaoVoltarLogin className="py-1.5" /> : null}
        </nav>
      </div>
    </header>
  );
}
