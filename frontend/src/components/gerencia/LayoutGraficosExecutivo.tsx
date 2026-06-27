import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardGerencia } from '../../lib/api';
import {
  ESTILO_TOOLTIP,
  PALETA_GRAFICOS,
  corSetor,
  corStatus,
  dadosGraficoPizza,
} from '../../lib/gerenciaGraficos';
import { CardsResumoGerencia, RodapeExclusoesGerencia } from './CardsResumoGerencia';

function PainelGrafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
      <h3 className="text-sm font-bold text-white mb-4">{titulo}</h3>
      <div className="h-64">{children}</div>
    </section>
  );
}

export function LayoutGraficosExecutivo({ dados }: { dados: DashboardGerencia }) {
  const pizzaStatus = dadosGraficoPizza(
    dados.quadroPorStatus.map((s) => ({ rotulo: s.rotulo, total: s.total, chave: s.status })),
    corStatus,
  );
  const pizzaSetor = dadosGraficoPizza(
    dados.servicosPorSetor.map((s) => ({ rotulo: s.setor, total: s.total, chave: s.setor })),
    corSetor,
  );
  const pizzaEventos = dadosGraficoPizza(
    dados.eventosPorAcao.map((e) => ({ rotulo: e.rotulo, total: e.total })),
    (_, i) => PALETA_GRAFICOS[i % PALETA_GRAFICOS.length],
  );
  const barrasProf = dados.produtividade
    .filter((p) => p.total > 0)
    .map((p) => ({
      nome: p.profissional?.nome?.split(' ')[0] ?? '—',
      total: p.total,
    }));

  return (
    <div className="space-y-6">
      <CardsResumoGerencia resumo={dados.resumo} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PainelGrafico titulo="Quadro atual — distribuição por status (rosca)">
          {pizzaStatus.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pizzaStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pizzaStatus.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="#1e293b" />
                  ))}
                </Pie>
                <Tooltip {...ESTILO_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>

        <PainelGrafico titulo={`Serviços por setor — pizza (${dados.periodoDias} dias)`}>
          {pizzaSetor.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pizzaSetor}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label={({ name, percent }) =>
                    percent && percent > 0.06 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {pizzaSetor.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="#1e293b" />
                  ))}
                </Pie>
                <Tooltip {...ESTILO_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>

        <PainelGrafico titulo="Eventos no período — participação (%)">
          {pizzaEventos.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pizzaEventos}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={88}
                >
                  {pizzaEventos.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="#1e293b" />
                  ))}
                </Pie>
                <Tooltip {...ESTILO_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </PainelGrafico>
      </div>

      <PainelGrafico titulo="Produtividade — barras horizontais por profissional">
        {barrasProf.length === 0 ? (
          <p className="text-slate-500 text-sm">Sem dados no período</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barrasProf} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="nome"
                width={72}
                stroke="#64748b"
                tick={{ fill: '#e2e8f0', fontSize: 11 }}
              />
              <Tooltip {...ESTILO_TOOLTIP} />
              <Bar dataKey="total" name="Serviços" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </PainelGrafico>

      <RodapeExclusoesGerencia exclusoes={dados.exclusoesAplicadas} />
    </div>
  );
}
