import { Router, Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { auditLog } from '../middleware/audit';
import { normalizarGaragemTexto, rotuloGaragem } from '../lib/garagem';

const router = Router();

const garagemSchema = z.object({
  nome: z.string().min(1).transform((s) => normalizarGaragemTexto(s).toUpperCase()),
  estado: z.string().min(1).transform((s) => normalizarGaragemTexto(s).toUpperCase()),
});

function serializarGaragem(garagem: { id: string; nome: string; estado: string }) {
  return {
    id: garagem.id,
    nome: garagem.nome,
    estado: garagem.estado,
    rotulo: rotuloGaragem(garagem),
  };
}

router.get('/', async (_req, res: Response) => {
  const garagens = await prisma.garagem.findMany({
    where: { ativo: true },
    orderBy: [{ estado: 'asc' }, { nome: 'asc' }],
  });
  res.json(garagens.map(serializarGaragem));
});

router.use(authMiddleware);

router.post('/', requireRole(Role.ADMINISTRADOR), async (req: AuthRequest, res: Response) => {
  try {
    const { nome, estado } = garagemSchema.parse(req.body);

    const existente = await prisma.garagem.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        estado: { equals: estado, mode: 'insensitive' },
      },
    });
    if (existente) {
      return res.status(201).json(serializarGaragem(existente));
    }

    const garagem = await prisma.garagem.create({
      data: { nome, estado },
    });

    await auditLog(req, 'CRIAR', 'Garagem', garagem.id, { nome, estado });
    res.status(201).json(serializarGaragem(garagem));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
