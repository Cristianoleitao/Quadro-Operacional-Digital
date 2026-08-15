export type Role = 'ADMINISTRADOR' | 'GERENCIA' | 'PROFISSIONAL' | 'ESTOQUE';

export type TipoCadastro = 'PROFISSIONAL' | 'GERENCIA';

export const TIPO_CADASTRO_LABELS: Record<TipoCadastro, string> = {
  PROFISSIONAL: 'Profissional',
  GERENCIA: 'Gerente',
};

export const TIPOS_CADASTRO: TipoCadastro[] = ['PROFISSIONAL', 'GERENCIA'];

export type Setor = 'MEC' | 'ELE' | 'LANT' | 'PINT' | 'REFR' | 'BORR' | 'LIMP' | 'OUTRO' | 'PENDENTE' | 'APS' | 'CGB';

/** Setores no cadastro; Apontador, Estoque e Controler definem o perfil de acesso. */
export type SetorCadastro = Setor | 'APONTADOR' | 'ESTOQUE' | 'CONTROLER';

export type StatusServico =
  | 'EM_EXECUCAO'
  | 'PARADO_CRITICO'
  | 'AGUARDANDO_INSUMO'
  | 'SERVICO_DEMORADO'
  | 'MANUTENCAO_PREVENTIVA'
  | 'SERVICO_EXTERNO'
  | 'FINALIZADO'
  | 'CONCLUIDO';

export interface Garagem {
  id: string;
  nome: string;
  estado: string;
  rotulo?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  matricula: string;
  role: Role;
  setor?: Setor | null;
  especialidade?: string | null;
  garagemId?: string | null;
  garagem?: Garagem | null;
}

export interface Veiculo {
  id: string;
  numero: string;
  dataEntrada?: string | null;
  numeroOs?: string | null;
  garagemId?: string | null;
  garagem?: Garagem | null;
  /** Horário previsto de saída da oficina (fonte externa). */
  horaSaida?: string | null;
  /** True se o veículo já teve ao menos um serviço finalizado (quadro). */
  temServicoExecutado?: boolean;
  /** True se algum serviço do veículo já foi assumido ou passou por aguardando peça. */
  atendimentoIniciado?: boolean;
}

export interface OrdemServico {
  id: string;
  numero: number;
  veiculo: Veiculo;
  dataAbertura: string;
  dataFechamento?: string | null;
}

export interface ProfissionalResumo {
  id: string;
  nome: string;
  matricula: string;
  setor?: Setor | null;
}

export interface SolicitacaoInsumo {
  id: string;
  descricao: string;
  quantidade?: number;
  posicao?: string | null;
  atendido: boolean;
  aguardarPeca?: boolean;
  solicitadoPor?: ProfissionalResumo | null;
  createdAt: string;
  updatedAt?: string;
}

export interface HistoricoInsumo extends SolicitacaoInsumo {
  servico: Servico;
}

export interface ServicoParticipante {
  id: string;
  profissionalId: string;
  profissional?: ProfissionalResumo | null;
  horaAssumido: string;
  horaInicio?: string | null;
  horaTermino?: string | null;
  pausadoEm?: string | null;
  minutosPausadosAcum?: number;
  obs?: string | null;
  correcao?: string | null;
  tempoTotalMin?: number | null;
}

export type TipoChecklist = 'REVISAO_PREVENTIVA' | 'CHECKLIST_15000';

export interface ServicoChecklistItem {
  id: string;
  setor: Setor;
  ordem: number;
  descricao: string;
  quantidade: number;
  conferido: boolean;
  conferidoEm?: string | null;
}

export interface Servico {
  id: string;
  setor: Setor;
  tipoChecklist?: TipoChecklist | null;
  descricao: string;
  localExterno?: string | null;
  status: StatusServico;
  veiculo: Veiculo;
  ordemServico?: OrdemServico | null;
  numeroOs?: string | null;
  horaOs?: string | null;
  profissional?: ProfissionalResumo | null;
  finalizadoPor?: ProfissionalResumo | null;
  participantes?: ServicoParticipante[];
  horaAssumido?: string | null;
  horaInicio?: string | null;
  horaTermino?: string | null;
  tempoTotalMin?: number | null;
  pausadoEm?: string | null;
  minutosPausadosAcum?: number;
  correcao?: string | null;
  correcaoAudio?: string | null;
  fotoAntes?: string | null;
  fotoDepois?: string | null;
  insumos?: SolicitacaoInsumo[];
  checklistItens?: ServicoChecklistItem[];
  createdAt: string;
}

export const SETOR_LABELS: Record<Setor, string> = {
  MEC: 'Mecânica',
  ELE: 'Elétrica',
  LANT: 'Lanternagem',
  PINT: 'Pintura',
  REFR: 'Refrigeração',
  BORR: 'Borracharia',
  LIMP: 'Limpeza',
  OUTRO: 'Revisão',
  PENDENTE: 'A definir',
  APS: 'Revisão Anápolis',
  CGB: 'Revisão Cuiabá',
};

export const SETOR_PREFIX: Record<Setor, string> = {
  MEC: '[MEC]',
  ELE: '[ELET]',
  LANT: '[LANT]',
  PINT: '[PINT]',
  REFR: '[REFR]',
  BORR: '[BORR]',
  LIMP: '[LIMP]',
  OUTRO: '[REV]',
  PENDENTE: '[MOT]',
  APS: '[APS]',
  CGB: '[CGB]',
};

/** Cores por setor: MEC/BORR laranja, ELE azul, REFR vermelho, LANT/PINT verde, LIMP roxo. */
export const SETOR_CORES: Record<
  Setor,
  { badge: string; chip: string; select: string; profissional: string }
> = {
  MEC: {
    badge: 'text-orange-400',
    chip: 'bg-orange-500 text-white',
    select: 'text-orange-600',
    profissional: 'bg-orange-500 text-white',
  },
  BORR: {
    badge: 'text-orange-400',
    chip: 'bg-orange-500 text-white',
    select: 'text-orange-600',
    profissional: 'bg-orange-500 text-white',
  },
  ELE: {
    badge: 'text-blue-400',
    chip: 'bg-blue-600 text-white',
    select: 'text-blue-600',
    profissional: 'bg-blue-600 text-white',
  },
  REFR: {
    badge: 'text-red-400',
    chip: 'bg-red-600 text-white',
    select: 'text-red-600',
    profissional: 'bg-red-600 text-white',
  },
  LANT: {
    badge: 'text-green-400',
    chip: 'bg-green-600 text-white',
    select: 'text-green-600',
    profissional: 'bg-green-600 text-white',
  },
  PINT: {
    badge: 'text-green-400',
    chip: 'bg-green-600 text-white',
    select: 'text-green-600',
    profissional: 'bg-green-600 text-white',
  },
  LIMP: {
    badge: 'text-purple-400',
    chip: 'bg-purple-600 text-white',
    select: 'text-purple-600',
    profissional: 'bg-purple-600 text-white',
  },
  OUTRO: {
    badge: 'text-slate-400',
    chip: 'bg-slate-600 text-white',
    select: 'text-slate-600',
    profissional: 'bg-slate-600 text-white',
  },
  APS: {
    badge: 'text-amber-400',
    chip: 'bg-amber-600 text-white',
    select: 'text-amber-600',
    profissional: 'bg-amber-600 text-white',
  },
  CGB: {
    badge: 'text-cyan-400',
    chip: 'bg-cyan-600 text-white',
    select: 'text-cyan-600',
    profissional: 'bg-cyan-600 text-white',
  },
  PENDENTE: {
    badge: 'text-slate-400',
    chip: 'bg-slate-500 text-white',
    select: 'text-slate-500',
    profissional: 'bg-slate-500 text-white',
  },
};

export const SETORES_CADASTRO: SetorCadastro[] = [
  'MEC',
  'ELE',
  'LANT',
  'PINT',
  'REFR',
  'BORR',
  'LIMP',
  'CONTROLER',
  'APONTADOR',
  'ESTOQUE',
];

export function labelSetorCadastro(setor: SetorCadastro): string {
  if (setor === 'APONTADOR') return 'Apontador — Administrador';
  if (setor === 'ESTOQUE') return 'Estoque';
  if (setor === 'CONTROLER') return 'Controler — Serviços externos';
  return `${SETOR_PREFIX[setor]} ${SETOR_LABELS[setor]}`;
}

export function setorCadastroExigeGaragem(setor: SetorCadastro): boolean {
  return setor !== 'APONTADOR' && setor !== 'ESTOQUE' && setor !== 'CONTROLER';
}

export function destinoPosCadastro(tipo: TipoCadastro, setor?: SetorCadastro): string {
  if (tipo === 'GERENCIA') return '/gerencia';
  if (setor === 'APONTADOR') return '/admin';
  if (setor === 'ESTOQUE') return '/estoque';
  return '/profissional';
}

export const STATUS_LABELS: Record<StatusServico, string> = {
  EM_EXECUCAO: 'Corretiva',
  PARADO_CRITICO: 'Parado Crítico',
  AGUARDANDO_INSUMO: 'Aguardando Peça',
  SERVICO_DEMORADO: 'Serviço Demorado',
  MANUTENCAO_PREVENTIVA: 'Revisão Preventiva',
  SERVICO_EXTERNO: 'Serviço Externo',
  FINALIZADO: 'Finalizado',
  CONCLUIDO: 'Concluído',
};

export const STATUS_COLORS: Record<StatusServico, { bg: string; text: string }> = {
  EM_EXECUCAO: { bg: 'bg-white', text: 'text-slate-900' },
  PARADO_CRITICO: { bg: 'bg-red-600', text: 'text-white' },
  AGUARDANDO_INSUMO: { bg: 'bg-yellow-400', text: 'text-slate-900' },
  SERVICO_DEMORADO: { bg: 'bg-violet-300', text: 'text-slate-900' },
  MANUTENCAO_PREVENTIVA: { bg: 'bg-sky-400', text: 'text-slate-900' },
  SERVICO_EXTERNO: { bg: 'bg-green-600', text: 'text-white' },
  FINALIZADO: { bg: 'bg-green-600', text: 'text-white' },
  CONCLUIDO: { bg: 'bg-emerald-800', text: 'text-white' },
};

/** Status que o administrador pode atribuir (seções do quadro). */
export const STATUS_SECAO_ADMIN: StatusServico[] = [
  'SERVICO_EXTERNO',
  'AGUARDANDO_INSUMO',
  'SERVICO_DEMORADO',
  'MANUTENCAO_PREVENTIVA',
  'EM_EXECUCAO',
];
