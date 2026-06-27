import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken, authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { auditLog } from '../middleware/audit';

const router = Router();

const loginSchema = z.object({
  matricula: z.string().min(1),
  senha: z.string().min(1),
});

router.post('/login', async (req, res: Response) => {
  try {
    const { matricula, senha } = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({
      where: { matricula },
      include: { garagem: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(senha, usuario.senha);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = signToken({
      id: usuario.id,
      matricula: usuario.matricula,
      role: usuario.role,
      setor: usuario.setor,
    });

    await auditLog(
      { user: { id: usuario.id, matricula: usuario.matricula, role: usuario.role, setor: usuario.setor } } as AuthRequest,
      'LOGIN',
      'Usuario',
      usuario.id
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
        role: usuario.role,
        setor: usuario.setor,
        especialidade: usuario.especialidade,
        garagemId: usuario.garagemId,
        garagem: usuario.garagem
          ? {
              id: usuario.garagem.id,
              nome: usuario.garagem.nome,
              estado: usuario.garagem.estado,
              rotulo: `${usuario.garagem.nome} - ${usuario.garagem.estado}`,
            }
          : null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      nome: true,
      matricula: true,
      role: true,
      setor: true,
      especialidade: true,
      garagemId: true,
      garagem: { select: { id: true, nome: true, estado: true } },
    },
  });
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({
    ...usuario,
    garagem: usuario.garagem
      ? {
          ...usuario.garagem,
          rotulo: `${usuario.garagem.nome} - ${usuario.garagem.estado}`,
        }
      : null,
  });
});

export default router;
