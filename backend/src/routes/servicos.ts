import { Router, Response } from 'express';
import { z } from 'zod';
import { Setor, StatusServico } from '@prisma/client';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { auditLog } from '../middleware/audit';
import { broadcast } from '../lib/websocket';
import { garantirSaidasAtualizadas, anexarHoraSaidaVeiculos } from '../lib/saidaVeiculos';
import { enriquecerVeiculosLista } from '../lib/veiculoEnriquecimento';
// import { garantirServicoLimpezaVeiculo } from '../lib/servicoLimpeza';

const router = Router();

function paramId(id: string | string[]): string {
  return Array.isArray(id) ? id[0] : id;
}

const profissionalResumoSelect = {
  select: { id: true, nome: true, matricula: true, setor: true },
} as const;

const servicoInclude = {
  veiculo: {
    include: { garagem: true },
  },
  ordemServico: {
    include: { veiculo: true },
  },
  profissional: profissionalResumoSelect,
  finalizadoPor: profissionalResumoSelect,
  insumos: {
    include: {
      solicitadoPor: profissionalResumoSelect,
    },
  },
};

/** Status em que o profissional é desconectado do serviço (visíveis no quadro, sem vínculo ativo). */
const STATUS_DESCONECTA_PROFISSIONAL: StatusServico[] = [
  StatusServico.AGUARDANDO_INSUMO,
  StatusServico.SERVICO_EXTERNO,
];

const STATUS_CORRETIVA_ATIVA: StatusServico[] = [
  StatusServico.EM_EXECUCAO,
  StatusServico.PARADO_CRITICO,
];

/** Status que o profissional pode assumir, executar, solicitar insumo e finalizar. */
const STATUS_PROFISSIONAL_ATIVO: StatusServico[] = [
  StatusServico.EM_EXECUCAO,
  StatusServico.PARADO_CRITICO,
  StatusServico.SERVICO_DEMORADO,
  StatusServico.MANUTENCAO_PREVENTIVA,
];

const STATUS_FORA_DO_QUADRO: StatusServico[] = [
  StatusServico.FINALIZADO,
  StatusServico.CONCLUIDO,
];

function dadosAtualizacaoStatus(
  status: StatusServico,
  servico: { profissionalId: string | null },
): {
  status: StatusServico;
  profissionalId?: null;
  horaAssumido?: null;
  horaInicio?: null;
} {
  const data: {
    status: StatusServico;
    profissionalId?: null;
    horaAssumido?: null;
    horaInicio?: null;
  } = { status };

  if (STATUS_DESCONECTA_PROFISSIONAL.includes(status) && servico.profissionalId) {
    data.profissionalId = null;
    data.horaAssumido = null;
    data.horaInicio = null;
  }

  return data;
}

async function aplicarAguardandoInsumoNoVeiculo(veiculoId: string): Promise<number> {
  const servicos = await prisma.servico.findMany({
    where: {
      veiculoId,
      status: { notIn: STATUS_FORA_DO_QUADRO },
    },
  });

  if (servicos.length === 0) return 0;

  await prisma.$transaction(
    servicos.map((s) =>
      prisma.servico.update({
        where: { id: s.id },
        data: dadosAtualizacaoStatus(StatusServico.AGUARDANDO_INSUMO, s),
      }),
    ),
  );

  return servicos.length;
}

async function veiculoTemPecaPendente(veiculoId: string): Promise<boolean> {
  const servicos = await prisma.servico.findMany({
    where: {
      veiculoId,
      status: { notIn: STATUS_FORA_DO_QUADRO },
    },
    include: { insumos: true },
  });

  return servicos.some((s) =>
    s.insumos.some((i) => i.aguardarPeca && !i.atendido),
  );
}

async function restaurarVeiculoSeSemPecaPendente(veiculoId: string): Promise<number> {
  const servicos = await prisma.servico.findMany({
    where: {
      veiculoId,
      status: { notIn: STATUS_FORA_DO_QUADRO },
    },
    include: { insumos: true },
  });

  if (servicos.length === 0) return 0;

  const temPecaPendente = servicos.some((s) =>
    s.insumos.some((i) => i.aguardarPeca && !i.atendido),
  );
  if (temPecaPendente) return 0;

  const aguardando = servicos.filter((s) => s.status === StatusServico.AGUARDANDO_INSUMO);
  if (aguardando.length === 0) return 0;

  await prisma.$transaction(
    aguardando.map((s) =>
      prisma.servico.update({
        where: { id: s.id },
        data: { status: StatusServico.EM_EXECUCAO },
      }),
    ),
  );

  return aguardando.length;
}

const cadastroRapidoSchema = z.object({
  veiculoNumero: z.string().min(1).transform((s) => s.trim().toUpperCase()),
  setor: z.nativeEnum(Setor),
  descricao: z.string().min(1).transform((s) => s.trim().toUpperCase()),
  garagemId: z.string().uuid(),
});

const profissionalServicoSchema = z.object({
  nome: z.string().max(120),
});

const localExternoSchema = z.object({
  local: z
    .string()
    .max(200)
    .transform((s) => s.trim().toUpperCase()),
});

const setorServicoSchema = z.object({
  setor: z.nativeEnum(Setor),
});

async function buscarProfissionalPorNome(nome: string) {
  const termo = nome.trim();
  if (!termo) return null;

  const profissionais = await prisma.usuario.findMany({
    where: { role: Role.PROFISSIONAL, ativo: true },
    select: { id: true, nome: true, matricula: true, setor: true },
  });

  const termoUpper = termo.toUpperCase();

  const porMatricula = profissionais.find((p) => p.matricula.toUpperCase() === termoUpper);
  if (porMatricula) return porMatricula;

  const porPrimeiroNome = profissionais.filter(
    (p) => p.nome.split(' ')[0]?.toUpperCase() === termoUpper,
  );
  if (porPrimeiroNome.length >= 1) return porPrimeiroNome[0];

  const porNome = profissionais.filter((p) => p.nome.toUpperCase().includes(termoUpper));
  if (porNome.length === 1) return porNome[0];

  const exato = porNome.find((p) => p.nome.toUpperCase() === termoUpper);
  if (exato) return exato;

  return null;
}

router.get('/quadro', async (req, res: Response) => {
  const garagemId = typeof req.query.garagemId === 'string' ? req.query.garagemId : undefined;

  const servicos = await prisma.servico.findMany({
    where: {
      status: { notIn: STATUS_FORA_DO_QUADRO },
      ...(garagemId ? { veiculo: { garagemId } } : {}),
    },
    include: servicoInclude,
    orderBy: [{ veiculo: { numero: 'asc' } }, { createdAt: 'asc' }],
  });

  const numerosCorretiva = [
    ...new Set(
      servicos
        .filter((s) => STATUS_CORRETIVA_ATIVA.includes(s.status))
        .map((s) => s.veiculo.numero),
    ),
  ];
  await garantirSaidasAtualizadas(numerosCorretiva);

  const idsNaoCorretiva = [
    ...new Set(
      servicos
        .filter((s) => !STATUS_CORRETIVA_ATIVA.includes(s.status))
        .map((s) => s.veiculoId),
    ),
  ];
  if (idsNaoCorretiva.length > 0) {
    await prisma.veiculo.updateMany({
      where: { id: { in: idsNaoCorretiva }, horaSaida: { not: null } },
      data: { horaSaida: null },
    });
  }

  const veiculoIds = [...new Set(servicos.map((s) => s.veiculoId))];
  const veiculosComExecutado = new Set<string>();
  const horaSaidaPorVeiculo = new Map<string, Date | null>();

  if (veiculoIds.length > 0) {
    const veiculosAtualizados = await prisma.veiculo.findMany({
      where: { id: { in: veiculoIds } },
      select: { id: true, horaSaida: true },
    });
    for (const veiculo of veiculosAtualizados) {
      horaSaidaPorVeiculo.set(veiculo.id, veiculo.horaSaida);
    }

    const finalizados = await prisma.servico.groupBy({
      by: ['veiculoId'],
      where: {
        veiculoId: { in: veiculoIds },
        status: { in: [StatusServico.FINALIZADO, StatusServico.CONCLUIDO] },
      },
    });
    for (const row of finalizados) {
      veiculosComExecutado.add(row.veiculoId);
    }
  }

  res.json(
    servicos.map((s) => ({
      ...s,
      veiculo: {
        ...s.veiculo,
        horaSaida: horaSaidaPorVeiculo.get(s.veiculoId) ?? s.veiculo.horaSaida ?? null,
        temServicoExecutado: veiculosComExecutado.has(s.veiculoId),
      },
    })),
  );
});

router.post('/cadastro-rapido', async (req: AuthRequest, res: Response) => {
  try {
    const { veiculoNumero, setor, descricao, garagemId } = cadastroRapidoSchema.parse(req.body);
    const numeroNormalizado = veiculoNumero.trim().toUpperCase();

    const garagem = await prisma.garagem.findFirst({
      where: { id: garagemId, ativo: true },
    });
    if (!garagem) {
      return res.status(400).json({ error: 'Garagem inválida' });
    }

    let veiculoNovo = false;
    let veiculoReaberto = false;

    let veiculo =
      (await prisma.veiculo.findUnique({ where: { numero: numeroNormalizado } })) ??
      (await prisma.veiculo.findFirst({
        where: { numero: { equals: numeroNormalizado, mode: 'insensitive' } },
      }));
    if (!veiculo) {
      veiculoNovo = true;
      veiculo = await prisma.veiculo.create({
        data: { numero: numeroNormalizado, dataEntrada: new Date(), garagemId },
      });
    } else {
      const updates: { dataEntrada?: Date; fechadoAdmin?: boolean; garagemId?: string } = {
        garagemId,
      };
      if (veiculo.fechadoAdmin) {
        veiculoReaberto = true;
        updates.fechadoAdmin = false;
        updates.dataEntrada = new Date();
      } else if (!veiculo.dataEntrada) {
        updates.dataEntrada = new Date();
      }
      if (Object.keys(updates).length > 0) {
        veiculo = await prisma.veiculo.update({
          where: { id: veiculo.id },
          data: updates,
        });
      }
    }

    const servico = await prisma.servico.create({
      data: {
        veiculoId: veiculo.id,
        setor,
        descricao,
        status: StatusServico.EM_EXECUCAO,
      },
      include: servicoInclude,
    });

    // if (veiculoNovo || veiculoReaberto) {
    //   await garantirServicoLimpezaVeiculo(veiculo.id);
    // }

    await auditLog(req, 'CRIAR', 'Servico', servico.id, { veiculoNumero, setor, descricao });
    broadcast('quadro:update', null);

    res.status(201).json({ servico });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const dadosTerceirosSchema = z.object({
  numeroOs: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.trim().toUpperCase() || null)),
  horaOs: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.trim() || null)),
});

router.patch('/:id/dados-terceiros', async (req: AuthRequest, res: Response) => {
  try {
    const id = paramId(req.params.id);
    const { numeroOs, horaOs } = dadosTerceirosSchema.parse(req.body);

    const servico = await prisma.servico.findUnique({
      where: { id },
      include: { veiculo: true },
    });
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    const veiculoData: { dataEntrada?: Date; numeroOs?: string | null } = {};
    if (numeroOs !== undefined) veiculoData.numeroOs = numeroOs;
    if (horaOs !== undefined) {
      const base = servico.veiculo.dataEntrada
        ? new Date(servico.veiculo.dataEntrada)
        : new Date(servico.createdAt);
      if (horaOs === null || horaOs === '') {
        base.setHours(0, 0, 0, 0);
      } else if (/^\d{2}:\d{2}$/.test(horaOs)) {
        const [h, m] = horaOs.split(':').map(Number);
        base.setHours(h, m, 0, 0);
      } else if (/^\d{2}H\d{2}$/i.test(horaOs)) {
        const h = parseInt(horaOs.slice(0, 2), 10);
        const m = parseInt(horaOs.slice(3, 5), 10);
        base.setHours(h, m, 0, 0);
      } else {
        return res.status(400).json({ error: 'Hora inválida. Use HH:MM ou 23H57' });
      }
      veiculoData.dataEntrada = base;
    }

    await prisma.veiculo.update({
      where: { id: servico.veiculoId },
      data: veiculoData,
    });

    const updated = await prisma.servico.findUnique({
      where: { id },
      include: servicoInclude,
    });

    await auditLog(req, 'ATUALIZAR_DADOS_TERCEIROS', 'Servico', id, { numeroOs, horaOs });
    broadcast('quadro:update', null);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/profissionais', async (_req, res: Response) => {
  const profissionais = await prisma.usuario.findMany({
    where: { role: Role.PROFISSIONAL, ativo: true },
    select: { id: true, nome: true, matricula: true, setor: true },
    orderBy: { nome: 'asc' },
  });
  res.json(profissionais);
});

router.patch('/:id/profissional', async (req: AuthRequest, res: Response) => {
  try {
    const id = paramId(req.params.id);
    const { nome } = profissionalServicoSchema.parse(req.body);

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
    if (STATUS_FORA_DO_QUADRO.includes(servico.status)) {
      return res.status(400).json({ error: 'Serviço já encerrado' });
    }

    const agora = new Date();
    let updateData: {
      profissionalId: string | null;
      horaAssumido?: Date | null;
      horaInicio?: Date | null;
    };

    if (!nome.trim()) {
      updateData = {
        profissionalId: null,
        horaAssumido: null,
        horaInicio: null,
      };
    } else {
      if (STATUS_DESCONECTA_PROFISSIONAL.includes(servico.status)) {
        return res.status(400).json({
          error: 'Não é possível atribuir profissional em serviço aguardando peça ou externo',
        });
      }
      const profissional = await buscarProfissionalPorNome(nome);
      if (!profissional) {
        return res.status(404).json({ error: 'Profissional não encontrado' });
      }
      updateData = {
        profissionalId: profissional.id,
        horaAssumido: servico.horaAssumido ?? agora,
        horaInicio: servico.horaInicio ?? agora,
      };
    }

    const updated = await prisma.servico.update({
      where: { id },
      data: updateData,
      include: servicoInclude,
    });

    await auditLog(req, 'ATRIBUIR_PROFISSIONAL', 'Servico', id, {
      nome: nome.trim() || null,
      profissionalId: updateData.profissionalId,
    });
    broadcast('quadro:update', null);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.use(authMiddleware);

router.get('/meus', async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  const usuario = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { setor: true, garagemId: true },
  });

  const where: Record<string, unknown> = {
    status: { in: STATUS_PROFISSIONAL_ATIVO },
    profissionalId: null,
  };

  if (user.role === Role.PROFISSIONAL && usuario?.setor) {
    where.setor = usuario.setor;
  }

  if (user.role === Role.PROFISSIONAL && usuario?.garagemId) {
    where.veiculo = { garagemId: usuario.garagemId };
  }

  const servicos = await prisma.servico.findMany({
    where,
    include: servicoInclude,
    orderBy: { createdAt: 'asc' },
  });

  res.json(await enriquecerVeiculosLista(await anexarHoraSaidaVeiculos(servicos)));
});

router.get('/em-execucao', async (req: AuthRequest, res: Response) => {
  const servicos = await prisma.servico.findMany({
    where: {
      profissionalId: req.user!.id,
      status: { in: STATUS_PROFISSIONAL_ATIVO },
    },
    include: servicoInclude,
    orderBy: { horaAssumido: 'asc' },
  });
  res.json(await enriquecerVeiculosLista(await anexarHoraSaidaVeiculos(servicos)));
});

router.get('/meu-historico', requireRole(Role.PROFISSIONAL), async (req: AuthRequest, res: Response) => {
  const diasParam = Number(req.query.dias ?? 30);
  const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.min(diasParam, 90) : 30;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  desde.setHours(0, 0, 0, 0);

  const servicos = await prisma.servico.findMany({
    where: {
      finalizadoPorId: req.user!.id,
      status: { in: [StatusServico.FINALIZADO, StatusServico.CONCLUIDO] },
      horaTermino: { gte: desde },
    },
    include: servicoInclude,
    orderBy: { horaTermino: 'desc' },
    take: 100,
  });

  res.json(await enriquecerVeiculosLista(servicos));
});

router.get('/acompanhamento', requireRole(Role.ADMINISTRADOR), async (_req, res: Response) => {
  const servicos = await prisma.servico.findMany({
    where: {
      veiculo: { fechadoAdmin: false },
    },
    include: servicoInclude,
    orderBy: [{ veiculo: { numero: 'asc' } }, { createdAt: 'asc' }],
    take: 500,
  });
  res.json(servicos);
});

router.get('/estoque', requireRole(Role.ESTOQUE), async (_req, res: Response) => {
  const servicos = await prisma.servico.findMany({
    where: {
      status: StatusServico.AGUARDANDO_INSUMO,
      veiculo: { fechadoAdmin: false },
      insumos: { some: { aguardarPeca: true, atendido: false } },
    },
    include: servicoInclude,
    orderBy: [{ veiculo: { numero: 'asc' } }, { createdAt: 'asc' }],
  });
  res.json(servicos);
});

router.post(
  '/veiculo/:veiculoId/finalizar-admin',
  requireRole(Role.ADMINISTRADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const veiculoId = paramId(req.params.veiculoId);
      const agora = new Date();

      const servicos = await prisma.servico.findMany({ where: { veiculoId } });

      if (servicos.length === 0) {
        return res.status(400).json({ error: 'Nenhum serviço encontrado para este veículo' });
      }

      await prisma.$transaction(
        servicos.map((s) => {
          const tempoTotalMin =
            s.tempoTotalMin ??
            (s.horaInicio
              ? Math.round((agora.getTime() - s.horaInicio.getTime()) / 60000)
              : 0);

          return prisma.servico.update({
            where: { id: s.id },
            data: {
              status: StatusServico.CONCLUIDO,
              horaTermino: s.horaTermino ?? agora,
              tempoTotalMin,
              correcao: s.correcao ?? 'Encerrado pelo administrador',
              finalizadoPorId: s.finalizadoPorId ?? req.user!.id,
            },
          });
        }),
      );

      await prisma.veiculo.update({
        where: { id: veiculoId },
        data: { fechadoAdmin: true },
      });

      await auditLog(req, 'FINALIZAR_VEICULO', 'Veiculo', veiculoId, {
        servicosConcluidos: servicos.length,
      });
      broadcast('quadro:update', null);
      res.json({ ok: true, concluidos: servicos.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno' });
    }
  },
);

router.delete(
  '/veiculo/:veiculoId',
  requireRole(Role.ADMINISTRADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const veiculoId = paramId(req.params.veiculoId);

      const removiveis = await prisma.servico.findMany({
        where: { veiculoId, status: { not: StatusServico.CONCLUIDO } },
        select: { id: true },
      });

      if (removiveis.length === 0) {
        return res.status(400).json({ error: 'Nenhum serviço pode ser excluído' });
      }

      const ids = removiveis.map((s) => s.id);
      await prisma.solicitacaoInsumo.deleteMany({ where: { servicoId: { in: ids } } });
      await prisma.servico.deleteMany({ where: { id: { in: ids } } });

      const restantes = await prisma.servico.count({ where: { veiculoId } });
      if (restantes === 0) {
        await prisma.veiculo.update({
          where: { id: veiculoId },
          data: { fechadoAdmin: true },
        });
      }

      await auditLog(req, 'EXCLUIR_VEICULO', 'Veiculo', veiculoId, { servicosExcluidos: ids.length });
      broadcast('quadro:update', null);
      res.json({ ok: true, excluidos: ids.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno' });
    }
  },
);

const statusVeiculoSchema = z
  .object({
    status: z.nativeEnum(StatusServico),
    descricaoPeca: z
      .string()
      .min(1)
      .transform((s) => s.trim().toUpperCase())
      .optional(),
    servicoId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === StatusServico.AGUARDANDO_INSUMO) {
      if (!data.descricaoPeca?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe qual peça está faltando',
          path: ['descricaoPeca'],
        });
      }
      if (!data.servicoId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe qual serviço aguarda a peça',
          path: ['servicoId'],
        });
      }
    }
  });

router.patch(
  '/veiculo/:veiculoId/status',
  requireRole(Role.ADMINISTRADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const veiculoId = paramId(req.params.veiculoId);
      const { status, descricaoPeca, servicoId } = statusVeiculoSchema.parse(req.body);

      const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } });
      if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });

      if (
        status !== StatusServico.AGUARDANDO_INSUMO &&
        (await veiculoTemPecaPendente(veiculoId))
      ) {
        return res.status(400).json({
          error: 'Atenda a peça pendente no estoque antes de alterar o status do veículo',
        });
      }

      if (status === StatusServico.AGUARDANDO_INSUMO) {
        const servico = await prisma.servico.findUnique({ where: { id: servicoId! } });
        if (!servico || servico.veiculoId !== veiculoId) {
          return res.status(400).json({ error: 'Serviço inválido para este veículo' });
        }

        await prisma.solicitacaoInsumo.create({
          data: {
            servicoId: servicoId!,
            descricao: descricaoPeca!,
            aguardarPeca: true,
            quantidade: 1,
            solicitadoPorId: req.user!.id,
          },
        });

        const atualizados = await aplicarAguardandoInsumoNoVeiculo(veiculoId);

        await auditLog(req, 'ATUALIZAR_STATUS_VEICULO', 'Veiculo', veiculoId, {
          status,
          descricaoPeca,
          servicoId,
          atualizados,
        });
        broadcast('quadro:update', null);
        return res.json({ ok: true, atualizados });
      }

      const servicos = await prisma.servico.findMany({
        where: {
          veiculoId,
          status: { notIn: STATUS_FORA_DO_QUADRO },
        },
      });

      if (servicos.length === 0) {
        return res.status(400).json({ error: 'Nenhum serviço aberto neste veículo' });
      }

      await prisma.$transaction(
        servicos.map((s) =>
          prisma.servico.update({
            where: { id: s.id },
            data: dadosAtualizacaoStatus(status, s),
          }),
        ),
      );

      await auditLog(req, 'ATUALIZAR_STATUS_VEICULO', 'Veiculo', veiculoId, {
        status,
        atualizados: servicos.length,
      });
      broadcast('quadro:update', null);
      res.json({ ok: true, atualizados: servicos.length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors[0]?.message ?? 'Dados inválidos';
        return res.status(400).json({ error: msg });
      }
      console.error(err);
      res.status(500).json({ error: 'Erro interno' });
    }
  },
);

router.post('/:id/assumir', requireRole(Role.PROFISSIONAL), async (req: AuthRequest, res: Response) => {
  const servico = await prisma.servico.findUnique({
    where: { id: paramId(req.params.id) },
    include: { profissional: true },
  });

  if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (servico.profissionalId) return res.status(409).json({ error: 'Serviço já assumido' });
  if (servico.status === StatusServico.FINALIZADO || servico.status === StatusServico.CONCLUIDO) {
    return res.status(400).json({ error: 'Serviço já finalizado' });
  }
  if (
    !STATUS_PROFISSIONAL_ATIVO.includes(servico.status)
  ) {
    return res.status(400).json({ error: 'Só é possível assumir serviços disponíveis para execução' });
  }

  const agora = new Date();
  const statusAposAssumir =
    servico.status === StatusServico.PARADO_CRITICO || servico.status === StatusServico.EM_EXECUCAO
      ? StatusServico.EM_EXECUCAO
      : servico.status;

  const updated = await prisma.servico.update({
    where: { id: paramId(req.params.id) },
    data: {
      profissionalId: req.user!.id,
      horaAssumido: agora,
      horaInicio: agora,
      status: statusAposAssumir,
    },
    include: servicoInclude,
  });

  await auditLog(req, 'ASSUMIR', 'Servico', servico.id);
  broadcast('quadro:update', null);
  res.json(updated);
});

const statusSchema = z
  .object({
    status: z.nativeEnum(StatusServico),
    descricaoPeca: z
      .string()
      .min(1)
      .transform((s) => s.trim().toUpperCase())
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === StatusServico.AGUARDANDO_INSUMO && !data.descricaoPeca?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe qual peça está faltando',
        path: ['descricaoPeca'],
      });
    }
  });

router.patch('/:id/status', requireRole(Role.ADMINISTRADOR), async (req: AuthRequest, res: Response) => {
  try {
    const { status, descricaoPeca } = statusSchema.parse(req.body);
    const id = paramId(req.params.id);

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    if (
      status !== StatusServico.AGUARDANDO_INSUMO &&
      (await veiculoTemPecaPendente(servico.veiculoId))
    ) {
      return res.status(400).json({
        error: 'Atenda a peça pendente no estoque antes de alterar o status do veículo',
      });
    }

    if (status === StatusServico.AGUARDANDO_INSUMO) {
      await prisma.solicitacaoInsumo.create({
        data: {
          servicoId: id,
          descricao: descricaoPeca!,
          aguardarPeca: true,
          quantidade: 1,
          solicitadoPorId: req.user!.id,
        },
      });

      await aplicarAguardandoInsumoNoVeiculo(servico.veiculoId);

      const updated = await prisma.servico.findUnique({
        where: { id },
        include: servicoInclude,
      });

      await auditLog(req, 'ATUALIZAR_STATUS', 'Servico', id, {
        status,
        descricaoPeca,
        veiculoId: servico.veiculoId,
        profissionalDesconectado: Boolean(servico.profissionalId),
      });
      broadcast('quadro:update', null);
      return res.json(updated);
    }

    const data = dadosAtualizacaoStatus(status, servico);
    const profissionalDesconectado =
      STATUS_DESCONECTA_PROFISSIONAL.includes(status) && Boolean(servico.profissionalId);

    const updated = await prisma.servico.update({
      where: { id },
      data,
      include: servicoInclude,
    });
    await auditLog(req, 'ATUALIZAR_STATUS', 'Servico', id, {
      status,
      profissionalDesconectado,
    });
    broadcast('quadro:update', null);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msg = err.errors[0]?.message ?? 'Dados inválidos';
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.patch(
  '/:id/local-externo',
  requireRole(Role.ADMINISTRADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req.params.id);
      const { local } = localExternoSchema.parse(req.body);

      const servico = await prisma.servico.findUnique({ where: { id } });
      if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
      if (servico.status !== StatusServico.SERVICO_EXTERNO) {
        return res.status(400).json({ error: 'Local externo só se aplica a serviço externo' });
      }

      const updated = await prisma.servico.update({
        where: { id },
        data: { localExterno: local || null },
        include: servicoInclude,
      });

      await auditLog(req, 'ATUALIZAR_LOCAL_EXTERNO', 'Servico', id, { local: local || null });
      broadcast('quadro:update', null);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Dados inválidos' });
      }
      console.error(err);
      res.status(500).json({ error: 'Erro interno' });
    }
  },
);

router.patch(
  '/:id/setor',
  requireRole(Role.ADMINISTRADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req.params.id);
      const { setor } = setorServicoSchema.parse(req.body);

      const servico = await prisma.servico.findUnique({ where: { id } });
      if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
      if (STATUS_FORA_DO_QUADRO.includes(servico.status)) {
        return res.status(400).json({ error: 'Não é possível alterar setor de serviço encerrado' });
      }
      if (servico.setor === setor) {
        const atual = await prisma.servico.findUnique({
          where: { id },
          include: servicoInclude,
        });
        return res.json(atual);
      }

      const updated = await prisma.servico.update({
        where: { id },
        data: { setor },
        include: servicoInclude,
      });

      await auditLog(req, 'ATUALIZAR_SETOR', 'Servico', id, {
        setorAnterior: servico.setor,
        setor,
      });
      broadcast('quadro:update', null);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Setor inválido', details: err.errors });
      }
      console.error(err);
      res.status(500).json({ error: 'Erro interno' });
    }
  },
);

const insumoSchema = z.object({
  descricao: z.string().min(1),
  alterarStatus: z.boolean().optional().default(false),
  quantidade: z.coerce.number().int().positive().optional().default(1),
});

router.post('/:id/insumos', requireRole(Role.PROFISSIONAL), async (req: AuthRequest, res: Response) => {
  try {
    const { descricao, alterarStatus, quantidade } = insumoSchema.parse(req.body);
    const servicoId = paramId(req.params.id);

    const servico = await prisma.servico.findUnique({ where: { id: servicoId } });
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    if (servico.profissionalId !== req.user!.id) {
      return res.status(403).json({ error: 'Serviço não está em sua execução' });
    }

    if (!STATUS_PROFISSIONAL_ATIVO.includes(servico.status)) {
      return res.status(400).json({ error: 'Serviço não está ativo para solicitação de insumo' });
    }

    const insumo = await prisma.solicitacaoInsumo.create({
      data: {
        servicoId,
        descricao,
        aguardarPeca: alterarStatus,
        quantidade: alterarStatus ? 1 : quantidade,
        solicitadoPorId: req.user!.id,
      },
      include: {
        solicitadoPor: profissionalResumoSelect,
      },
    });

    if (alterarStatus) {
      await aplicarAguardandoInsumoNoVeiculo(servico.veiculoId);
    }

    await auditLog(req, 'SOLICITAR_INSUMO', 'Servico', servicoId, {
      descricao,
      quantidade: alterarStatus ? 1 : quantidade,
      alterarStatus,
      veiculoId: servico.veiculoId,
      profissionalDesconectado: alterarStatus && Boolean(servico.profissionalId),
    });
    broadcast('quadro:update', null);
    res.status(201).json(insumo);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.patch('/insumos/:id/atender', requireRole(Role.ADMINISTRADOR, Role.ESTOQUE), async (req: AuthRequest, res: Response) => {
  try {
    const insumoId = paramId(req.params.id);

    const insumo = await prisma.solicitacaoInsumo.findUnique({
      where: { id: insumoId },
      include: { servico: { include: { insumos: true } } },
    });

    if (!insumo) {
      return res.status(404).json({ error: 'Insumo não encontrado' });
    }

    if (req.user!.role === Role.ESTOQUE && !insumo.aguardarPeca) {
      return res.status(403).json({ error: 'Estoque só pode atender solicitações de aguardando peça' });
    }

    if (insumo.atendido) {
      return res.status(400).json({ error: 'Insumo já foi atendido' });
    }

    await prisma.solicitacaoInsumo.update({
      where: { id: insumoId },
      data: { atendido: true },
    });

    if (insumo.aguardarPeca) {
      await restaurarVeiculoSeSemPecaPendente(insumo.servico.veiculoId);
    } else {
      const pendentes = insumo.servico.insumos.filter((i) => i.id !== insumoId && !i.atendido);

      if (pendentes.length === 0 && insumo.servico.status === StatusServico.AGUARDANDO_INSUMO) {
        await prisma.servico.update({
          where: { id: insumo.servicoId },
          data: { status: StatusServico.EM_EXECUCAO },
        });
      }
    }

    const servicoAtualizado = await prisma.servico.findUnique({
      where: { id: insumo.servicoId },
      include: servicoInclude,
    });

    await auditLog(req, 'ATENDER_INSUMO', 'SolicitacaoInsumo', insumoId, {
      servicoId: insumo.servicoId,
      descricao: insumo.descricao,
    });
    broadcast('quadro:update', null);

    res.json(servicoAtualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const finalizarSchema = z.object({
  correcao: z.string().min(1),
  correcaoAudio: z.string().optional(),
  fotoAntes: z.string().optional(),
  fotoDepois: z.string().optional(),
});

router.post('/:id/finalizar', requireRole(Role.PROFISSIONAL), async (req: AuthRequest, res: Response) => {
  try {
    const data = finalizarSchema.parse(req.body);
    const agora = new Date();

    const servico = await prisma.servico.findUnique({ where: { id: paramId(req.params.id) } });
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    const tempoTotalMin = servico.horaInicio
      ? Math.round((agora.getTime() - servico.horaInicio.getTime()) / 60000)
      : 0;

    const updated = await prisma.servico.update({
      where: { id: paramId(req.params.id) },
      data: {
        ...data,
        status: StatusServico.FINALIZADO,
        horaTermino: agora,
        tempoTotalMin,
        finalizadoPorId: req.user!.id,
      },
      include: servicoInclude,
    });

    await auditLog(req, 'FINALIZAR', 'Servico', paramId(req.params.id), data);
    broadcast('quadro:update', null);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
