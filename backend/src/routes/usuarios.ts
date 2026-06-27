import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, Setor } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';
import { auditLog } from '../middleware/audit';
import { SETOR_LABELS } from '../types';

const router = Router();

const setorCadastroSchema = z.union([
  z.nativeEnum(Setor),
  z.literal('APONTADOR'),
  z.literal('ESTOQUE'),
]);

const cadastroUsuarioSchema = z
  .object({
    nome: z.string().min(2).transform((s) => s.trim().toUpperCase()),
    matricula: z.string().min(2).transform((s) => s.trim().toUpperCase()),
    senha: z.string().min(4),
    tipo: z.enum(['PROFISSIONAL', 'GERENCIA']),
    setor: setorCadastroSchema.optional(),
    garagemId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === 'GERENCIA') return;

    if (!data.setor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Setor obrigatório', path: ['setor'] });
      return;
    }

    const exigeGaragem = data.setor !== 'APONTADOR' && data.setor !== 'ESTOQUE';
    if (exigeGaragem && !data.garagemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Garagem obrigatória',
        path: ['garagemId'],
      });
    }
  });

type DadosCadastro = z.infer<typeof cadastroUsuarioSchema>;

function mapearCadastro(dados: DadosCadastro): {
  role: Role;
  setor: Setor | null;
  especialidade: string | null;
  garagemId: string | null;
} {
  if (dados.tipo === 'GERENCIA') {
    return {
      role: Role.GERENCIA,
      setor: null,
      especialidade: null,
      garagemId: dados.garagemId ?? null,
    };
  }

  const setor = dados.setor!;
  if (setor === 'APONTADOR') {
    return {
      role: Role.ADMINISTRADOR,
      setor: null,
      especialidade: 'Apontador',
      garagemId: dados.garagemId ?? null,
    };
  }
  if (setor === 'ESTOQUE') {
    return {
      role: Role.ESTOQUE,
      setor: null,
      especialidade: 'Estoque',
      garagemId: dados.garagemId ?? null,
    };
  }

  return {
    role: Role.PROFISSIONAL,
    setor,
    especialidade: SETOR_LABELS[setor] ?? setor,
    garagemId: dados.garagemId ?? null,
  };
}

async function criarUsuarioCadastro(req: AuthRequest, dados: DadosCadastro) {
  if (dados.garagemId) {
    const garagem = await prisma.garagem.findFirst({
      where: { id: dados.garagemId, ativo: true },
    });
    if (!garagem) {
      return { status: 400 as const, body: { error: 'Garagem inválida' } };
    }
  }

  const matriculaExistente = await prisma.usuario.findUnique({
    where: { matricula: dados.matricula },
  });
  if (matriculaExistente) {
    return { status: 409 as const, body: { error: 'Matrícula já cadastrada' } };
  }

  const senhaHash = await bcrypt.hash(dados.senha, 10);
  const perfil = mapearCadastro(dados);

  const usuario = await prisma.usuario.create({
    data: {
      nome: dados.nome,
      matricula: dados.matricula,
      senha: senhaHash,
      role: perfil.role,
      setor: perfil.setor,
      especialidade: perfil.especialidade,
      garagemId: perfil.garagemId,
    },
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

  await auditLog(req, 'AUTO_CADASTRO', 'Usuario', usuario.id, {
    matricula: dados.matricula,
    tipo: dados.tipo,
    setor: dados.setor,
    role: perfil.role,
    garagemId: dados.garagemId,
  });

  return { status: 201 as const, body: usuario };
}

/** Auto-cadastro (público). */
router.post('/cadastro', async (req: AuthRequest, res: Response) => {
  try {
    const dados = cadastroUsuarioSchema.parse(req.body);
    const resultado = await criarUsuarioCadastro(req, dados);
    return res.status(resultado.status).json(resultado.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msg = err.errors[0]?.message ?? 'Dados inválidos';
      return res.status(400).json({ error: msg, details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/** @deprecated Use POST /cadastro — mantido por compatibilidade. */
router.post('/profissionais', async (req: AuthRequest, res: Response) => {
  try {
    const dados = cadastroUsuarioSchema.parse({
      ...req.body,
      tipo: 'PROFISSIONAL',
    });
    const resultado = await criarUsuarioCadastro(req, dados);
    return res.status(resultado.status).json(resultado.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msg = err.errors[0]?.message ?? 'Dados inválidos';
      return res.status(400).json({ error: msg, details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
