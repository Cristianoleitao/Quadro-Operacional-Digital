import { StatusServico } from '@prisma/client';
import { prisma } from './prisma';

type ServicoComVeiculo = {
  veiculoId: string;
  veiculo: Record<string, unknown>;
};

/** Anexa flags de veículo usadas no quadro e na tela do profissional (prazo 2h). */
export async function enriquecerVeiculosLista<T extends ServicoComVeiculo>(
  servicos: T[],
): Promise<T[]> {
  if (servicos.length === 0) return servicos;

  const veiculoIds = [...new Set(servicos.map((s) => s.veiculoId))];

  const [finalizados, comAtendimento] = await Promise.all([
    prisma.servico.groupBy({
      by: ['veiculoId'],
      where: {
        veiculoId: { in: veiculoIds },
        status: { in: [StatusServico.FINALIZADO, StatusServico.CONCLUIDO] },
      },
    }),
    prisma.servico.findMany({
      where: {
        veiculoId: { in: veiculoIds },
        OR: [
          { profissionalId: { not: null } },
          { horaAssumido: { not: null } },
          { horaInicio: { not: null } },
          { insumos: { some: { aguardarPeca: true } } },
        ],
      },
      select: { veiculoId: true },
      distinct: ['veiculoId'],
    }),
  ]);

  const execSet = new Set(finalizados.map((f) => f.veiculoId));
  const iniciadoSet = new Set(comAtendimento.map((c) => c.veiculoId));

  return servicos.map((s) => ({
    ...s,
    veiculo: {
      ...s.veiculo,
      temServicoExecutado: execSet.has(s.veiculoId),
      atendimentoIniciado: iniciadoSet.has(s.veiculoId),
    },
  }));
}
