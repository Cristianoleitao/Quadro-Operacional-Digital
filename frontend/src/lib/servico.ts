import type { ProfissionalResumo, Servico } from '../types';

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

/** Peças pendentes (aguardarPeca) do próprio serviço — mesma regra da tela ADM. */
export function textoAguardandoPecaPendente(servico: Servico): string {
  const pendentes = insumosPecaPendentesDoServico(servico)
    .map((i) => i.descricao.trim())
    .filter(Boolean);
  return pendentes.join(' / ');
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

export function textoInsumoExibicao(descricao: string, quantidade = 1): string {
  const codigo = formatInsumoCodigo(descricao);
  if (quantidade <= 1) return codigo;
  return `${codigo} × ${quantidade}`;
}
