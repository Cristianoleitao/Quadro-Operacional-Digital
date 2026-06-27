import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { auditLog } from '../middleware/audit';
import { Role } from '@prisma/client';
import { broadcast } from '../lib/websocket';
// import { garantirServicoLimpezaVeiculo } from '../lib/servicoLimpeza';

const router = Router();

function paramId(id: string | string[]): string {
  return Array.isArray(id) ? id[0] : id;
}

function parseDataBr(data: string): Date | null {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseHora(hora: string): { h: number; m: number } | null {
  const normalized = hora.replace(/^(\d{2})H(\d{2})$/i, '$1:$2');
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

const dadosQuadroSchema = z.object({
  data: z.string().optional(),
  hora: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.trim() || null)),
  numeroOs: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.trim().toUpperCase() || null)),
});

router.patch('/:id/dados-quadro', async (req, res: Response) => {
  try {
    const id = paramId(req.params.id);
    const { data, hora, numeroOs } = dadosQuadroSchema.parse(req.body);

    const veiculo = await prisma.veiculo.findUnique({ where: { id } });
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });

    const updateData: { dataEntrada?: Date; numeroOs?: string | null } = {};

    if (data !== undefined || hora !== undefined) {
      let dataEntrada = veiculo.dataEntrada ? new Date(veiculo.dataEntrada) : new Date();

      if (data !== undefined && data !== '') {
        const parsed = parseDataBr(data);
        if (!parsed) {
          return res.status(400).json({ error: 'Data inválida. Use DD/MM/AAAA' });
        }
        dataEntrada.setFullYear(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }

      if (hora !== undefined) {
        if (hora === null || hora === '') {
          dataEntrada.setHours(0, 0, 0, 0);
        } else {
          const parsed = parseHora(hora);
          if (!parsed) {
            return res.status(400).json({ error: 'Hora inválida. Use HH:MM ou 23H57' });
          }
          dataEntrada.setHours(parsed.h, parsed.m, 0, 0);
        }
      }

      updateData.dataEntrada = dataEntrada;
    }

    if (numeroOs !== undefined) updateData.numeroOs = numeroOs;

    const updated = await prisma.veiculo.update({
      where: { id },
      data: updateData,
    });

    broadcast('quadro:update', null);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.use(authMiddleware);

const createSchema = z.object({
  numero: z.string().min(1),
  garagemId: z.string().uuid().optional(),
});

router.get('/', async (_req, res: Response) => {
  const veiculos = await prisma.veiculo.findMany({
    where: { ativo: true },
    orderBy: { numero: 'asc' },
  });
  res.json(veiculos);
});

router.post('/', requireRole(Role.ADMINISTRADOR), async (req: AuthRequest, res: Response) => {
  try {
    const { numero, garagemId } = createSchema.parse(req.body);
    const veiculo = await prisma.veiculo.create({
      data: {
        numero: numero.trim().toUpperCase(),
        dataEntrada: new Date(),
        ...(garagemId ? { garagemId } : {}),
      },
    });
    // await garantirServicoLimpezaVeiculo(veiculo.id);
    broadcast('quadro:update', null);
    await auditLog(req, 'CRIAR', 'Veiculo', veiculo.id, { numero });
    res.status(201).json(veiculo);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
  }
});

export default router;
