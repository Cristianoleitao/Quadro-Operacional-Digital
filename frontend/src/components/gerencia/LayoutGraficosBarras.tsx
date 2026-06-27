import type { DashboardGerencia } from '../../lib/api';
import { CORES_SETOR } from '../../lib/gerenciaGraficos';
import { CardsResumoGerencia, RodapeExclusoesGerencia } from './CardsResumoGerencia';

function GraficoBarras({
  titulo,
  itens,
  corPadrao = '#3b82f6',
  corItem,
}: {
  titulo: string;
  itens: Array<{ rotulo: string; total: number; chave?: string }>;
  corPadrao?: string;
  corItem?: (chave: string) => string;
}) {
  const max = Math.max(...itens.map((i) => i.total), 1);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
      <h3 className="text-sm font-bold text-white mb-4">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-slate-500 text-sm">Sem dados no período</p>
      ) : (
        <div className="space-y-3">
          {itens.map((item) => {
            const cor = (item.chave && corItem?.(item.chave)) || corPadrao;
            return (
              <div key={item.rotulo}>
                <div className="flex justify-between text-xs text-slate-300 mb-1 gap-2">
                  <span className="truncate">{item.rotulo}</span>
                  <span className="font-bold tabular-nums shrink-0">{item.total}</span>
                </div>
                <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(item.total / max) * 100}%`, backgroundColor: cor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GraficoColunasAtividade({
  titulo,
  pontos,
}: {
  titulo: string;
  pontos: Array<{ dia: string; total: number }>;
}) {
  const max = Math.max(...pontos.map((p) => p.total), 1);
  const ultimos = pontos.slice(-14);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 lg:col-span-2">
      <h3 className="text-sm font-bold text-white mb-4">{titulo}</h3>
      <div className="flex items-end gap-1 h-36">
        {ultimos.map((p) => (
          <div key={p.dia} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-slate-400 tabular-nums">{p.total || ''}</span>
            <div
              className="w-full bg-blue-500 rounded-t min-h-[2px]"
              style={{ height: `${Math.max(4, (p.total / max) * 100)}%` }}
              title={`${p.dia}: ${p.total} eventos`}
            />
            <span className="text-[9px] text-slate-500 truncate w-full text-center">
              {p.dia.slice(8, 10)}/{p.dia.slice(5, 7)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LayoutGraficosBarras({ dados }: { dados: DashboardGerencia }) {
  return (
    <div className="space-y-6">
      <CardsResumoGerencia resumo={dados.resumo} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficoBarras
          titulo="Quadro atual — serviços por status"
          itens={dados.quadroPorStatus.map((s) => ({ rotulo: s.rotulo, total: s.total, chave: s.status }))}
          corPadrao="#eab308"
        />
        <GraficoBarras
          titulo={`Serviços cadastrados por setor (${dados.periodoDias} dias)`}
          itens={dados.servicosPorSetor.map((s) => ({ rotulo: s.setor, total: s.total, chave: s.setor }))}
          corItem={(chave) => CORES_SETOR[chave] ?? '#3b82f6'}
        />
        <GraficoColunasAtividade
          titulo={`Atividade operacional por dia (${dados.periodoDias} dias)`}
          pontos={dados.atividadePorDia}
        />
        <GraficoBarras
          titulo="Eventos no período (auditoria)"
          itens={dados.eventosPorAcao.map((e) => ({ rotulo: e.rotulo, total: e.total }))}
          corPadrao="#8b5cf6"
        />
        <GraficoBarras
          titulo="Produtividade — serviços encerrados por profissional"
          itens={dados.produtividade.map((p) => ({
            rotulo: p.profissional?.nome ?? '—',
            total: p.total,
          }))}
          corPadrao="#10b981"
        />
      </div>
      <RodapeExclusoesGerencia exclusoes={dados.exclusoesAplicadas} />
    </div>
  );
}
