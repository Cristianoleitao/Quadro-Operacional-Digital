import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardGerencia } from '../../lib/api';
import { ESTILO_TOOLTIP, corSetor, dadosGraficoLinha } from '../../lib/gerenciaGraficos';
import { CardsResumoGerencia, RodapeExclusoesGerencia } from './CardsResumoGerencia';

function PainelGrafico({
  titulo,
  altura = 'h-72',
  children,
}: {
  titulo: string;
  altura?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
      <h3 className="text-sm font-bold text-white mb-4">{titulo}</h3>
      <div className={altura}>{children}</div>
    </section>
  );
}

export function LayoutGraficosTendencias({ dados }: { dados: DashboardGerencia }) {
  const linhaAtividade = dadosGraficoLinha(dados.atividadePorDia);
  const barrasSetor = dados.servicosPorSetor.map((s, i) => ({
    setor: s.setor,
    total: s.total,
    fill: corSetor(s.setor, i),
  }));
  const barrasStatus = dados.quadroPorStatus.map((s) => ({
    status: s.rotulo,
    total: s.total,
  }));
  const comparativoPecas = [
    { tipo: 'Solicitadas', qtd: dados.resumo.pecasSolicitadas },
    { tipo: 'Atendidas', qtd: dados.resumo.pecasAtendidas },
    { tipo: 'Encerrados', qtd: dados.resumo.servicosEncerradosPeriodo },
    { tipo: 'Criados', qtd: dados.resumo.servicosCriadosPeriodo },
  ];

  return (
    <div className="space-y-6">
      <CardsResumoGerencia resumo={dados.resumo} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PainelGrafico titulo={`Atividade operacional — linha (${dados.periodoDias} dias)`} altura="h-80">
          {linhaAtividade.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={linhaAtividade} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="dia"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  {...ESTILO_TOOLTIP}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.diaCompleto
                      ? new Date(`${payload[0].payload.diaCompleto}T12:00:00`).toLocaleDateString('pt-BR')
                      : ''
                  }
                />
                <Line
                  type="monotone"
                  dataKey="eventos"
                  name="Eventos"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>

        <PainelGrafico titulo={`Volume de eventos — área (${dados.periodoDias} dias)`} altura="h-80">
          {linhaAtividade.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={linhaAtividade} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="corAreaEventos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="dia"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...ESTILO_TOOLTIP} />
                <Area
                  type="monotone"
                  dataKey="eventos"
                  name="Eventos"
                  stroke="#8b5cf6"
                  fill="url(#corAreaEventos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PainelGrafico titulo="Comparativo do período — colunas agrupadas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparativoPecas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="tipo" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...ESTILO_TOOLTIP} />
              <Bar dataKey="qtd" name="Quantidade" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PainelGrafico>

        <PainelGrafico titulo="Quadro atual — serviços por status (colunas)">
          {barrasStatus.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barrasStatus} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="status"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  angle={-20}
                  textAnchor="end"
                  height={56}
                />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...ESTILO_TOOLTIP} />
                <Bar dataKey="total" name="Serviços" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>

        <PainelGrafico titulo={`Serviços por setor — colunas (${dados.periodoDias} dias)`}>
          {barrasSetor.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barrasSetor} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="setor" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...ESTILO_TOOLTIP} />
                <Bar dataKey="total" name="Serviços" radius={[4, 4, 0, 0]}>
                  {barrasSetor.map((entry) => (
                    <Cell key={entry.setor} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>
      </div>

      <RodapeExclusoesGerencia exclusoes={dados.exclusoesAplicadas} />
    </div>
  );
}
