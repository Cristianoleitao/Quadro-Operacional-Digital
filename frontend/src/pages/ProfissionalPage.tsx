import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, connectWebSocket } from '../lib/api';
import { veiculoNumero, numeroOsExibicao, formatInsumoCodigo } from '../lib/servico';
import { tituloSecaoServico, agruparPorSecao, saidaVeiculoQuadro, idsVeiculosSaidaPrioritariaPorServicos, ordenarServicosPorPrioridadeSaida, ordenarCorretivaProfissional, servicoExibeHoraSaida, mapaServicosPorVeiculo, servicoSujeitoPrazoInicio, infoPrazoInicioProfissional, classeBordaCardPrazoProfissional, type AlertaPrazoVeiculo } from '../lib/quadro';
import { useAuth } from '../context/AuthContext';
import { useGravadorAudio } from '../hooks/useGravadorAudio';
import type { Servico } from '../types';
import { BadgeSetor } from '../components/BadgeSetor';

function BadgeSaidaServico({
  servico,
  prioridade,
}: {
  servico: Servico;
  prioridade: boolean;
}) {
  if (!servicoExibeHoraSaida(servico.status)) return null;

  const texto = saidaVeiculoQuadro(servico.veiculo);
  if (!texto) return null;

  if (prioridade) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono tabular-nums bg-red-600 text-white shrink-0"
        title="Saída mais próxima — priorizar este serviço"
      >
        SAÍDA {texto}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono tabular-nums bg-slate-700 text-slate-200 shrink-0"
      title="Horário previsto de saída da oficina"
    >
      SAÍDA {texto}
    </span>
  );
}

function BadgePrazoInicio({
  servico,
  servicosPorVeiculo,
  agora,
}: {
  servico: Servico;
  servicosPorVeiculo: Map<string, Servico[]>;
  agora: Date;
}) {
  if (!servicoSujeitoPrazoInicio(servico.status)) return null;

  const info = infoPrazoInicioProfissional(
    servico.veiculo,
    servicosPorVeiculo.get(servico.veiculo.id) ?? [servico],
    agora,
  );
  if (!info.texto) return null;

  const estilo: Record<AlertaPrazoVeiculo, string> = {
    vermelho: 'bg-red-600 text-white',
    amarelo: 'bg-yellow-500 text-black',
    nenhum: 'bg-slate-600 text-slate-100',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${estilo[info.alerta]}`}
      title="Regra: algum profissional deve assumir o serviço em até 2 horas da entrada do veículo"
    >
      {info.texto}
    </span>
  );
}

export default function ProfissionalPage() {
  const { usuario, logout } = useAuth();
  const [disponiveis, setDisponiveis] = useState<Servico[]>([]);
  const [emExecucao, setEmExecucao] = useState<Servico[]>([]);
  const [selecionado, setSelecionado] = useState<Servico | null>(null);
  const [aba, setAba] = useState<'disponiveis' | 'execucao'>('disponiveis');

  const [correcao, setCorrecao] = useState('');
  const [aguardandoPeca, setAguardandoPeca] = useState('');
  const [insumoCodigo, setInsumoCodigo] = useState('');
  const [insumoQtd, setInsumoQtd] = useState('1');
  const [loading, setLoading] = useState(false);
  const gravador = useGravadorAudio();

  const carregar = useCallback(async () => {
    const [disp, exec] = await Promise.all([api.getMeusServicos(), api.getEmExecucao()]);
    setDisponiveis(disp);
    setEmExecucao(exec);
  }, []);

  useEffect(() => {
    carregar();
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') carregar();
    });
    return () => ws.close();
  }, [carregar]);

  useEffect(() => {
    if (gravador.texto) setCorrecao(gravador.texto.toUpperCase());
  }, [gravador.texto]);

  useEffect(() => {
    if (aba !== 'execucao' || !selecionado) return;
    const atualizado = emExecucao.find((s) => s.id === selecionado.id);
    if (atualizado) setSelecionado(atualizado);
    else setSelecionado(null);
  }, [emExecucao, aba, selecionado?.id]);

  const assumir = async (id: string) => {
    setLoading(true);
    try {
      const atualizado = await api.assumirServico(id);
      await carregar();
      setAba('execucao');
      setSelecionado(atualizado);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const trocarAba = (novaAba: 'disponiveis' | 'execucao') => {
    setAba(novaAba);
    if (novaAba === 'execucao') {
      setSelecionado((atual) =>
        atual && emExecucao.some((s) => s.id === atual.id) ? atual : null,
      );
    } else {
      setSelecionado(null);
    }
  };

  const selecionarServico = (s: Servico) => {
    if (aba === 'execucao') setSelecionado(s);
  };

  const servicoEmExecucao =
    selecionado && aba === 'execucao' && emExecucao.some((s) => s.id === selecionado.id)
      ? selecionado
      : null;

  const ehSetorLimpeza = usuario?.setor === 'LIMP';

  const marcarAguardandoPeca = async () => {
    if (!servicoEmExecucao || !aguardandoPeca.trim()) return;
    setLoading(true);
    try {
      await api.solicitarInsumo(servicoEmExecucao.id, aguardandoPeca.trim().toUpperCase(), true);
      setAguardandoPeca('');
      setSelecionado(null);
      setAba('disponiveis');
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const solicitarInsumo = async () => {
    if (!servicoEmExecucao || !insumoCodigo.trim()) return;
    const quantidade = Number.parseInt(insumoQtd, 10);
    if (!Number.isFinite(quantidade) || quantidade < 1) {
      alert('Informe uma quantidade válida (mínimo 1)');
      return;
    }
    setLoading(true);
    try {
      await api.solicitarInsumo(
        servicoEmExecucao.id,
        formatInsumoCodigo(insumoCodigo.trim()),
        false,
        quantidade,
      );
      setInsumoCodigo('');
      setInsumoQtd('1');
      const exec = await api.getEmExecucao();
      setEmExecucao(exec);
      const atualizado = exec.find((s) => s.id === servicoEmExecucao.id);
      setSelecionado(atualizado ?? null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const toggleGravacao = async () => {
    if (gravador.gravando) {
      gravador.parar();
    } else {
      try {
        await gravador.iniciar();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao acessar microfone');
      }
    }
  };

  const finalizar = async () => {
    if (!servicoEmExecucao || !correcao.trim()) {
      alert('Informe a correção executada (texto ou áudio)');
      return;
    }
    setLoading(true);
    try {
      let correcaoAudio: string | undefined;
      if (gravador.audioBlob) {
        const { url } = await api.uploadAudio(gravador.audioBlob);
        correcaoAudio = url;
      }
      await api.finalizarServico(servicoEmExecucao.id, {
        correcao: correcao.trim().toUpperCase(),
        correcaoAudio,
      });
      setSelecionado(null);
      setCorrecao('');
      gravador.limpar();
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const servicosAba = aba === 'disponiveis' ? disponiveis : emExecucao;
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const prioridadeSaidaIds = useMemo(() => {
    const corretivas = servicosAba.filter((s) => servicoExibeHoraSaida(s.status));
    return idsVeiculosSaidaPrioritariaPorServicos(corretivas, agora);
  }, [servicosAba, agora]);

  const servicosPorVeiculo = useMemo(
    () => mapaServicosPorVeiculo([...disponiveis, ...emExecucao]),
    [disponiveis, emExecucao],
  );

  const alertasPrazoDisponiveis = useMemo(() => {
    let amarelo = 0;
    let vermelho = 0;
    for (const s of disponiveis) {
      if (!servicoSujeitoPrazoInicio(s.status)) continue;
      const info = infoPrazoInicioProfissional(
        s.veiculo,
        servicosPorVeiculo.get(s.veiculo.id) ?? [s],
        agora,
      );
      if (info.alerta === 'vermelho') vermelho += 1;
      else if (info.alerta === 'amarelo') amarelo += 1;
    }
    return { amarelo, vermelho };
  }, [disponiveis, servicosPorVeiculo, agora]);

  const gruposSecao = useMemo(() => {
    return agruparPorSecao(servicosAba).map((grupo) => {
      if (grupo.secao.id !== 'corretiva') return grupo;
      const itens =
        aba === 'disponiveis'
          ? ordenarCorretivaProfissional(grupo.itens, servicosPorVeiculo, prioridadeSaidaIds, agora)
          : ordenarServicosPorPrioridadeSaida(grupo.itens, prioridadeSaidaIds, agora);
      return { ...grupo, itens };
    });
  }, [servicosAba, prioridadeSaidaIds, agora, aba, servicosPorVeiculo]);

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden">
      <header className="shrink-0 bg-slate-950 border-b border-slate-700 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{usuario?.nome}</h1>
          <p className="text-slate-400 text-sm flex items-center gap-1 flex-wrap">
            {usuario?.especialidade}
            {usuario?.setor && (
              <>
                {' '}— <BadgeSetor setor={usuario.setor} />
              </>
            )}
            {usuario?.garagem?.rotulo && (
              <span className="text-amber-400/90 text-xs">({usuario.garagem.rotulo})</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/quadro" className="text-blue-400 text-sm">Quadro</Link>
          <button onClick={logout} className="text-red-400 text-sm">Sair</button>
        </div>
      </header>

      <div className="shrink-0 flex border-b border-slate-700">
        <button
          onClick={() => trocarAba('disponiveis')}
          className={`flex-1 py-3 text-sm font-semibold ${aba === 'disponiveis' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
        >
          Disponíveis ({disponiveis.length})
        </button>
        <button
          onClick={() => trocarAba('execucao')}
          className={`flex-1 py-3 text-sm font-semibold ${aba === 'execucao' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
        >
          Em Execução ({emExecucao.length})
        </button>
      </div>

      {aba === 'disponiveis' &&
        (alertasPrazoDisponiveis.vermelho > 0 || alertasPrazoDisponiveis.amarelo > 0) && (
          <div
            className={`shrink-0 px-3 py-2 text-xs font-semibold border-b ${
              alertasPrazoDisponiveis.vermelho > 0
                ? 'bg-red-950 border-red-800 text-red-200'
                : 'bg-yellow-950 border-yellow-800 text-yellow-200'
            }`}
          >
            {alertasPrazoDisponiveis.vermelho > 0
              ? `${alertasPrazoDisponiveis.vermelho} veículo(s) com prazo crítico — assuma o atendimento em até 2h da entrada`
              : `${alertasPrazoDisponiveis.amarelo} veículo(s) próximo(s) do prazo de 2h para iniciar atendimento`}
          </div>
        )}

      <main
        className={`min-h-0 overflow-y-auto overscroll-y-contain p-3 space-y-3 ${
          servicoEmExecucao ? 'shrink max-h-[36dvh]' : 'flex-1'
        }`}
      >
        {gruposSecao.map(({ secao, itens }) => (
          <div key={secao.id} className="space-y-2">
            <div
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded ${secao.headerClass} ${secao.headerTextClass}`}
            >
              {secao.titulo}
            </div>
            {itens.map((s) => {
              const prazoInfo =
                aba === 'disponiveis' && servicoSujeitoPrazoInicio(s.status)
                  ? infoPrazoInicioProfissional(
                      s.veiculo,
                      servicosPorVeiculo.get(s.veiculo.id) ?? [s],
                      agora,
                    )
                  : null;
              const bordaPrazo =
                prazoInfo && prazoInfo.texto
                  ? classeBordaCardPrazoProfissional(prazoInfo.alerta)
                  : '';

              return (
          <div
            key={s.id}
            onClick={() => selecionarServico(s)}
            className={`bg-slate-800 rounded-lg p-4 border cursor-pointer transition ${
              aba === 'execucao' && selecionado?.id === s.id ? 'border-blue-500' : 'border-slate-700'
            } ${bordaPrazo} ${aba === 'execucao' ? '' : 'cursor-default'}`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="shrink-0 lg:w-[5.5rem]">
                <div className="font-mono font-bold text-lg text-white leading-tight">
                  {veiculoNumero(s)}
                </div>
                <div className="text-slate-500 text-xs mt-0.5 tabular-nums">
                  OS {numeroOsExibicao(s)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-slate-300 min-w-0 break-words">
                  <BadgeSetor setor={s.setor} className="mr-1" />
                  {s.descricao}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <BadgePrazoInicio
                    servico={s}
                    servicosPorVeiculo={servicosPorVeiculo}
                    agora={agora}
                  />
                  <BadgeSaidaServico
                    servico={s}
                    prioridade={prioridadeSaidaIds.has(s.veiculo.id)}
                  />
                </div>
              </div>

              {aba === 'disponiveis' && (
                <button
                  onClick={(e) => { e.stopPropagation(); assumir(s.id); }}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 w-full sm:w-auto lg:ml-auto"
                >
                  ASSUMIR SERVIÇO
                </button>
              )}
            </div>
          </div>
              );
            })}
          </div>
        ))}

        {gruposSecao.length === 0 && (
          <p className="text-center text-slate-500 py-12">Nenhum serviço nesta aba</p>
        )}
      </main>

      {servicoEmExecucao && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-slate-950 border-t border-slate-700 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
            <h3 className="font-bold text-white text-sm">
              Veículo {veiculoNumero(servicoEmExecucao)}
            </h3>
            <span className="text-sky-300 text-[11px] font-semibold uppercase">
              {tituloSecaoServico(servicoEmExecucao.status)}
            </span>
            <BadgeSaidaServico
              servico={servicoEmExecucao}
              prioridade={prioridadeSaidaIds.has(servicoEmExecucao.veiculo.id)}
            />
          </div>

          <div className="space-y-2">
          {!ehSetorLimpeza && (
          <div className="p-2 bg-slate-900 rounded border border-slate-700">
            <p className="text-slate-400 text-xs font-semibold mb-1">Aguardando peça</p>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void marcarAguardandoPeca();
              }}
            >
              <input
                value={aguardandoPeca}
                onChange={(e) => setAguardandoPeca(e.target.value.toUpperCase())}
                placeholder="Peça necessária..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm uppercase"
              />
              <button
                type="submit"
                disabled={loading || !aguardandoPeca.trim()}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 px-3 py-1.5 rounded text-xs font-semibold text-white whitespace-nowrap"
              >
                Confirmar
              </button>
            </form>
          </div>
          )}

          {!ehSetorLimpeza && (
          <div className="p-2 bg-slate-900 rounded border border-slate-700">
            <p className="text-slate-400 text-xs font-semibold mb-1">Solicitação de insumo</p>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void solicitarInsumo();
              }}
            >
              <input
                value={insumoCodigo}
                onChange={(e) => setInsumoCodigo(e.target.value.toUpperCase())}
                placeholder="Código"
                className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm uppercase"
              />
              <input
                type="number"
                min={1}
                step={1}
                value={insumoQtd}
                onChange={(e) => setInsumoQtd(e.target.value)}
                placeholder="Qtd"
                aria-label="Quantidade"
                className="w-14 shrink-0 bg-slate-800 border border-slate-600 rounded px-1.5 py-1.5 text-white text-sm text-center"
              />
              <button
                type="submit"
                disabled={loading || !insumoCodigo.trim() || !insumoQtd.trim()}
                className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-3 py-1.5 rounded text-xs font-semibold text-white whitespace-nowrap"
              >
                Solicitar
              </button>
            </form>
          </div>
          )}

          <form
            className="p-2 bg-slate-900 rounded border border-slate-700"
            onSubmit={(e) => {
              e.preventDefault();
              void finalizar();
            }}
          >
            <p className="text-slate-400 text-xs font-semibold mb-1">Correção executada</p>
            <button
              type="button"
              onClick={toggleGravacao}
              disabled={loading}
              className={`w-full py-1.5 rounded font-semibold text-xs mb-1.5 ${
                gravador.gravando
                  ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-500'
              } text-white`}
            >
              {gravador.gravando ? '⏹ Parar' : '🎤 Gravar áudio'}
            </button>
            {!gravador.suportaVoz && (
              <p className="text-yellow-400 text-[10px] mb-1 leading-tight">
                Transcrição indisponível — digite abaixo
              </p>
            )}
            <textarea
              value={correcao}
              onChange={(e) => setCorrecao(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void finalizar();
                }
              }}
              placeholder="Correção (Enter envia)"
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm uppercase"
            />
            {gravador.audioBlob && !gravador.gravando && (
              <audio controls src={URL.createObjectURL(gravador.audioBlob)} className="w-full mt-1 h-8" />
            )}
            <button
              type="submit"
              disabled={loading || !correcao.trim()}
              className="w-full mt-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 rounded text-sm"
            >
              FINALIZAR SERVIÇO
            </button>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
