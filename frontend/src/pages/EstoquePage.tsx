import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, connectWebSocket } from '../lib/api';
import { veiculoNumero, numeroOsExibicao, isMultiParticipante, textoPreventivaRev } from '../lib/servico';
import { useAuth } from '../context/AuthContext';
import type { Servico } from '../types';
import { BadgeSetor } from '../components/BadgeSetor';

interface GrupoVeiculoEstoque {
  veiculoId: string;
  numero: string;
  servicos: Servico[];
}

function agruparPorVeiculo(servicos: Servico[]): GrupoVeiculoEstoque[] {
  const map = new Map<string, Servico[]>();

  for (const servico of servicos) {
    const id = servico.veiculo.id;
    const lista = map.get(id) ?? [];
    lista.push(servico);
    map.set(id, lista);
  }

  return Array.from(map.entries())
    .map(([, lista]) => ({
      veiculoId: lista[0].veiculo.id,
      numero: veiculoNumero(lista[0]),
      servicos: lista.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }))
    .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
}

export default function EstoquePage() {
  const { usuario, logout } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(false);
  const [atendendo, setAtendendo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const lista = await api.getServicosEstoque();
    setServicos(lista);
  }, []);

  useEffect(() => {
    carregar().catch((err) => alert(err instanceof Error ? err.message : 'Erro ao carregar'));
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') carregar();
    });
    return () => ws.close();
  }, [carregar]);

  const grupos = useMemo(() => agruparPorVeiculo(servicos), [servicos]);

  const atenderPeca = async (insumoId: string) => {
    setAtendendo(insumoId);
    setLoading(true);
    try {
      await api.atenderInsumo(insumoId);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atender peça');
    } finally {
      setAtendendo(null);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-950 border-b border-slate-700 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Estoque</h1>
          <p className="text-slate-400 text-sm">{usuario?.nome} — Aguardando peça</p>
        </div>
        <div className="flex gap-3">
          <Link to="/quadro" className="text-blue-400 text-sm">Quadro</Link>
          <button onClick={logout} className="text-red-400 text-sm">Sair</button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {grupos.length === 0 && (
          <p className="text-center text-slate-500 py-16">Nenhum serviço aguardando peça</p>
        )}

        {grupos.map((grupo) => {
          const totalPecasPendentes = grupo.servicos.reduce(
            (n, s) =>
              n + (s.insumos ?? []).filter((i) => i.aguardarPeca && !i.atendido).length,
            0,
          );

          return (
          <section
            key={grupo.veiculoId}
            className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
          >
            <div className="bg-yellow-400 text-slate-900 px-4 py-2 flex items-center justify-between">
              <span className="font-mono font-black text-lg">Veículo {grupo.numero}</span>
              <span className="text-xs font-semibold uppercase">
                {totalPecasPendentes} peça{totalPecasPendentes !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="divide-y divide-slate-700">
              {grupo.servicos.map((s) => {
                const pecasPendentes = (s.insumos ?? []).filter(
                  (i) => i.aguardarPeca && !i.atendido,
                );

                return (
                  <div key={s.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-white font-semibold">
                          <BadgeSetor setor={s.setor} />{' '}
                          {isMultiParticipante(s) ? textoPreventivaRev(s) : s.descricao}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                          OS {numeroOsExibicao(s)}
                          {isMultiParticipante(s) ? (
                            <span className="ml-2 text-sky-400">
                              {s.setor === 'APS' || s.setor === 'CGB' || s.tipoChecklist === 'CHECKLIST_15000'
                                ? 'Revisão corretiva'
                                : 'Revisão preventiva'}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-300 text-sm font-semibold mb-2">Aguardando peça</p>
                      {pecasPendentes.length === 0 ? (
                        <p className="text-slate-500 text-sm">—</p>
                      ) : (
                        <ul className="space-y-2">
                          {pecasPendentes.map((i) => (
                            <li
                              key={i.id}
                              className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2"
                            >
                              <span className="text-white text-sm font-medium uppercase break-words">
                                {i.descricao}
                              </span>
                              <button
                                type="button"
                                onClick={() => atenderPeca(i.id)}
                                disabled={loading && atendendo === i.id}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded whitespace-nowrap"
                              >
                                {loading && atendendo === i.id ? 'Atendendo...' : 'Marcar como atendido'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}
