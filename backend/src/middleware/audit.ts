import { Prisma } from '@prisma/client';
import { AuthRequest } from '../types';
import { prisma } from '../lib/prisma';

export async function auditLog(
  req: AuthRequest,
  acao: string,
  entidade: string,
  entidadeId?: string,
  detalhes?: Prisma.InputJsonValue
) {
  await prisma.auditoria.create({
    data: {
      usuarioId: req.user?.id,
      acao,
      entidade,
      entidadeId,
      detalhes: detalhes ?? undefined,
    },
  });
}
