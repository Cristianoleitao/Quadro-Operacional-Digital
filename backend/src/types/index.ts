import { Request } from 'express';
import { Role, Setor } from '@prisma/client';

export interface AuthPayload {
  id: string;
  matricula: string;
  role: Role;
  setor?: Setor | null;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export const SETOR_LABELS: Record<Setor, string> = {
  MEC: 'Mecânica',
  ELE: 'Elétrica',
  LANT: 'Lanternagem',
  PINT: 'Pintura',
  REFR: 'Refrigeração',
  BORR: 'Borracharia',
  LIMP: 'Limpeza',
  OUTRO: 'Outro',
};

export const SETOR_PREFIX: Record<Setor, string> = {
  MEC: '[MEC]',
  ELE: '[ELET]',
  LANT: '[LANT]',
  PINT: '[PINT]',
  REFR: '[REFR]',
  BORR: '[BORR]',
  LIMP: '[LIMP]',
  OUTRO: '[OUTRO]',
};

export const STATUS_LABELS: Record<string, string> = {
  EM_EXECUCAO: 'Em Execução',
  PARADO_CRITICO: 'Parado Crítico',
  AGUARDANDO_INSUMO: 'Aguardando Insumo',
  SERVICO_DEMORADO: 'Serviço Demorado',
  MANUTENCAO_PREVENTIVA: 'Manutenção Preventiva',
  FINALIZADO: 'Finalizado',
  CONCLUIDO: 'Concluído',
};
