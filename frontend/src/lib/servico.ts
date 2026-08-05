import type { ProfissionalResumo, Servico, Setor } from '../types';
import { SETOR_PREFIX } from '../types';

export function veiculoNumero(s: Servico): string {
  return s.veiculo?.numero ?? s.ordemServico?.veiculo?.numero ?? '—';
}

export function numeroOsExibicao(s: Servico): string {
  if (s.numeroOs) return s.numeroOs;
  if (s.ordemServico?.numero) return String(s.ordemServico.numero);
  return '—';
}

export function numeroOsValor(s: Servico): string {
  return s.numeroOs ?? '';
}

export function horaOsExibicao(s: Servico): string {
  if (!s.horaOs) return '—';
  return new Date(s.horaOs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function horaOsValor(s: Servico): string {
  if (!s.horaOs) return '';
  const d = new Date(s.horaOs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function insumosPecaPendentesDoServico(servico: Servico) {
  return (servico.insumos ?? []).filter((i) => i.aguardarPeca && !i.atendido);
}

/** Garante o prefixo AGUARDANDO na descrição da peça (quadro / admin). */
export function garantirPrefixoAguardando(descricao: string): string {
  const texto = descricao.trim().toUpperCase();
  if (!texto) return '';
  if (texto.startsWith('AGUARDANDO')) return texto;
  return `AGUARDANDO ${texto}`;
}

/** Peças pendentes (aguardarPeca) do próprio serviço — mesma regra da tela ADM. */
export function textoAguardandoPecaPendente(servico: Servico): string {
  const pendentes = insumosPecaPendentesDoServico(servico)
    .map((i) => garantirPrefixoAguardando(i.descricao))
    .filter(Boolean);
  return pendentes.join(' / ');
}

/**
 * Texto completo para o Quadro TV na seção Aguardando Peça.
 * Ex.: "AGUARDANDO BOMBA DO ARLA - JOAO"
 */
export function textoAguardandoPecaQuadro(servico: Servico): string {
  const peca = textoAguardandoPecaPendente(servico);
  const nome = nomeProfissionalSolicitouPeca(servico);
  if (peca && nome) return `${peca} - ${nome}`;
  if (peca) return peca;
  if (nome) return `AGUARDANDO - ${nome}`;
  return '';
}

/** Profissional que solicitou peça pendente neste serviço (não propaga para outros do veículo). */
export function profissionalSolicitouPeca(servico: Servico): ProfissionalResumo | null {
  for (const insumo of insumosPecaPendentesDoServico(servico)) {
    if (insumo.solicitadoPor) return insumo.solicitadoPor;
  }
  return null;
}

export function nomeProfissionalSolicitouPeca(servico: Servico): string {
  const nome = profissionalSolicitouPeca(servico)?.nome;
  if (!nome) return '';
  return nome.split(' ')[0]?.toUpperCase() ?? '';
}

export function nomeCompletoProfissionalSolicitouPeca(servico: Servico): string {
  return profissionalSolicitouPeca(servico)?.nome ?? '';
}

/**
 * Código de insumo: prefixo alfabético + 6 dígitos (ex. SUSP000001).
 * Se já estiver no padrão, mantém; senão completa zeros à esquerda da parte numérica.
 */
export function formatInsumoCodigo(valor: string): string {
  const texto = valor.trim().toUpperCase();
  if (!texto) return texto;

  const match = texto.match(/^([A-Z]+)(\d+)$/);
  if (!match) return texto;

  const [, prefixo, numeros] = match;
  if (numeros.length === 6) return `${prefixo}${numeros}`;
  if (numeros.length > 6) return `${prefixo}${numeros}`;

  return `${prefixo}${numeros.padStart(6, '0')}`;
}

export function textoInsumoExibicao(
  descricao: string,
  quantidade = 1,
  posicao?: string | null,
): string {
  const codigo = formatInsumoCodigo(descricao);
  const base = quantidade <= 1 ? codigo : `${codigo} × ${quantidade}`;
  const pos = posicao?.trim().toUpperCase();
  return pos ? `${base} [${pos}]` : base;
}

export function servicoPausado(servico: Servico): boolean {
  return Boolean(servico.pausadoEm);
}

/** Revisão preventiva multi-profissional (setor REV / OUTRO). */
export function isPreventivaRev(servico: Pick<Servico, 'status' | 'setor'>): boolean {
  return servico.status === 'MANUTENCAO_PREVENTIVA' && servico.setor === 'OUTRO';
}

export const TEXTO_REVISAO_PREVENTIVA = 'REVISÃO PREVENTIVA';
export const TEXTO_TESTE_POS_REVISAO = 'TESTE POS REVISÃO';

/** Setores que participam da revisão preventiva no quadro. */
export const SETORES_PREVENTIVA: Setor[] = ['MEC', 'ELE', 'REFR', 'LANT', 'PINT', 'BORR'];

/** Texto da célula no quadro/admin: preventiva ou teste pós revisão. */
export function textoPreventivaRev(servico: Pick<Servico, 'status' | 'setor' | 'descricao' | 'participantes'>): string {
  if (!isPreventivaRev(servico)) return servico.descricao;
  const d = (servico.descricao ?? '').trim().toUpperCase();
  if (d.includes('TESTE POS')) return TEXTO_TESTE_POS_REVISAO;

  const todos = servico.participantes ?? [];
  const temAtivo = todos.some((p) => !p.horaTermino);
  if (!temAtivo) {
    const setoresOk = SETORES_PREVENTIVA.every((setor) =>
      todos.some((p) => p.profissional?.setor === setor && Boolean(p.horaTermino)),
    );
    if (setoresOk) return TEXTO_TESTE_POS_REVISAO;
  }

  return TEXTO_REVISAO_PREVENTIVA;
}

export function participantesAtivos(servico: Servico) {
  return (servico.participantes ?? []).filter((p) => !p.horaTermino);
}

export type BadgePreventivaQuadro =
  | { tipo: 'setor'; key: string; setor: Setor }
  | {
      tipo: 'profissional';
      key: string;
      setor: Setor;
      nome: string;
      pausadoEm?: string | null;
      obs?: string | null;
      profissionalId: string;
    };

/**
 * Quadro TV — por setor da preventiva:
 * - pendente → chip do setor
 * - assumido → badge com o nome
 * - concluído → some
 * Em TESTE POS REVISÃO → lista vazia (só o texto).
 */
export function badgesPreventivaQuadro(servico: Servico): BadgePreventivaQuadro[] {
  if (!isPreventivaRev(servico)) return [];
  if (textoPreventivaRev(servico) === TEXTO_TESTE_POS_REVISAO) return [];

  const todos = servico.participantes ?? [];
  const badges: BadgePreventivaQuadro[] = [];

  for (const setor of SETORES_PREVENTIVA) {
    const doSetor = todos.filter((p) => p.profissional?.setor === setor);
    const ativos = doSetor.filter((p) => !p.horaTermino);
    const concluiu = doSetor.some((p) => Boolean(p.horaTermino));

    if (ativos.length > 0) {
      for (const p of ativos) {
        const nomeCompleto = p.profissional?.nome?.trim() ?? '';
        const nome = nomeCompleto.split(/\s+/)[0]?.toUpperCase() || SETOR_PREFIX[setor];
        badges.push({
          tipo: 'profissional',
          key: p.id,
          setor,
          nome,
          pausadoEm: p.pausadoEm,
          obs: p.obs,
          profissionalId: p.profissionalId,
        });
      }
      continue;
    }

    if (!concluiu) {
      badges.push({ tipo: 'setor', key: `setor-${setor}`, setor });
    }
  }

  return badges;
}

/** @deprecated Preferir badgesPreventivaQuadro no quadro TV. */
export function participantesExibicao(servico: Servico) {
  const todos = servico.participantes ?? [];
  const ativos = todos.filter((p) => !p.horaTermino);
  return ativos.length > 0 ? ativos : todos;
}

/** Peças pendentes solicitadas por um profissional neste serviço (sem nome). */
export function textosPecaPendenteDoProfissional(
  servico: Servico,
  profissionalId: string,
): string[] {
  return insumosPecaPendentesDoServico(servico)
    .filter((i) => i.solicitadoPor?.id === profissionalId)
    .map((i) => garantirPrefixoAguardando(i.descricao))
    .filter(Boolean);
}

/** Peças pendentes sem solicitante vinculado a participante ativo. */
export function textosPecaPendenteOrfas(servico: Servico): string[] {
  const ativosIds = new Set(participantesAtivos(servico).map((p) => p.profissionalId));
  return insumosPecaPendentesDoServico(servico)
    .filter((i) => !i.solicitadoPor?.id || !ativosIds.has(i.solicitadoPor.id))
    .map((i) => garantirPrefixoAguardando(i.descricao))
    .filter(Boolean);
}

/** OBS da participação ativa do profissional logado (revisão preventiva). */
export function obsParticipacaoAtual(servico: Servico, profissionalId?: string | null): string {
  if (!profissionalId) return '';
  const p = participantesAtivos(servico).find((x) => x.profissionalId === profissionalId);
  return p?.obs?.trim() ?? '';
}

/** Tempo ativo em minutos (desconta pausas). Usa tempoTotalMin se já finalizado. */
export function tempoServicoAtivoMin(servico: Servico, agora = new Date()): number | null {
  if (servico.tempoTotalMin != null) return servico.tempoTotalMin;
  if (!servico.horaInicio) return null;
  const inicio = new Date(servico.horaInicio).getTime();
  let min = Math.round((agora.getTime() - inicio) / 60000);
  min -= servico.minutosPausadosAcum ?? 0;
  if (servico.pausadoEm) {
    min -= Math.round((agora.getTime() - new Date(servico.pausadoEm).getTime()) / 60000);
  }
  return Math.max(0, min);
}
