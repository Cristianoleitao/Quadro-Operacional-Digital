import type { Usuario, Servico, Veiculo, Garagem, HistoricoInsumo } from '../types';
import { getApiBase, getWsUrl } from './config';

export { mediaUrl } from './config';

export interface ParamsHistoricoGerencia {
  dias?: number;
  garagemId?: string;
  dataDia?: string;
  dataInicio?: string;
  dataFim?: string;
  veiculo?: string;
  setor?: string;
  status?: string;
}

function qsHistoricoPeriodo(params?: ParamsHistoricoGerencia): URLSearchParams {
  const qs = new URLSearchParams();
  const usaDatas = Boolean(params?.dataDia || params?.dataInicio || params?.dataFim);
  if (params?.dataDia) qs.set('dataDia', params.dataDia);
  else {
    if (params?.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params?.dataFim) qs.set('dataFim', params.dataFim);
  }
  if (!usaDatas && params?.dias) qs.set('dias', String(params.dias));
  if (params?.garagemId) qs.set('garagemId', params.garagemId);
  return qs;
}

const API_BASE = getApiBase();

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `Erro ${res.status}`);
  }

  return res.json();
}

export interface DashboardGerencia {
  periodoDias: number;
  resumo: {
    veiculosNoQuadro: number;
    servicosAbertos: number;
    servicosEncerradosPeriodo: number;
    servicosCriadosPeriodo: number;
    tempoMedioMin: number;
    pecasSolicitadas: number;
    pecasAtendidas: number;
  };
  servicosPorSetor: Array<{ setor: string; total: number }>;
  quadroPorStatus: Array<{ status: string; rotulo: string; total: number }>;
  eventosPorAcao: Array<{ acao: string; rotulo: string; total: number }>;
  atividadePorDia: Array<{ dia: string; total: number }>;
  produtividade: Array<{
    profissional: { nome: string; setor?: string | null } | null;
    total: number;
  }>;
  exclusoesAplicadas: string[];
}

export interface Indicadores {
  totalServicos: number;
  servicosFinalizados: number;
  tempoMedioMin: number;
  produtividade: Array<{
    profissional: { nome: string; matricula: string; setor?: string } | undefined;
    totalServicos: number;
    tempoMedioMin: number;
  }>;
  veiculosMaisFalhas: Array<{ numero: string; total: number }>;
  servicosPorSetor: Array<{ setor: string; _count: { id: number } }>;
}

export interface AuditoriaResponse {
  registros: Array<{
    acao: string;
    entidade: string;
    createdAt: string;
    usuario?: { nome: string };
  }>;
  total: number;
  page: number;
}

export const api = {
  login: (matricula: string, senha: string) =>
    request<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ matricula, senha }),
    }),

  me: () => request<Usuario>('/auth/me'),

  getQuadro: (garagemId?: string) => {
    const qs = garagemId ? `?garagemId=${encodeURIComponent(garagemId)}` : '';
    return request<Servico[]>(`/servicos/quadro${qs}`);
  },

  getGaragens: () => request<Garagem[]>('/garagens'),

  criarGaragem: (nome: string, estado: string) =>
    request<Garagem>('/garagens', {
      method: 'POST',
      body: JSON.stringify({ nome, estado }),
    }),

  cadastrarUsuario: (data: {
    nome: string;
    matricula: string;
    senha: string;
    tipo: string;
    setor?: string;
    garagemId?: string;
  }) =>
    request<Usuario>('/usuarios/cadastro', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** @deprecated Use cadastrarUsuario */
  cadastrarProfissional: (data: {
    nome: string;
    matricula: string;
    senha: string;
    setor: string;
    garagemId: string;
  }) =>
    request<Usuario>('/usuarios/profissionais', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProfissionais: () =>
    request<Array<{ id: string; nome: string; matricula: string; setor?: string | null }>>(
      '/servicos/profissionais',
    ),

  atribuirProfissional: (id: string, nome: string) =>
    request<Servico>(`/servicos/${id}/profissional`, {
      method: 'PATCH',
      body: JSON.stringify({ nome }),
    }),

  atualizarLocalExterno: (id: string, local: string) =>
    request<Servico>(`/servicos/${id}/local-externo`, {
      method: 'PATCH',
      body: JSON.stringify({ local }),
    }),

  atualizarSetorServico: (id: string, setor: string) =>
    request<Servico>(`/servicos/${id}/setor`, {
      method: 'PATCH',
      body: JSON.stringify({ setor }),
    }),

  getMeusServicos: () => request<Servico[]>('/servicos/meus'),

  getEmExecucao: () => request<Servico[]>('/servicos/em-execucao'),

  getMeuHistoricoProfissional: (dias = 30) =>
    request<Servico[]>(`/servicos/meu-historico?dias=${dias}`),

  getAcompanhamento: () => request<Servico[]>('/servicos/acompanhamento'),

  getServicosEstoque: () => request<Servico[]>('/servicos/estoque'),

  cadastroRapido: (data: {
    veiculoNumero: string;
    setor: string;
    descricao: string;
    garagemId: string;
  }) =>
    request<{ servico: Servico }>('/servicos/cadastro-rapido', { method: 'POST', body: JSON.stringify(data) }),

  atualizarDadosVeiculoQuadro: (
    id: string,
    data: { data?: string; hora?: string; numeroOs?: string },
  ) =>
    request<Veiculo>(`/veiculos/${id}/dados-quadro`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  atualizarDadosTerceiros: (id: string, data: { numeroOs?: string; horaOs?: string }) =>
    request<Servico>(`/servicos/${id}/dados-terceiros`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  assumirServico: (id: string) =>
    request<Servico>(`/servicos/${id}/assumir`, { method: 'POST' }),

  liberarServico: (id: string) =>
    request<Servico>(`/servicos/${id}/liberar`, { method: 'POST' }),

  pausarServico: (id: string) =>
    request<Servico>(`/servicos/${id}/pausar`, { method: 'POST' }),

  despausarServico: (id: string) =>
    request<Servico>(`/servicos/${id}/despausar`, { method: 'POST' }),

  atualizarStatus: (id: string, status: string, descricaoPeca?: string) =>
    request<Servico>(`/servicos/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(descricaoPeca ? { descricaoPeca } : {}),
      }),
    }),

  atualizarStatusVeiculo: (
    veiculoId: string,
    status: string,
    opts?: { descricaoPeca?: string; servicoId?: string },
  ) =>
    request<{ ok: boolean; atualizados: number }>(`/servicos/veiculo/${veiculoId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(opts?.descricaoPeca ? { descricaoPeca: opts.descricaoPeca } : {}),
        ...(opts?.servicoId ? { servicoId: opts.servicoId } : {}),
      }),
    }),

  finalizarVeiculoAdmin: (veiculoId: string) =>
    request<{ ok: boolean; concluidos: number }>(`/servicos/veiculo/${veiculoId}/finalizar-admin`, {
      method: 'POST',
    }),

  excluirVeiculoAdmin: (veiculoId: string) =>
    request<{ ok: boolean; excluidos: number }>(`/servicos/veiculo/${veiculoId}`, {
      method: 'DELETE',
    }),

  solicitarInsumo: (
    id: string,
    descricao: string,
    alterarStatus = false,
    quantidade = 1,
    posicao?: string,
  ) =>
    request(`/servicos/${id}/insumos`, {
      method: 'POST',
      body: JSON.stringify({
        descricao,
        alterarStatus,
        quantidade,
        ...(posicao?.trim() ? { posicao: posicao.trim().toUpperCase() } : {}),
      }),
    }),

  atenderInsumo: (insumoId: string) =>
    request<Servico>(`/servicos/insumos/${insumoId}/atender`, { method: 'PATCH' }),

  uploadAudio: async (file: Blob) => {
    const token = getToken();
    const form = new FormData();
    form.append('audio', file, 'gravacao.webm');
    const res = await fetch(`${API_BASE}/upload/audio`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error('Erro no upload do áudio');
    return res.json() as Promise<{ url: string }>;
  },

  finalizarServico: (id: string, data: Record<string, unknown>) =>
    request<Servico>(`/servicos/${id}/finalizar`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVeiculos: () => request<Veiculo[]>('/veiculos'),

  criarVeiculo: (numero: string) =>
    request('/veiculos', { method: 'POST', body: JSON.stringify({ numero }) }),

  getIndicadores: () => request<Indicadores>('/gerencia/indicadores'),

  getDashboardGerencia: (params?: { dias?: number; garagemId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dias) qs.set('dias', String(params.dias));
    if (params?.garagemId) qs.set('garagemId', params.garagemId);
    const query = qs.toString();
    return request<DashboardGerencia>(`/gerencia/dashboard${query ? `?${query}` : ''}`);
  },

  getAuditoria: (page = 1) => request<AuditoriaResponse>(`/gerencia/auditoria?page=${page}`),

  getHistorico: (params?: ParamsHistoricoGerencia) => {
    const qs = qsHistoricoPeriodo(params);
    if (params?.veiculo) qs.set('veiculo', params.veiculo);
    if (params?.setor) qs.set('setor', params.setor);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString();
    return request<Servico[]>(`/gerencia/historico${query ? `?${query}` : ''}`);
  },

  getHistoricoInsumos: (params?: ParamsHistoricoGerencia & {
    tipo?: 'peca' | 'insumo' | 'todos';
    statusInsumo?: 'pendente' | 'atendido' | 'todos';
  }) => {
    const qs = qsHistoricoPeriodo(params);
    if (params?.tipo && params.tipo !== 'todos') qs.set('tipo', params.tipo);
    if (params?.statusInsumo && params.statusInsumo !== 'todos') {
      qs.set('status', params.statusInsumo);
    }
    const query = qs.toString();
    return request<HistoricoInsumo[]>(
      `/gerencia/historico-insumos${query ? `?${query}` : ''}`,
    );
  },

  getAuditoriaGerencia: (params?: { page?: number; limit?: number; dias?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.dias) qs.set('dias', String(params.dias));
    const query = qs.toString();
    return request<AuditoriaResponse>(`/gerencia/auditoria${query ? `?${query}` : ''}`);
  },

  uploadFoto: async (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('foto', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error('Erro no upload');
    return res.json() as Promise<{ url: string }>;
  },
};

export function connectWebSocket(onMessage: (type: string, data: unknown) => void) {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let delay = 3000;

  const connect = () => {
    if (closed) return;

    ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      delay = 3000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg.type, msg.data);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (closed) return;
      reconnectTimer = setTimeout(() => {
        delay = Math.min(delay * 1.5, 30000);
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  const waitForBackend = async () => {
    for (let i = 0; i < 10 && !closed; i++) {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
          connect();
          return;
        }
      } catch {
        // backend ainda não disponível
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!closed) connect();
  };

  waitForBackend();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
