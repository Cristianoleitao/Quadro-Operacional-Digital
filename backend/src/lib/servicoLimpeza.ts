/**
 * Serviço automático de limpeza de veículo — DESATIVADO.
 * Para reativar: descomente este arquivo e as chamadas em
 * backend/src/routes/servicos.ts e backend/src/routes/veiculos.ts
 */

/*
import { Setor, StatusServico } from '@prisma/client';
import { prisma } from './prisma';

export const SETOR_LIMPEZA = Setor.LIMP;
export const DESCRICAO_LIMPEZA_VEICULO = 'LIMPEZA DE VEICULO';

const STATUS_LIMPEZA_ENCERRADA: StatusServico[] = [
  StatusServico.FINALIZADO,
  StatusServico.CONCLUIDO,
];

// Garante serviço de limpeza ativo no veículo (sem duplicar).
export async function garantirServicoLimpezaVeiculo(veiculoId: string) {
  const existente = await prisma.servico.findFirst({
    where: {
      veiculoId,
      setor: SETOR_LIMPEZA,
      descricao: DESCRICAO_LIMPEZA_VEICULO,
      status: { notIn: STATUS_LIMPEZA_ENCERRADA },
    },
  });
  if (existente) return existente;

  return prisma.servico.create({
    data: {
      veiculoId,
      setor: SETOR_LIMPEZA,
      descricao: DESCRICAO_LIMPEZA_VEICULO,
      status: StatusServico.EM_EXECUCAO,
    },
  });
}
*/
