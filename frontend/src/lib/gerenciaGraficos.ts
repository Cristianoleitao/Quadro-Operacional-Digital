import type { DashboardGerencia } from './api';

export type LayoutGraficosGerencia = 'barras' | 'executivo' | 'tendencias';

export const LAYOUT_GRAFICOS_KEY = 'gerencia-layout-graficos';

export const OPCOES_LAYOUT_GRAFICOS: Array<{
  id: LayoutGraficosGerencia;
  titulo: string;
  descricao: string;
}> = [
  {
    id: 'barras',
    titulo: 'Barras',
    descricao: 'Barras horizontais — visão operacional direta',
  },
  {
    id: 'executivo',
    titulo: 'Executivo',
    descricao: 'Pizza e rosca — distribuição e proporções (estilo BI)',
  },
  {
    id: 'tendencias',
    titulo: 'Tendências',
    descricao: 'Linha e área — evolução no tempo (estilo analytics)',
  },
];

export const CORES_SETOR: Record<string, string> = {
  MEC: '#f97316',
  BORR: '#f97316',
  ELE: '#2563eb',
  REFR: '#dc2626',
  LANT: '#16a34a',
  PINT: '#16a34a',
  LIMP: '#9333ea',
  OUTRO: '#64748b',
};

export const CORES_STATUS: Record<string, string> = {
  EM_EXECUCAO: '#e2e8f0',
  PARADO_CRITICO: '#ef4444',
  AGUARDANDO_INSUMO: '#eab308',
  SERVICO_EXTERNO: '#22c55e',
  SERVICO_DEMORADO: '#a78bfa',
  MANUTENCAO_PREVENTIVA: '#38bdf8',
};

export const PALETA_GRAFICOS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

export const ESTILO_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#0f172a',
    border: '1px solid #475569',
    borderRadius: '8px',
    fontSize: '12px',
  },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#cbd5e1' },
};

export function corSetor(chave: string, indice: number): string {
  return CORES_SETOR[chave] ?? PALETA_GRAFICOS[indice % PALETA_GRAFICOS.length];
}

export function corStatus(chave: string, indice: number): string {
  return CORES_STATUS[chave] ?? PALETA_GRAFICOS[indice % PALETA_GRAFICOS.length];
}

export function dadosGraficoPizza(
  itens: Array<{ rotulo: string; total: number; chave?: string }>,
  corFn: (chave: string, i: number) => string,
) {
  return itens
    .filter((i) => i.total > 0)
    .map((item, indice) => ({
      name: item.rotulo,
      value: item.total,
      fill: item.chave ? corFn(item.chave, indice) : PALETA_GRAFICOS[indice % PALETA_GRAFICOS.length],
    }));
}

export function dadosGraficoLinha(pontos: DashboardGerencia['atividadePorDia']) {
  return pontos.slice(-30).map((p) => ({
    dia: `${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)}`,
    eventos: p.total,
    diaCompleto: p.dia,
  }));
}

export function lerLayoutSalvo(): LayoutGraficosGerencia {
  const salvo = localStorage.getItem(LAYOUT_GRAFICOS_KEY);
  if (salvo === 'executivo' || salvo === 'tendencias' || salvo === 'barras') {
    return salvo;
  }
  return 'barras';
}

export function salvarLayout(layout: LayoutGraficosGerencia) {
  localStorage.setItem(LAYOUT_GRAFICOS_KEY, layout);
}
