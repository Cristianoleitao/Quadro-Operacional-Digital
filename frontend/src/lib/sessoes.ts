import type { Usuario } from '../types';

const CHAVE_ABA = 'quadro-token';
const CHAVE_CONTAS = 'quadro-sessoes';
const CHAVE_LEGADA = 'token';

interface SessaoGuardada {
  token: string;
  usuario: Usuario;
}

function lerMapa(): Record<string, SessaoGuardada> {
  try {
    const bruto = localStorage.getItem(CHAVE_CONTAS);
    if (!bruto) return {};
    const valor = JSON.parse(bruto) as Record<string, SessaoGuardada>;
    if (!valor || typeof valor !== 'object') return {};
    return valor;
  } catch {
    return {};
  }
}

function gravarMapa(mapa: Record<string, SessaoGuardada>) {
  localStorage.setItem(CHAVE_CONTAS, JSON.stringify(mapa));
}

/** Token só desta aba. Não lê o token compartilhado das outras abas. */
export function tokenDaAba(): string | null {
  try {
    const atual = sessionStorage.getItem(CHAVE_ABA);
    if (atual) return atual;

    const legado = localStorage.getItem(CHAVE_LEGADA);
    if (!legado) return null;
    sessionStorage.setItem(CHAVE_ABA, legado);
    localStorage.removeItem(CHAVE_LEGADA);
    return legado;
  } catch {
    return null;
  }
}

export function listarContas(): Usuario[] {
  return Object.values(lerMapa())
    .map((sessao) => sessao.usuario)
    .filter((usuario) => usuario?.id)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function guardarConta(token: string, usuario: Usuario) {
  sessionStorage.setItem(CHAVE_ABA, token);
  const mapa = lerMapa();
  mapa[usuario.id] = { token, usuario };
  gravarMapa(mapa);
  localStorage.removeItem(CHAVE_LEGADA);
}

export function usarTokenNaAba(token: string) {
  sessionStorage.setItem(CHAVE_ABA, token);
}

export function tokenDaConta(usuarioId: string): string | null {
  return lerMapa()[usuarioId]?.token ?? null;
}

/** Encerra só a conta desta aba. As outras contas do navegador permanecem. */
export function esquecerAba() {
  const token = sessionStorage.getItem(CHAVE_ABA);
  sessionStorage.removeItem(CHAVE_ABA);
  localStorage.removeItem(CHAVE_LEGADA);
  if (!token) return;

  const mapa = lerMapa();
  for (const [id, sessao] of Object.entries(mapa)) {
    if (sessao.token === token) delete mapa[id];
  }
  gravarMapa(mapa);
}

export function removerConta(usuarioId: string) {
  const mapa = lerMapa();
  delete mapa[usuarioId];
  gravarMapa(mapa);
}
