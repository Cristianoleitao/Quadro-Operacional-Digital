import type { HistoricoInsumo, Servico } from '../types';
import { STATUS_LABELS } from '../types';
import {
  numeroOsExibicao,
  textoAguardandoPecaPendente,
  textoInsumoExibicao,
  veiculoNumero,
} from './servico';

export function rotuloGaragemServico(s: Servico): string {
  if (!s.veiculo?.garagem) return '—';
  return `${s.veiculo.garagem.nome} - ${s.veiculo.garagem.estado}`;
}

export function textoCorrecaoResumo(s: Servico): string {
  const correcao = s.correcao?.trim();
  const por = s.finalizadoPor?.nome ?? s.profissional?.nome;
  if (correcao && por) return `${correcao} (${por})`;
  if (correcao) return correcao;
  if (por) return `Finalizado por ${por}`;
  return '—';
}

export function resumoInsumosServico(servico: Servico): string {
  const lista = servico.insumos ?? [];
  if (lista.length === 0) return '—';
  return lista
    .map((i) => {
      const rotulo = textoInsumoExibicao(i.descricao, i.quantidade);
      const tipo = i.aguardarPeca ? 'PEÇA' : 'INS';
      const sit = i.atendido ? 'OK' : 'PEND';
      return `${tipo}:${rotulo}[${sit}]`;
    })
    .join(' · ');
}

export function insumosOperacionaisServico(servico: Servico): string {
  const lista = (servico.insumos ?? []).filter((i) => !i.aguardarPeca);
  if (lista.length === 0) return '—';
  return lista
    .map((i) => `${textoInsumoExibicao(i.descricao, i.quantidade)}${i.atendido ? ' ✓' : ''}`)
    .join(' · ');
}

export interface LinhaInsumoHistorico {
  dataSolicitacao: string;
  dataAtendimento: string;
  veiculo: string;
  os: string;
  setorServico: string;
  servico: string;
  insumo: string;
  tipo: string;
  status: string;
  solicitadoPor: string;
  garagem: string;
}

export function linhasInsumoHistorico(insumos: HistoricoInsumo[]): LinhaInsumoHistorico[] {
  return insumos.map((i) => ({
    dataSolicitacao: new Date(i.createdAt).toLocaleString('pt-BR'),
    dataAtendimento:
      i.atendido && i.updatedAt ? new Date(i.updatedAt).toLocaleString('pt-BR') : '—',
    veiculo: veiculoNumero(i.servico),
    os: numeroOsExibicao(i.servico),
    setorServico: i.servico.setor,
    servico: i.servico.descricao,
    insumo: textoInsumoExibicao(i.descricao, i.quantidade),
    tipo: i.aguardarPeca ? 'Aguardando peça' : 'Insumo',
    status: i.atendido ? 'Atendido' : 'Pendente',
    solicitadoPor: i.solicitadoPor?.nome ?? '—',
    garagem: rotuloGaragemServico(i.servico),
  }));
}

export function textoBuscaServico(s: Servico): string {
  return [
    veiculoNumero(s),
    numeroOsExibicao(s),
    s.setor,
    s.descricao,
    s.profissional?.nome,
    STATUS_LABELS[s.status],
    rotuloGaragemServico(s),
    textoCorrecaoResumo(s),
    resumoInsumosServico(s),
    textoAguardandoPecaPendente(s),
  ]
    .join(' ')
    .toUpperCase();
}

export function textoBuscaInsumo(i: HistoricoInsumo): string {
  const linha = linhasInsumoHistorico([i])[0];
  return Object.values(linha).join(' ').toUpperCase();
}

export function formatDataBr(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function rotuloPeriodoHistorico(
  dias: number,
  dataDia: string,
  modoIntervalo: boolean,
  dataAte: string,
): string {
  if (dataDia) {
    if (modoIntervalo && dataAte && dataAte !== dataDia) {
      return `${formatDataBr(dataDia)} até ${formatDataBr(dataAte)}`;
    }
    return `Dia ${formatDataBr(dataDia)}`;
  }
  return `Últimos ${dias} dias`;
}

export function resumoEstoque(insumos: HistoricoInsumo[]) {
  const pecas = insumos.filter((i) => i.aguardarPeca);
  const operacionais = insumos.filter((i) => !i.aguardarPeca);
  return {
    total: insumos.length,
    pecas: pecas.length,
    insumos: operacionais.length,
    pendentes: insumos.filter((i) => !i.atendido).length,
    atendidos: insumos.filter((i) => i.atendido).length,
    pecasPendentes: pecas.filter((i) => !i.atendido).length,
  };
}

export type ColunaOpcionalHistorico = 'tempo' | 'insumos' | 'pecaPendente' | 'correcao';

export const COLUNAS_OPCIONAIS_HISTORICO: { id: ColunaOpcionalHistorico; label: string }[] = [
  { id: 'tempo', label: 'Tempo' },
  { id: 'insumos', label: 'Insumos / peças' },
  { id: 'pecaPendente', label: 'Peça pend.' },
  { id: 'correcao', label: 'Correção / finalização' },
];

export function profissionaisDoHistorico(
  historico: Servico[],
): Array<{ id: string; nome: string }> {
  const map = new Map<string, string>();
  for (const s of historico) {
    if (s.profissional?.id && s.profissional.nome) {
      map.set(s.profissional.id, s.profissional.nome);
    }
  }
  return Array.from(map.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function somaTempoServicos(servicos: Servico[]): {
  totalMin: number;
  servicosComTempo: number;
} {
  let totalMin = 0;
  let servicosComTempo = 0;
  for (const s of servicos) {
    if (s.tempoTotalMin != null) {
      totalMin += s.tempoTotalMin;
      servicosComTempo += 1;
    }
  }
  return { totalMin, servicosComTempo };
}
