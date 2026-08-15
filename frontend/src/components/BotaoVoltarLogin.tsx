import { Link } from 'react-router-dom';

export function BotaoVoltarLogin({
  className = '',
}: {
  className?: string;
}) {
  return (
    <Link
      to="/login"
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-500 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-slate-400 hover:bg-slate-700 ${className}`.trim()}
    >
      <span aria-hidden className="text-base leading-none">←</span>
      Voltar ao login
    </Link>
  );
}
