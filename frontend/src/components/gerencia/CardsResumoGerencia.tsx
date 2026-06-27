import type { DashboardGerencia } from '../../lib/api';

function CardResumo({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string | number;
  detalhe?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wide">{titulo}</p>
      <p className="text-2xl font-bold text-white mt-1 tabular-nums">{valor}</p>
      {detalhe ? <p className="text-slate-500 text-xs mt-1">{detalhe}</p> : null}
    </div>
  );
}

export function CardsResumoGerencia({ resumo }: { resumo: DashboardGerencia['resumo'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <CardResumo titulo="Veículos no quadro" valor={resumo.veiculosNoQuadro} />
      <CardResumo titulo="Serviços abertos" valor={resumo.servicosAbertos} />
      <CardResumo titulo="Criados no período" valor={resumo.servicosCriadosPeriodo} />
      <CardResumo titulo="Encerrados no período" valor={resumo.servicosEncerradosPeriodo} />
      <CardResumo titulo="Tempo médio" valor={`${resumo.tempoMedioMin} min`} />
      <CardResumo titulo="Peças solicitadas" valor={resumo.pecasSolicitadas} />
      <CardResumo titulo="Peças atendidas" valor={resumo.pecasAtendidas} />
    </div>
  );
}

export function RodapeExclusoesGerencia({ exclusoes }: { exclusoes: string[] }) {
  return (
    <p className="text-slate-500 text-xs">
      Métricas excluem exclusões de veículo por erro de cadastro ({exclusoes.join(', ')}).
    </p>
  );
}
