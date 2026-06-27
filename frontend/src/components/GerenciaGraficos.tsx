import type { DashboardGerencia } from '../lib/api';
import type { LayoutGraficosGerencia } from '../lib/gerenciaGraficos';
import { LayoutGraficosBarras } from './gerencia/LayoutGraficosBarras';
import { LayoutGraficosExecutivo } from './gerencia/LayoutGraficosExecutivo';
import { LayoutGraficosTendencias } from './gerencia/LayoutGraficosTendencias';

export function GerenciaGraficos({
  dados,
  layout,
}: {
  dados: DashboardGerencia;
  layout: LayoutGraficosGerencia;
}) {
  switch (layout) {
    case 'executivo':
      return <LayoutGraficosExecutivo dados={dados} />;
    case 'tendencias':
      return <LayoutGraficosTendencias dados={dados} />;
    default:
      return <LayoutGraficosBarras dados={dados} />;
  }
}
