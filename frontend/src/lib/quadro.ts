import type { Servico, Setor, StatusServico, Veiculo } from '../types';
import { veiculoNumero, numeroOsExibicao } from './servico';

export const SETOR_QUADRO: Record<Setor, string> = {
  MEC: 'MEC',
  ELE: 'ELET',
  LANT: 'LANT',
  PINT: 'PINT',
  REFR: 'AR',
  BORR: 'BORR',
  LIMP: 'LIMP',
  OUTRO: 'REV',
};

export interface SecaoQuadro {
  id: string;
  titulo: string;
  descHeader: string;
  statuses: StatusServico[];
  headerClass: string;
  headerTextClass: string;
  rowClass: string;
  rowTextClass: string;
}

export const SECOES_QUADRO: SecaoQuadro[] = [
  {
    id: 'externo',
    titulo: 'SERVIÇO EXTERNO',
    descHeader: 'SERVIÇO EXTERNO',
    statuses: ['SERVICO_EXTERNO'],
    headerClass: 'bg-black',
    headerTextClass: 'text-white',
    rowClass: 'bg-[#00B050]',
    rowTextClass: 'text-white',
  },
  {
    id: 'aguardando',
    titulo: 'AGUARDANDO PEÇA',
    descHeader: 'AGUARDANDO PEÇA',
    statuses: ['AGUARDANDO_INSUMO'],
    headerClass: 'bg-black',
    headerTextClass: 'text-white',
    rowClass: 'bg-[#FFFF00]',
    rowTextClass: 'text-black',
  },
  {
    id: 'demorado',
    titulo: 'SERVIÇO DEMORADO / TESTE',
    descHeader: 'SERVIÇO DEMORADO / TESTE',
    statuses: ['SERVICO_DEMORADO'],
    headerClass: 'bg-black',
    headerTextClass: 'text-white',
    rowClass: 'bg-[#D4BBFF]',
    rowTextClass: 'text-black',
  },
  {
    id: 'preventiva',
    titulo: 'REVISÃO PREVENTIVA',
    descHeader: 'REVISÃO PREVENTIVA',
    statuses: ['MANUTENCAO_PREVENTIVA'],
    headerClass: 'bg-black',
    headerTextClass: 'text-white',
    rowClass: 'bg-[#00B0F0]',
    rowTextClass: 'text-black',
  },
  {
    id: 'corretiva',
    titulo: 'CORRETIVA',
    descHeader: 'CORRETIVA',
    statuses: ['EM_EXECUCAO', 'PARADO_CRITICO'],
    headerClass: 'bg-black',
    headerTextClass: 'text-white',
    rowClass: 'bg-white',
    rowTextClass: 'text-black',
  },
];

export function tituloSecaoServico(status: StatusServico): string {
  return SECOES_QUADRO.find((s) => s.statuses.includes(status))?.titulo ?? status;
}

export function formatDataQuadro(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function formatHoraQuadro(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}H${m}`;
}

export function profissionalColuna(servico: Servico, coluna: 'MEC' | 'ELET' | 'LANT' | 'BORR'): string {
  if (!servico.profissional) return '';
  const primeiroNome = servico.profissional.nome.split(' ')[0]?.toUpperCase() ?? '';
  const { setor } = servico;

  switch (coluna) {
    case 'MEC':
      return setor === 'MEC' ? primeiroNome : '';
    case 'ELET':
      return setor === 'ELE' || setor === 'REFR' ? primeiroNome : '';
    case 'LANT':
      return setor === 'LANT' || setor === 'PINT' ? primeiroNome : '';
    case 'BORR':
      return setor === 'BORR' ? primeiroNome : '';
    default:
      return '';
  }
}

export function linhaRowClass(servico: Servico, secao: SecaoQuadro): string {
  if (servico.status === 'PARADO_CRITICO') {
    return 'bg-[#FF0000] text-white';
  }
  return `${secao.rowClass} ${secao.rowTextClass}`;
}

export interface LinhaVeiculoQuadro {
  veiculo: string;
  veiculoId: string;
  veiculoRef: Veiculo;
  servicos: Servico[];
}

export function linhaVeiculoRowClass(servicos: Servico[], secao: SecaoQuadro): string {
  if (servicos.some((s) => s.status === 'PARADO_CRITICO')) {
    return 'bg-[#FF0000] text-white';
  }
  return `${secao.rowClass} ${secao.rowTextClass}`;
}


function horaOrdenacaoVeiculo(veiculo: Veiculo, servicos: Servico[]): number {
  const src = veiculo.dataEntrada ?? servicos[0]?.createdAt;
  if (!src) return 0;
  return new Date(src).getTime();
}

export function agruparVeiculosNaSecao(itens: Servico[], secaoId?: string): LinhaVeiculoQuadro[] {
  const porVeiculo = new Map<string, Servico[]>();

  for (const servico of itens) {
    const chave = servico.veiculo.id;
    const lista = porVeiculo.get(chave) ?? [];
    lista.push(servico);
    porVeiculo.set(chave, lista);
  }

  const linhas = Array.from(porVeiculo.entries()).map(([, servicos]) => ({
    veiculo: veiculoNumero(servicos[0]),
    veiculoId: servicos[0].veiculo.id,
    veiculoRef: servicos[0].veiculo,
    servicos: servicos.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  }));

  if (secaoId === 'corretiva') {
    return linhas.sort((a, b) => {
      const diff = horaOrdenacaoVeiculo(a.veiculoRef, a.servicos) - horaOrdenacaoVeiculo(b.veiculoRef, b.servicos);
      if (diff !== 0) return diff;
      return a.veiculo.localeCompare(b.veiculo, 'pt-BR', { numeric: true });
    });
  }

  return linhas.sort((a, b) => a.veiculo.localeCompare(b.veiculo, 'pt-BR', { numeric: true }));
}

/** Prioridade da seção do veículo quando há serviços abertos com status diferentes. */
const ORDEM_PRIORIDADE_SECAO_VEICULO = [
  'aguardando',
  'externo',
  'demorado',
  'preventiva',
  'corretiva',
] as const;

/** Seção do veículo no quadro — prioridade: aguardando peça vence corretiva, etc. */
export function secaoDoVeiculoQuadro(servicosAbertos: Servico[]): SecaoQuadro | null {
  if (servicosAbertos.length === 0) return null;

  const statusAbertos = new Set(servicosAbertos.map((s) => s.status));

  if (statusAbertos.has('PARADO_CRITICO')) {
    return SECOES_QUADRO.find((s) => s.id === 'corretiva') ?? null;
  }

  for (const secaoId of ORDEM_PRIORIDADE_SECAO_VEICULO) {
    const secao = SECOES_QUADRO.find((s) => s.id === secaoId);
    if (secao?.statuses.some((st) => statusAbertos.has(st))) {
      return secao;
    }
  }

  return null;
}

/**
 * Organiza o quadro: um carro = uma linha, todos os serviços abertos na mesma célula.
 * O carro aparece na seção de maior prioridade entre os status abertos (ex.: aguardando peça).
 */
export function organizarQuadroPorSecao(
  servicos: Servico[],
): Array<{ secao: SecaoQuadro; linhas: LinhaVeiculoQuadro[] }> {
  const porVeiculo = new Map<string, Servico[]>();

  for (const servico of servicos) {
    const id = servico.veiculo.id;
    const lista = porVeiculo.get(id) ?? [];
    lista.push(servico);
    porVeiculo.set(id, lista);
  }

  const gruposVeiculo: LinhaVeiculoQuadro[] = [];

  for (const lista of porVeiculo.values()) {
    const ordenados = [...lista].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const abertos = ordenados.filter(
      (s) => s.status !== 'FINALIZADO' && s.status !== 'CONCLUIDO',
    );
    if (abertos.length === 0) continue;

    gruposVeiculo.push({
      veiculo: veiculoNumero(ordenados[0]),
      veiculoId: ordenados[0].veiculo.id,
      veiculoRef: ordenados[0].veiculo,
      servicos: abertos,
    });
  }

  return SECOES_QUADRO.map((secao) => {
    let linhas = gruposVeiculo.filter((g) => secaoDoVeiculoQuadro(g.servicos)?.id === secao.id);

    if (secao.id === 'corretiva') {
      linhas = [...linhas].sort((a, b) => {
        const diff =
          horaOrdenacaoVeiculo(a.veiculoRef, a.servicos) -
          horaOrdenacaoVeiculo(b.veiculoRef, b.servicos);
        if (diff !== 0) return diff;
        return a.veiculo.localeCompare(b.veiculo, 'pt-BR', { numeric: true });
      });
    } else {
      linhas = [...linhas].sort((a, b) =>
        a.veiculo.localeCompare(b.veiculo, 'pt-BR', { numeric: true }),
      );
    }

    return { secao, linhas };
  }).filter((g) => g.linhas.length > 0);
}

export function nomeProfissionalQuadro(servico: Servico): string {
  if (!servico.profissional?.nome) return '';
  return servico.profissional.nome.split(' ')[0]?.toUpperCase() ?? '';
}

export function contarLinhasVeiculo(
  grupos: Array<{ secao: SecaoQuadro; linhas: LinhaVeiculoQuadro[] }>,
): number {
  return grupos.reduce((total, grupo) => total + grupo.linhas.length, 0);
}

/** Capacidade visual alvo do quadro em TV (~40 carros na tela). */
export const CAPACIDADE_ALVO_CARROS = 40;

/** Carros de referência — tamanho/legibilidade base (~20 carros na tela). */
export const CARROS_BASE_QUADRO = 20;

/** Faixas de seção consideradas no layout base. */
const FAIXAS_BASE_QUADRO = 5;

/** Linhas visuais no layout base: cabeçalho + faixas + carros. */
export const LINHAS_BASE_QUADRO = 1 + FAIXAS_BASE_QUADRO + CARROS_BASE_QUADRO;

/** Escala máxima no modo compacto (> base carros). */
const FATOR_ESCALA_MAX_COMPACTO = 1;

/** Ajuste fino ao reduzir escala (legibilidade sem estourar a área). */
const FATOR_ESCALA_LEGIBILIDADE = 1.04;

export type EscalaLegibilidade = 'grande' | 'media' | 'compacta' | 'tv';

export function contarLinhasVisuaisQuadro(
  grupos: Array<{ secao: SecaoQuadro; linhas: LinhaVeiculoQuadro[] }>,
): { carros: number; faixasSecao: number; linhasVisuais: number } {
  const carros = contarLinhasVeiculo(grupos);
  const faixasSecao = grupos.length;
  return {
    carros,
    faixasSecao,
    linhasVisuais: 1 + faixasSecao + carros,
  };
}

export interface ResultadoEscalaQuadro {
  fator: number;
}

/**
 * Poucos carros e conteúdo cabe na tela: escala 1, tamanho natural (sem esticar).
 * Conteúdo alto ou muitos carros: reduz escala para caber tudo.
 */
export function calcularFatorEscalaQuadro(
  alturaArea: number,
  alturaConteudo: number,
  carros: number,
): ResultadoEscalaQuadro {
  if (alturaConteudo <= 0 || alturaArea <= 0) {
    return { fator: 1 };
  }

  const precisaEncolher =
    carros > CARROS_BASE_QUADRO || alturaConteudo > alturaArea + 1;

  if (!precisaEncolher) {
    return { fator: 1 };
  }

  const fatorBruto = alturaArea / alturaConteudo;
  const fator = Number.isFinite(fatorBruto)
    ? Math.max(0.12, Math.min(fatorBruto * FATOR_ESCALA_LEGIBILIDADE, FATOR_ESCALA_MAX_COMPACTO))
    : 1;

  return { fator };
}

export interface LayoutEscalaQuadro {
  fator: number;
  larguraPx: number;
}

/**
 * Calcula escala para caber na área da TV. Com poucos carros, mantém tamanho natural.
 */
export function medirLayoutEscalaQuadro(
  area: HTMLElement,
  table: HTMLTableElement,
  carros: number,
): LayoutEscalaQuadro | null {
  const alturaArea = area.clientHeight;
  const larguraArea = area.clientWidth;
  if (alturaArea <= 0 || larguraArea <= 0) return null;
  if (table.offsetHeight <= 0) return null;

  let { fator } = calcularFatorEscalaQuadro(alturaArea, table.offsetHeight, carros);

  const larguraPx = fator < 1 ? larguraArea / fator : larguraArea;

  return {
    fator,
    larguraPx: Number.isFinite(larguraPx) && larguraPx > 0 ? larguraPx : larguraArea,
  };
}

export const ESTILO_ESCALA: Record<
  EscalaLegibilidade,
  {
    tituloSecao: string;
    th: string;
    thServico: string;
    td: string;
    tdCarro: string;
    tdServico: string;
    separador: string;
  }
> = {
  grande: {
    tituloSecao: 'px-3 py-2 text-base',
    th: 'px-2 py-1.5 text-xs',
    thServico: 'px-2 py-1.5 text-xs',
    td: 'px-1.5 py-2 text-sm',
    tdCarro: 'text-lg font-black tracking-tight',
    tdServico: 'px-2 py-2 text-base leading-snug',
    separador: 'mx-1.5 text-base opacity-60',
  },
  media: {
    tituloSecao: 'px-2 py-1.5 text-sm',
    th: 'px-1.5 py-1 text-[11px]',
    thServico: 'px-1.5 py-1 text-[11px]',
    td: 'px-1 py-1.5 text-xs',
    tdCarro: 'text-base font-black',
    tdServico: 'px-1.5 py-1.5 text-sm leading-snug',
    separador: 'mx-1 text-sm opacity-60',
  },
  compacta: {
    tituloSecao: 'px-1.5 py-0.5 text-[10px] leading-tight',
    th: 'px-1 py-0.5 text-[10px] leading-tight',
    thServico: 'px-1 py-0.5 text-[10px] leading-tight',
    td: 'px-0.5 py-0.5 text-[10px] leading-tight',
    tdCarro: 'text-xs font-black leading-tight',
    tdServico: 'px-1 py-0.5 text-[10px] leading-tight',
    separador: 'mx-0.5 text-[10px] opacity-60',
  },
  tv: {
    tituloSecao: 'px-1 py-1 text-[13px] leading-tight',
    th: 'px-0.5 py-1 text-[12px] leading-tight',
    thServico: 'px-0.5 py-1 text-[12px] leading-tight',
    td: 'px-0.5 py-1 text-[12px] leading-tight',
    tdCarro: 'text-[14px] font-black leading-tight',
    tdServico: 'px-1 py-1 text-[12px] leading-snug text-left',
    separador: 'mx-0.5 text-[12px] opacity-70',
  },
};

/** Estilo base fixo do quadro TV — o ajuste de tamanho é feito só via escala contínua. */
export const ESTILO_QUADRO = ESTILO_ESCALA.tv;

function dataEntradaVeiculo(veiculo: Veiculo, servicos: Servico[]): string | null {
  return veiculo.dataEntrada ?? servicos[0]?.createdAt ?? null;
}

export function dataVeiculoQuadro(veiculo: Veiculo, servicos: Servico[]): string {
  const src = dataEntradaVeiculo(veiculo, servicos);
  if (!src) return '';
  return formatDataQuadro(src);
}

export function horaInputVeiculo(veiculo: Veiculo, servicos: Servico[]): string {
  const src = dataEntradaVeiculo(veiculo, servicos);
  if (!src) return '';
  const d = new Date(src);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function osInputVeiculo(veiculo: Veiculo): string {
  return veiculo.numeroOs?.trim() ?? '';
}

export function saidaVeiculoQuadro(veiculo: Veiculo): string {
  return formatHoraQuadro(veiculo.horaSaida);
}

/** Após este horário, saídas não disputam destaque vermelho na coluna SAÍDA (ex.: 23h). */
export const HORA_LIMITE_PRIORIDADE_SAIDA = 20;

function horaSaidaHoje(veiculo: Veiculo, agora: Date): Date | null {
  if (!veiculo.horaSaida) return null;
  const bruta = new Date(veiculo.horaSaida);
  const alvo = new Date(agora);
  alvo.setHours(bruta.getHours(), bruta.getMinutes(), 0, 0);
  return alvo;
}

/** Saída ainda no futuro e dentro do horário operacional — elegível ao destaque de prioridade. */
export function saidaElegivelPrioridade(veiculo: Veiculo, agora: Date = new Date()): boolean {
  const alvo = horaSaidaHoje(veiculo, agora);
  if (!alvo) return false;

  const h = alvo.getHours();
  const m = alvo.getMinutes();
  if (h > HORA_LIMITE_PRIORIDADE_SAIDA || (h === HORA_LIMITE_PRIORIDADE_SAIDA && m > 0)) {
    return false;
  }

  return alvo.getTime() > agora.getTime();
}

/** Veículos com a saída mais próxima entre os elegíveis (seção corretiva). */
export function idsVeiculosSaidaPrioritaria(
  linhas: LinhaVeiculoQuadro[],
  agora: Date = new Date(),
): Set<string> {
  const candidatos: Array<{ id: string; ts: number }> = [];

  for (const linha of linhas) {
    const alvo = horaSaidaHoje(linha.veiculoRef, agora);
    if (!alvo || !saidaElegivelPrioridade(linha.veiculoRef, agora)) continue;
    candidatos.push({ id: linha.veiculoId, ts: alvo.getTime() });
  }

  if (candidatos.length === 0) return new Set();

  const maisProxima = Math.min(...candidatos.map((c) => c.ts));
  return new Set(candidatos.filter((c) => c.ts === maisProxima).map((c) => c.id));
}

/** Prioridade de saída a partir de uma lista de serviços (tela do profissional). */
export function idsVeiculosSaidaPrioritariaPorServicos(
  servicos: Servico[],
  agora: Date = new Date(),
): Set<string> {
  const porVeiculo = new Map<string, Veiculo>();
  for (const servico of servicos) {
    if (!porVeiculo.has(servico.veiculo.id)) {
      porVeiculo.set(servico.veiculo.id, servico.veiculo);
    }
  }

  const candidatos: Array<{ id: string; ts: number }> = [];
  for (const [id, veiculo] of porVeiculo) {
    const alvo = horaSaidaHoje(veiculo, agora);
    if (!alvo || !saidaElegivelPrioridade(veiculo, agora)) continue;
    candidatos.push({ id, ts: alvo.getTime() });
  }

  if (candidatos.length === 0) return new Set();

  const maisProxima = Math.min(...candidatos.map((c) => c.ts));
  return new Set(candidatos.filter((c) => c.ts === maisProxima).map((c) => c.id));
}

function timestampSaidaOrdenacao(veiculo: Veiculo, agora: Date): number {
  const alvo = horaSaidaHoje(veiculo, agora);
  return alvo?.getTime() ?? Number.POSITIVE_INFINITY;
}

/** Ordena corretivas: saída prioritária primeiro, depois por horário de saída. */
export function ordenarServicosPorPrioridadeSaida(
  servicos: Servico[],
  prioridadeIds: Set<string>,
  agora: Date = new Date(),
): Servico[] {
  return [...servicos].sort((a, b) => {
    const pa = prioridadeIds.has(a.veiculo.id);
    const pb = prioridadeIds.has(b.veiculo.id);
    if (pa !== pb) return pa ? -1 : 1;

    const diffSaida =
      timestampSaidaOrdenacao(a.veiculo, agora) - timestampSaidaOrdenacao(b.veiculo, agora);
    if (diffSaida !== 0) return diffSaida;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function servicoExibeHoraSaida(status: StatusServico): boolean {
  return status === 'EM_EXECUCAO' || status === 'PARADO_CRITICO';
}

export function saidasVeiculo(servicos: Servico[]): string {
  const veiculo = servicos[0]?.veiculo;
  if (!veiculo) return '';
  return saidaVeiculoQuadro(veiculo);
}

export function agruparPorSecao(servicos: Servico[]): Array<{ secao: SecaoQuadro; itens: Servico[] }> {
  return SECOES_QUADRO.map((secao) => ({
    secao,
    itens: servicos
      .filter((s) => secao.statuses.includes(s.status))
      .sort((a, b) => {
        const va = veiculoNumero(a);
        const vb = veiculoNumero(b);
        if (va !== vb) return va.localeCompare(vb, 'pt-BR', { numeric: true });
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
  })).filter((g) => g.itens.length > 0);
}

export function mostrarVeiculoNaLinha(itens: Servico[], index: number): boolean {
  if (index === 0) return true;
  return veiculoNumero(itens[index - 1]) !== veiculoNumero(itens[index]);
}

export function osQuadro(servico: Servico): string {
  const os = numeroOsExibicao(servico);
  return os === '—' ? '' : os;
}

/** Prazo para iniciar atendimento ao veículo (em minutos). */
export const PRAZO_INICIO_VEICULO_MIN = 120;
export const ALERTA_AMARELO_VEICULO_MIN = 60;
export const ALERTA_VERMELHO_VEICULO_MIN = 90;

export type AlertaPrazoVeiculo = 'nenhum' | 'amarelo' | 'vermelho';

export function mapaServicosPorVeiculo(servicos: Servico[]): Map<string, Servico[]> {
  const map = new Map<string, Servico[]>();
  for (const servico of servicos) {
    const id = servico.veiculo.id;
    const lista = map.get(id) ?? [];
    lista.push(servico);
    map.set(id, lista);
  }
  return map;
}

export function veiculoTemServicoIniciado(
  servicosVeiculo: Servico[],
  statuses?: StatusServico[],
): boolean {
  const lista = statuses
    ? servicosVeiculo.filter((s) => statuses.includes(s.status))
    : servicosVeiculo;
  return lista.some(
    (s) =>
      Boolean(s.profissional) ||
      Boolean(s.horaAssumido) ||
      (s.participantes?.some((p) => !p.horaTermino) ?? false),
  );
}

/** Veículo já entrou em atendimento (assumido ou passou por aguardando peça). */
export function veiculoJaTeveAtendimentoIniciado(servicosVeiculo: Servico[]): boolean {
  return servicosVeiculo.some(
    (s) =>
      Boolean(s.profissional) ||
      Boolean(s.horaAssumido) ||
      Boolean(s.horaInicio) ||
      (s.participantes?.length ?? 0) > 0 ||
      (s.insumos?.some((i) => i.aguardarPeca) ?? false),
  );
}

export function minutosDesdeEntradaVeiculo(
  veiculo: Veiculo,
  servicosVeiculo: Servico[],
  agora: Date = new Date(),
): number | null {
  const entrada = dataEntradaVeiculo(veiculo, servicosVeiculo);
  if (!entrada) return null;
  return (agora.getTime() - new Date(entrada).getTime()) / 60_000;
}

export function veiculoIsentoAlertaPrazo(
  veiculo: Veiculo,
  servicosVeiculo: Servico[],
): boolean {
  if (veiculo.temServicoExecutado) return true;
  if (veiculo.atendimentoIniciado) return true;
  return veiculoJaTeveAtendimentoIniciado(servicosVeiculo);
}

export function servicoSujeitoPrazoInicio(status: StatusServico): boolean {
  return status === 'EM_EXECUCAO' || status === 'PARADO_CRITICO';
}

export function minutosRestantesPrazoInicio(
  veiculo: Veiculo,
  servicosVeiculo: Servico[],
  agora: Date = new Date(),
): number | null {
  if (veiculoIsentoAlertaPrazo(veiculo, servicosVeiculo)) return null;
  const minutos = minutosDesdeEntradaVeiculo(veiculo, servicosVeiculo, agora);
  if (minutos === null) return null;
  return Math.ceil(PRAZO_INICIO_VEICULO_MIN - minutos);
}

export interface InfoPrazoInicioProfissional {
  alerta: AlertaPrazoVeiculo;
  minutosRestantes: number | null;
  texto: string | null;
}

export function infoPrazoInicioProfissional(
  veiculo: Veiculo,
  servicosVeiculo: Servico[],
  agora: Date = new Date(),
): InfoPrazoInicioProfissional {
  const alerta = alertaPrazoVeiculo(veiculo, servicosVeiculo, agora);
  const minutosRestantes = minutosRestantesPrazoInicio(veiculo, servicosVeiculo, agora);

  if (minutosRestantes === null) {
    return { alerta: 'nenhum', minutosRestantes: null, texto: null };
  }

  let texto: string;
  if (minutosRestantes <= 0) {
    texto = 'PRAZO DE 2H ESTOURADO — ASSUMA O SERVIÇO';
  } else if (alerta === 'vermelho') {
    texto = `URGENTE — RESTAM ${minutosRestantes} MIN (PRAZO 2H)`;
  } else if (alerta === 'amarelo') {
    texto = `ATENÇÃO — RESTAM ${minutosRestantes} MIN (PRAZO 2H)`;
  } else {
    texto = `PRAZO 2H — RESTAM ${minutosRestantes} MIN`;
  }

  return { alerta, minutosRestantes, texto };
}

function prioridadeOrdenacaoPrazo(info: InfoPrazoInicioProfissional): number {
  if (info.alerta === 'vermelho') {
    return info.minutosRestantes !== null && info.minutosRestantes <= 0 ? 0 : 1;
  }
  if (info.alerta === 'amarelo') return 2;
  if (info.minutosRestantes !== null && info.minutosRestantes <= PRAZO_INICIO_VEICULO_MIN) return 3;
  return 4;
}

/** Ordena corretivas na tela do profissional: prazo 2h, depois saída prioritária. */
export function ordenarCorretivaProfissional(
  servicos: Servico[],
  servicosPorVeiculo: Map<string, Servico[]>,
  prioridadeSaidaIds: Set<string>,
  agora: Date = new Date(),
): Servico[] {
  return [...servicos].sort((a, b) => {
    const infoA = infoPrazoInicioProfissional(
      a.veiculo,
      servicosPorVeiculo.get(a.veiculo.id) ?? [a],
      agora,
    );
    const infoB = infoPrazoInicioProfissional(
      b.veiculo,
      servicosPorVeiculo.get(b.veiculo.id) ?? [b],
      agora,
    );

    const pa = prioridadeOrdenacaoPrazo(infoA);
    const pb = prioridadeOrdenacaoPrazo(infoB);
    if (pa !== pb) return pa - pb;

    const restA = infoA.minutosRestantes ?? 9999;
    const restB = infoB.minutosRestantes ?? 9999;
    if (restA !== restB) return restA - restB;

    const saidaA = prioridadeSaidaIds.has(a.veiculo.id);
    const saidaB = prioridadeSaidaIds.has(b.veiculo.id);
    if (saidaA !== saidaB) return saidaA ? -1 : 1;

    const diffSaida =
      timestampSaidaOrdenacao(a.veiculo, agora) - timestampSaidaOrdenacao(b.veiculo, agora);
    if (diffSaida !== 0) return diffSaida;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function classeBordaCardPrazoProfissional(alerta: AlertaPrazoVeiculo): string {
  switch (alerta) {
    case 'vermelho':
      return 'border-red-500 bg-red-950/40';
    case 'amarelo':
      return 'border-yellow-500 bg-yellow-950/30';
    default:
      return '';
  }
}

export function alertaPrazoVeiculo(
  veiculo: Veiculo,
  servicosVeiculo: Servico[],
  agora: Date = new Date(),
): AlertaPrazoVeiculo {
  if (veiculoIsentoAlertaPrazo(veiculo, servicosVeiculo)) return 'nenhum';

  const minutos = minutosDesdeEntradaVeiculo(veiculo, servicosVeiculo, agora);
  if (minutos === null || minutos < ALERTA_AMARELO_VEICULO_MIN) return 'nenhum';
  if (minutos < ALERTA_VERMELHO_VEICULO_MIN) return 'amarelo';
  return 'vermelho';
}

export function classeFundoPrazoVeiculo(alerta: AlertaPrazoVeiculo): string {
  const transicao = 'transition-colors duration-500';
  switch (alerta) {
    case 'amarelo':
      return `${transicao} !bg-yellow-100 text-black`;
    case 'vermelho':
      return `${transicao} !bg-red-100 text-black`;
    default:
      return '';
  }
}
