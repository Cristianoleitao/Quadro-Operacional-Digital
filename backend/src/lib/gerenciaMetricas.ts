import { Prisma, StatusServico } from '@prisma/client';

/** Ações ignoradas nos gráficos (ex.: exclusão por erro de digitação / carro errado). */
export const ACOES_EXCLUIDAS_GERENCIA = ['EXCLUIR_VEICULO'] as const;

export const ROTULOS_ACAO_GERENCIA: Record<string, string> = {
  ASSUMIR: 'Serviços assumidos',
  FINALIZAR: 'Serviços finalizados',
  FINALIZAR_VEICULO: 'Veículos encerrados (ADM)',
  ATUALIZAR_STATUS: 'Mudanças de status',
  SOLICITAR_INSUMO: 'Solicitações de peça',
  ATENDER_INSUMO: 'Peças atendidas',
  ATRIBUIR_PROFISSIONAL: 'Profissionais atribuídos',
  CRIAR: 'Cadastros',
  ATUALIZAR_DADOS_TERCEIROS: 'Atualização OS/hora',
  ATUALIZAR_LOCAL_EXTERNO: 'Local externo',
  LOGIN: 'Logins',
};

export const ROTULOS_STATUS_GERENCIA: Record<string, string> = {
  EM_EXECUCAO: 'Corretiva',
  PARADO_CRITICO: 'Parado crítico',
  AGUARDANDO_INSUMO: 'Aguardando peça',
  SERVICO_EXTERNO: 'Serviço externo',
  SERVICO_DEMORADO: 'Serviço demorado',
  MANUTENCAO_PREVENTIVA: 'Preventiva',
  FINALIZADO: 'Finalizado',
  CONCLUIDO: 'Concluído (ADM)',
};

export function inicioPeriodo(dias: number): Date {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  desde.setHours(0, 0, 0, 0);
  return desde;
}

export function chaveDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function filtroGaragemServico(garagemId?: string): Prisma.ServicoWhereInput {
  return garagemId ? { veiculo: { garagemId } } : {};
}

export const STATUS_ENCERRADOS: StatusServico[] = [
  StatusServico.FINALIZADO,
  StatusServico.CONCLUIDO,
];

export function parseDataFiltroInicio(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date(isoDate);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function parseDataFiltroFim(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date(isoDate);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Filtro de período para histórico: dia único, intervalo ou últimos N dias. */
export function filtroCreatedAtHistorico(query: {
  dataInicio?: string;
  dataFim?: string;
  dataDia?: string;
  dias?: string | number;
}): { gte?: Date; lte?: Date } | undefined {
  if (query.dataDia) {
    return {
      gte: parseDataFiltroInicio(query.dataDia),
      lte: parseDataFiltroFim(query.dataDia),
    };
  }

  const inicio = query.dataInicio;
  const fim = query.dataFim;

  if (inicio && fim && inicio === fim) {
    return {
      gte: parseDataFiltroInicio(inicio),
      lte: parseDataFiltroFim(inicio),
    };
  }

  if (inicio && !fim) {
    return {
      gte: parseDataFiltroInicio(inicio),
      lte: parseDataFiltroFim(inicio),
    };
  }

  if (!inicio && fim) {
    return {
      gte: parseDataFiltroInicio(fim),
      lte: parseDataFiltroFim(fim),
    };
  }

  const filtro: { gte?: Date; lte?: Date } = {};

  if (inicio) filtro.gte = parseDataFiltroInicio(inicio);
  else if (query.dias != null && query.dias !== '') {
    const n = Math.min(90, Math.max(7, parseInt(String(query.dias), 10) || 30));
    filtro.gte = inicioPeriodo(n);
  }

  if (fim) filtro.lte = parseDataFiltroFim(fim);

  return filtro.gte || filtro.lte ? filtro : undefined;
}
