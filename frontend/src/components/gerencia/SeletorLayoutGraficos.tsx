import {
  OPCOES_LAYOUT_GRAFICOS,
  salvarLayout,
  type LayoutGraficosGerencia,
} from '../../lib/gerenciaGraficos';

export function SeletorLayoutGraficos({
  layout,
  onChange,
}: {
  layout: LayoutGraficosGerencia;
  onChange: (layout: LayoutGraficosGerencia) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Layout dos gráficos</p>
      <div className="flex flex-wrap gap-2">
        {OPCOES_LAYOUT_GRAFICOS.map((opcao) => {
          const ativo = layout === opcao.id;
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => {
                salvarLayout(opcao.id);
                onChange(opcao.id);
              }}
              className={`rounded-lg border px-3 py-2 text-left transition min-w-[9.5rem] ${
                ativo
                  ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/50'
                  : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
              }`}
            >
              <span className={`block text-sm font-semibold ${ativo ? 'text-blue-300' : 'text-white'}`}>
                {opcao.titulo}
              </span>
              <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">{opcao.descricao}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
