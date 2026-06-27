import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole } from '../middleware/auth';
import { Role, StatusServico } from '@prisma/client';
import {
  ACOES_EXCLUIDAS_GERENCIA,
  ROTULOS_ACAO_GERENCIA,
  ROTULOS_STATUS_GERENCIA,
  STATUS_ENCERRADOS,
  chaveDia,
  filtroGaragemServico,
  filtroCreatedAtHistorico,
  inicioPeriodo,
} from '../lib/gerenciaMetricas';
const router = Router();

router.use(authMiddleware);
router.use(requireRole(Role.GERENCIA));

router.get('/indicadores', async (_req, res: Response) => {
  const [
    totalServicos,
    servicosFinalizados,
    tempoMedio,
    porProfissional,
    porVeiculo,
    porSetor,
  ] = await Promise.all([
    prisma.servico.count(),
    prisma.servico.count({ where: { status: StatusServico.CONCLUIDO } }),
    prisma.servico.aggregate({
      where: { tempoTotalMin: { not: null } },
      _avg: { tempoTotalMin: true },
    }),
    prisma.servico.groupBy({
      by: ['profissionalId'],
      where: {
        profissionalId: { not: null },
        status: { in: [StatusServico.FINALIZADO, StatusServico.CONCLUIDO] },
      },
      _count: { id: true },
      _avg: { tempoTotalMin: true },
    }),
    prisma.$queryRaw`
      SELECT v.numero, COUNT(s.id)::int as total
      FROM "Servico" s
      JOIN "Veiculo" v ON s."veiculoId" = v.id
      GROUP BY v.numero
      ORDER BY total DESC
      LIMIT 10
    `,
    prisma.servico.groupBy({
      by: ['setor'],
      _count: { id: true },
    }),
  ]);

  const profissionais = await prisma.usuario.findMany({
    where: { role: Role.PROFISSIONAL },
    select: { id: true, nome: true, matricula: true, setor: true },
  });

  const produtividade = porProfissional.map((p) => {
    const prof = profissionais.find((pr) => pr.id === p.profissionalId);
    return {
      profissional: prof,
      totalServicos: p._count.id,
      tempoMedioMin: Math.round(p._avg.tempoTotalMin ?? 0),
    };
  });

  res.json({
    totalServicos,
    servicosFinalizados,
    tempoMedioMin: Math.round(tempoMedio._avg.tempoTotalMin ?? 0),
    produtividade,
    veiculosMaisFalhas: porVeiculo,
    servicosPorSetor: porSetor,
  });
});

router.get('/auditoria', async (req, res: Response) => {
  const { page = '1', limit = '50', dias } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const where: Record<string, unknown> = {
    acao: { notIn: [...ACOES_EXCLUIDAS_GERENCIA] },
  };

  if (dias) {
    const n = Math.min(90, Math.max(7, parseInt(String(dias), 10) || 30));
    where.createdAt = { gte: inicioPeriodo(n) };
  }

  const [registros, total] = await Promise.all([
    prisma.auditoria.findMany({
      where,
      include: {
        usuario: { select: { nome: true, matricula: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.auditoria.count({ where }),
  ]);

  res.json({ registros, total, page: parseInt(page as string) });
});

router.get('/historico', async (req, res: Response) => {
  const { veiculo, setor, status, dataInicio, dataFim, garagemId, dias } = req.query;

  const where: Record<string, unknown> = {};

  if (setor) where.setor = setor;
  if (status) where.status = status;

  const filtroVeiculo: Record<string, unknown> = {};
  if (veiculo) {
    filtroVeiculo.numero = { contains: veiculo as string, mode: 'insensitive' };
  }
  if (typeof garagemId === 'string' && garagemId) {
    filtroVeiculo.garagemId = garagemId;
  }
  if (Object.keys(filtroVeiculo).length > 0) {
    where.veiculo = filtroVeiculo;
  }

  const filtroData = filtroCreatedAtHistorico({
    dataDia: typeof req.query.dataDia === 'string' ? req.query.dataDia : undefined,
    dataInicio: typeof dataInicio === 'string' ? dataInicio : undefined,
    dataFim: typeof dataFim === 'string' ? dataFim : undefined,
    dias: dias as string | number | undefined,
  });
  if (filtroData) where.createdAt = filtroData;

  const servicos = await prisma.servico.findMany({
    where,
    include: {
      veiculo: { include: { garagem: true } },
      ordemServico: {
        include: { veiculo: true },
      },
      profissional: { select: { id: true, nome: true, matricula: true, setor: true } },
      finalizadoPor: { select: { id: true, nome: true, matricula: true } },
      insumos: {
        include: {
          solicitadoPor: { select: { id: true, nome: true, matricula: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  res.json(servicos);
});

router.get('/historico-insumos', async (req, res: Response) => {
  const { garagemId, dias, tipo, status, dataInicio, dataFim, dataDia } = req.query;
  const filtroGaragem = filtroGaragemServico(
    typeof garagemId === 'string' ? garagemId : undefined,
  );

  const where: Record<string, unknown> = {
    servico: filtroGaragem,
  };

  const filtroData = filtroCreatedAtHistorico({
    dataDia: typeof dataDia === 'string' ? dataDia : undefined,
    dataInicio: typeof dataInicio === 'string' ? dataInicio : undefined,
    dataFim: typeof dataFim === 'string' ? dataFim : undefined,
    dias: dias as string | number | undefined,
  });
  if (filtroData) where.createdAt = filtroData;

  if (tipo === 'peca') where.aguardarPeca = true;
  if (tipo === 'insumo') where.aguardarPeca = false;
  if (status === 'pendente') where.atendido = false;
  if (status === 'atendido') where.atendido = true;

  const insumos = await prisma.solicitacaoInsumo.findMany({
    where,
    include: {
      solicitadoPor: { select: { id: true, nome: true, matricula: true, setor: true } },
      servico: {
        include: {
          veiculo: { include: { garagem: true } },
          ordemServico: { include: { veiculo: true } },
          profissional: { select: { id: true, nome: true, matricula: true, setor: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 3000,
  });

  res.json(insumos);
});

router.get('/dashboard', async (req, res: Response) => {
  const dias = Math.min(90, Math.max(7, parseInt(String(req.query.dias ?? '30'), 10) || 30));
  const garagemId = typeof req.query.garagemId === 'string' ? req.query.garagemId : undefined;
  const desde = inicioPeriodo(dias);
  const filtroGaragem = filtroGaragemServico(garagemId);

  const [
    veiculosNoQuadro,
    servicosAbertos,
    servicosEncerradosPeriodo,
    tempoMedio,
    porSetor,
    porStatusAbertos,
    porProfissional,
    pecasSolicitadas,
    pecasAtendidas,
    registrosAuditoria,
    servicosCriadosPeriodo,
  ] = await Promise.all([
    prisma.servico.groupBy({
      by: ['veiculoId'],
      where: {
        status: { notIn: STATUS_ENCERRADOS },
        ...filtroGaragem,
      },
    }),
    prisma.servico.count({
      where: {
        status: { notIn: STATUS_ENCERRADOS },
        ...filtroGaragem,
      },
    }),
    prisma.servico.count({
      where: {
        status: { in: STATUS_ENCERRADOS },
        updatedAt: { gte: desde },
        ...filtroGaragem,
      },
    }),
    prisma.servico.aggregate({
      where: {
        tempoTotalMin: { not: null },
        status: { in: STATUS_ENCERRADOS },
        updatedAt: { gte: desde },
        ...filtroGaragem,
      },
      _avg: { tempoTotalMin: true },
    }),
    prisma.servico.groupBy({
      by: ['setor'],
      where: {
        createdAt: { gte: desde },
        ...filtroGaragem,
      },
      _count: { id: true },
    }),
    prisma.servico.groupBy({
      by: ['status'],
      where: {
        status: { notIn: STATUS_ENCERRADOS },
        ...filtroGaragem,
      },
      _count: { id: true },
    }),
    prisma.servico.groupBy({
      by: ['profissionalId'],
      where: {
        profissionalId: { not: null },
        status: { in: STATUS_ENCERRADOS },
        updatedAt: { gte: desde },
        ...filtroGaragem,
      },
      _count: { id: true },
    }),
    prisma.solicitacaoInsumo.count({
      where: {
        aguardarPeca: true,
        createdAt: { gte: desde },
        servico: filtroGaragem,
      },
    }),
    prisma.solicitacaoInsumo.count({
      where: {
        aguardarPeca: true,
        atendido: true,
        updatedAt: { gte: desde },
        servico: filtroGaragem,
      },
    }),
    prisma.auditoria.findMany({
      where: {
        createdAt: { gte: desde },
        acao: { notIn: [...ACOES_EXCLUIDAS_GERENCIA] },
      },
      select: { acao: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.servico.count({
      where: {
        createdAt: { gte: desde },
        ...filtroGaragem,
      },
    }),
  ]);

  const profissionais = await prisma.usuario.findMany({
    where: { role: Role.PROFISSIONAL },
    select: { id: true, nome: true, setor: true },
  });

  const mapaAcao = new Map<string, number>();
  const mapaDia = new Map<string, number>();

  for (const reg of registrosAuditoria) {
    mapaAcao.set(reg.acao, (mapaAcao.get(reg.acao) ?? 0) + 1);
    const dia = chaveDia(reg.createdAt);
    mapaDia.set(dia, (mapaDia.get(dia) ?? 0) + 1);
  }

  const atividadePorDia: Array<{ dia: string; total: number }> = [];
  const cursor = new Date(desde);
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  while (cursor <= hoje) {
    const dia = chaveDia(cursor);
    atividadePorDia.push({ dia, total: mapaDia.get(dia) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const eventosPorAcao = [...mapaAcao.entries()]
    .map(([acao, total]) => ({
      acao,
      rotulo: ROTULOS_ACAO_GERENCIA[acao] ?? acao,
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const servicosPorSetor = porSetor
    .map((s) => ({ setor: s.setor, total: s._count.id }))
    .sort((a, b) => b.total - a.total);

  const quadroPorStatus = porStatusAbertos
    .map((s) => ({
      status: s.status,
      rotulo: ROTULOS_STATUS_GERENCIA[s.status] ?? s.status,
      total: s._count.id,
    }))
    .sort((a, b) => b.total - a.total);

  const produtividade = porProfissional
    .map((p) => {
      const prof = profissionais.find((pr) => pr.id === p.profissionalId);
      return {
        profissional: prof ? { nome: prof.nome, setor: prof.setor } : null,
        total: p._count.id,
      };
    })
    .filter((p) => p.profissional)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  res.json({
    periodoDias: dias,
    resumo: {
      veiculosNoQuadro: veiculosNoQuadro.length,
      servicosAbertos,
      servicosEncerradosPeriodo,
      servicosCriadosPeriodo,
      tempoMedioMin: Math.round(tempoMedio._avg.tempoTotalMin ?? 0),
      pecasSolicitadas,
      pecasAtendidas,
    },
    servicosPorSetor,
    quadroPorStatus,
    eventosPorAcao,
    atividadePorDia,
    produtividade,
    exclusoesAplicadas: ACOES_EXCLUIDAS_GERENCIA,
  });
});

export default router;
