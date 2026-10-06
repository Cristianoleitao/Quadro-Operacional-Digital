export function abrirOutraConta() {
  const aba = window.open('/login', '_blank', 'noopener');
  if (!aba) window.location.assign('/login');
}

export function BotaoOutraConta({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={abrirOutraConta}
      className={className ?? 'text-sm text-slate-300 hover:text-white'}
    >
      Outra conta
    </button>
  );
}
