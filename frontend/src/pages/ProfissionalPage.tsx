import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, connectWebSocket } from '../lib/api';
import { veiculoNumero, numeroOsExibicao, formatInsumoCodigo, servicoPausado, isPreventivaRev, TEXTO_REVISAO_PREVENTIVA, obsParticipacaoAtual } from '../lib/servico';
import { tituloSecaoServico, agruparPorSecao, saidaVeiculoQuadro, idsVeiculosSaidaPrioritariaPorServicos, ordenarServicosPorPrioridadeSaida, ordenarCorretivaProfissional, servicoExibeHoraSaida, mapaServicosPorVeiculo, servicoSujeitoPrazoInicio, infoPrazoInicioProfissional, classeBordaCardPrazoProfissional, type AlertaPrazoVeiculo } from '../lib/quadro';
import { useAuth } from '../context/AuthContext';
import { useGravadorAudio } from '../hooks/useGravadorAudio';
import { InputLocalExternoServico } from '../components/InputLocalExternoServico';
import { isControler } from '../lib/controler';
import type { Servico } from '../types';
import { BadgeSetor } from '../components/BadgeSetor';
import { HistoricoProfissionalPanel } from '../components/HistoricoProfissionalPanel';

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
  const [obsPreventiva, setObsPreventiva] = useState('');
  const [aguardandoPeca, setAguardandoPeca] = useState('');
  const [insumoCodigo, setInsumoCodigo] = useState('');
  const [insumoQtd, setInsumoQtd] = useState('1');
  const [insumoPosicao, setInsumoPosicao] = useState('');
  const [loading, setLoading] = useState(false);
  const [versaoLista, setVersaoLista] = useState(0);
  const [confirmarAcao, setConfirmarAcao] = useState<'sair' | 'pausar' | null>(null);
  const gravador = useGravadorAudio();

  const carregar = useCallback(async () => {
    const [disp, exec] = await Promise.all([api.getMeusServicos(), api.getEmExecucao()]);
    setDisponiveis(disp);
    setEmExecucao(exec);
    setVersaoLista((v) => v + 1);
  }, []);

  useEffect(() => {
    carregar();
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') carregar();
    });
    return () => ws.close();
  }, [carregar]);

  useEffect(() => {
    if (aba !== 'execucao' || !selecionado) return;
    const atualizado = emExecucao.find((s) => s.id === selecionado.id);
    if (atualizado) setSelecionado(atualizado);
    else setSelecionado(null);
  }, [emExecucao, aba, selecionado?.id]);

  useEffect(() => {
    if (!selecionado || !isPreventivaRev(selecionado)) {
      setObsPreventiva('');
      return;
    }
    setObsPreventiva(obsParticipacaoAtual(selecionado, usuario?.id));
  }, [selecionado?.id, selecionado?.participantes, usuario?.id]);

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
    setConfirmarAcao(null);
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
    if (aba === 'execucao') {
      setConfirmarAcao(null);
      setSelecionado(s);
    }
  };

  const servicoEmExecucao =
    selecionado && aba === 'execucao' && emExecucao.some((s) => s.id === selecionado.id)
      ? selecionado
      : null;

  const salvarObsPreventiva = async () => {
    if (!servicoEmExecucao || !isPreventivaRev(servicoEmExecucao)) return;
    const atual = obsParticipacaoAtual(servicoEmExecucao, usuario?.id);
    const novo = obsPreventiva.trim().toUpperCase();
    if (novo === atual) return;
    setLoading(true);
    try {
      const atualizado = await api.atualizarObsParticipante(servicoEmExecucao.id, novo);
      setSelecionado(atualizado);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar OBS');
    } finally {
      setLoading(false);
    }
  };

  const ehSetorLimpeza = usuario?.setor === 'LIMP';
  const ehControler = isControler(usuario);

  const marcarAguardandoPeca = async () => {
    if (!servicoEmExecucao || !aguardandoPeca.trim()) return;
    const preventiva = isPreventivaRev(servicoEmExecucao);
    setLoading(true);
    try {
      await api.solicitarInsumo(servicoEmExecucao.id, aguardandoPeca.trim().toUpperCase(), true);
      setAguardandoPeca('');
      if (preventiva) {
        // Permanece na preventiva; peça vai ao estoque sem mudar status
        await carregar();
      } else {
        setSelecionado(null);
        setAba('disponiveis');
        await carregar();
      }
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
        insumoPosicao.trim() || undefined,
      );
      setInsumoCodigo('');
      setInsumoQtd('1');
      setInsumoPosicao('');
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
      const transcrito = (await gravador.parar()).trim();
      setCorrecao(transcrito ? transcrito.toUpperCase() : '');
    } else {
      try {
        setCorrecao('');
        await gravador.iniciar();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao acessar microfone');
      }
    }
  };

  const liberarServico = async () => {
    if (!servicoEmExecucao) return;
    setLoading(true);
    try {
      await api.liberarServico(servicoEmExecucao.id);
      setSelecionado(null);
      setCorrecao('');
      gravador.limpar();
      setConfirmarAcao(null);
      setAba('disponiveis');
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const pausarServico = async () => {
    if (!servicoEmExecucao) return;
    setLoading(true);
    try {
      const atualizado = servicoPausado(servicoEmExecucao)
        ? await api.despausarServico(servicoEmExecucao.id)
        : await api.pausarServico(servicoEmExecucao.id);
      setSelecionado(atualizado);
      setConfirmarAcao(null);
      const exec = await api.getEmExecucao();
      setEmExecucao(exec);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const finalizar = async () => {
    let textoFinal = correcao.trim();
    if (gravador.gravando) {
      const transcrito = (await gravador.parar()).trim();
      if (transcrito) {
        textoFinal = transcrito;
        setCorrecao(transcrito.toUpperCase());
      }
    }
    if (!textoFinal) textoFinal = gravador.getTexto().trim();

    const textoCorrecao = textoFinal.toUpperCase();
    if (!servicoEmExecucao || !textoCorrecao) {
      alert('Informe a correção executada (fale no microfone ou digite no campo)');
      return;
    }
    setLoading(true);
    try {
      await api.finalizarServico(servicoEmExecucao.id, {
        correcao: textoCorrecao,
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
            {ehControler ? (
              <span className="text-emerald-400 font-semibold">Controler — Serviços externos</span>
            ) : (
              <>
                {usuario?.especialidade}
                {usuario?.setor && (
                  <>
                    {' '}— <BadgeSetor setor={usuario.setor} />
                  </>
                )}
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
          {ehControler ? 'Externos' : 'Disponíveis'} ({disponiveis.length})
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
                  {isPreventivaRev(s) ? (
                    <>
                      <BadgeSetor setor={s.setor} className="mr-1" />
                      {TEXTO_REVISAO_PREVENTIVA}
                    </>
                  ) : (
                    <>
                      <BadgeSetor setor={s.setor} className="mr-1" />
                      {s.descricao}
                    </>
                  )}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <BadgePrazoInicio
                    servico={s}
                    servicosPorVeiculo={servicosPorVeiculo}
                    agora={agora}
                  />
                  {aba === 'execucao' && servicoPausado(s) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-black text-white shrink-0">
                      PAUSADO
                    </span>
                  )}
                  <BadgeSaidaServico
                    servico={s}
                    prioridade={prioridadeSaidaIds.has(s.veiculo.id)}
                  />
                  {ehControler && (
                    <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                      <InputLocalExternoServico
                        servicoId={s.id}
                        local={s.localExterno}
                        onAtualizado={carregar}
                      />
                    </div>
                  )}
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

        {aba === 'disponiveis' && (
          <HistoricoProfissionalPanel versaoAtualizacao={versaoLista} />
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
            {servicoPausado(servicoEmExecucao) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-black text-white uppercase">
                Pausado
              </span>
            )}
            <BadgeSaidaServico
              servico={servicoEmExecucao}
              prioridade={prioridadeSaidaIds.has(servicoEmExecucao.veiculo.id)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => setConfirmarAcao((a) => (a === 'sair' ? null : 'sair'))}
              disabled={loading}
              className="flex-1 min-w-[7rem] py-2 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"
            >
              Sair do serviço
            </button>
            <button
              type="button"
              onClick={() => {
                if (servicoPausado(servicoEmExecucao)) {
                  void pausarServico();
                  return;
                }
                setConfirmarAcao((a) => (a === 'pausar' ? null : 'pausar'));
              }}
              disabled={loading}
              className={`flex-1 min-w-[7rem] py-2 rounded text-xs font-semibold text-white disabled:opacity-50 ${
                servicoEmExecucao && servicoPausado(servicoEmExecucao)
                  ? 'bg-emerald-700 hover:bg-emerald-600'
                  : 'bg-black hover:bg-neutral-800'
              }`}
            >
              {servicoEmExecucao && servicoPausado(servicoEmExecucao) ? 'Retomar' : 'Pausar'}
            </button>
          </div>

          {confirmarAcao === 'sair' && (
            <div className="mb-2 rounded-md border border-slate-600 bg-slate-950 p-2.5 shadow-xl shadow-black/40">
              <p className="text-[11px] leading-snug text-slate-300 mb-1">
                Sair deste serviço sem concluir?
              </p>
              <p className="text-[10px] text-slate-500 mb-2">Ele voltará para a fila.</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void liberarServico()}
                  className="flex-1 rounded bg-slate-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
                >
                  Sim, sair
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarAcao(null)}
                  className="flex-1 rounded border border-slate-600 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {confirmarAcao === 'pausar' && (
            <div className="mb-2 rounded-md border border-neutral-700 bg-slate-950 p-2.5 shadow-xl shadow-black/40">
              <p className="text-[11px] leading-snug text-slate-300 mb-1">
                Pausar este serviço?
              </p>
              <p className="text-[10px] text-slate-500 mb-2">Você poderá retomar depois.</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void pausarServico()}
                  className="flex-1 rounded bg-black px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  Sim, pausar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarAcao(null)}
                  className="flex-1 rounded border border-slate-600 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {isPreventivaRev(servicoEmExecucao) && (
            <div className={`mb-2 p-2 bg-slate-900 rounded border border-sky-800/60 ${servicoPausado(servicoEmExecucao) ? 'opacity-60 pointer-events-none' : ''}`}>
              <p className="text-slate-400 text-xs font-semibold mb-1">OBS</p>
              <textarea
                value={obsPreventiva}
                onChange={(e) => setObsPreventiva(e.target.value.toUpperCase())}
                onBlur={() => void salvarObsPreventiva()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void salvarObsPreventiva();
                  }
                }}
                placeholder="Observação para o quadro TV..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm uppercase"
              />
              <p className="text-slate-500 text-[10px] mt-1">Salva ao sair do campo (Enter). Aparece no quadro no seu setor.</p>
            </div>
          )}

          <div className="space-y-2">
          {ehControler && (
            <div className="p-2 bg-slate-900 rounded border border-emerald-800/60">
              <p className="text-slate-400 text-xs font-semibold mb-1">Local do serviço externo</p>
              <InputLocalExternoServico
                servicoId={servicoEmExecucao.id}
                local={servicoEmExecucao.localExterno}
                onAtualizado={carregar}
              />
            </div>
          )}

          {!ehSetorLimpeza && !ehControler && (
          <div className={`p-2 bg-slate-900 rounded border border-slate-700 ${servicoPausado(servicoEmExecucao) ? 'opacity-60 pointer-events-none' : ''}`}>
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

          {!ehSetorLimpeza && !ehControler && (
          <div className={`p-2 bg-slate-900 rounded border border-slate-700 ${servicoPausado(servicoEmExecucao) ? 'opacity-60 pointer-events-none' : ''}`}>
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
              <input
                value={insumoPosicao}
                onChange={(e) => setInsumoPosicao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Pos."
                aria-label="Posição da peça"
                title="Posição da peça (ex.: TD, TE, TDT, TEF)"
                maxLength={10}
                className="w-16 shrink-0 bg-slate-800 border border-slate-600 rounded px-1.5 py-1.5 text-white text-sm text-center uppercase"
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
            className={`p-2 bg-slate-900 rounded border border-slate-700 ${servicoEmExecucao && servicoPausado(servicoEmExecucao) ? 'opacity-60 pointer-events-none' : ''}`}
            onSubmit={(e) => {
              e.preventDefault();
              void finalizar();
            }}
          >
            <p className="text-slate-400 text-xs font-semibold mb-1">Correção executada</p>
            <button
              type="button"
              onClick={toggleGravacao}
              disabled={loading || !gravador.suportaVoz}
              className={`w-full py-1.5 rounded font-semibold text-xs mb-1.5 ${
                gravador.gravando
                  ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-500'
              } text-white disabled:opacity-50`}
            >
              {gravador.gravando ? '⏹ Parar transcrição' : '🎤 Falar correção'}
            </button>
            {!gravador.suportaVoz && (
              <p className="text-yellow-400 text-[10px] mb-1 leading-tight">
                Transcrição por voz indisponível neste navegador — digite a correção abaixo
              </p>
            )}
            {gravador.erroVoz && (
              <p className="text-yellow-400 text-[10px] mb-1 leading-tight">{gravador.erroVoz}</p>
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
              readOnly={gravador.gravando}
              placeholder={
                gravador.gravando
                  ? 'Ouvindo… ao parar, o texto aparece aqui'
                  : 'Correção (Enter envia) — ou use o microfone'
              }
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm uppercase"
            />
            {gravador.gravando && (
              <p className="text-blue-300 text-[10px] mt-1 leading-tight">
                Fale agora e toque em Parar — só então o texto entra no campo
              </p>
            )}
            <button
              type="submit"
              disabled={
                loading ||
                gravador.gravando ||
                !(correcao.trim() || gravador.texto.trim())
              }
              className="w-full mt-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 rounded text-sm"
            >
              {servicoEmExecucao && isPreventivaRev(servicoEmExecucao)
                ? 'CONCLUIR MINHA PARTE'
                : 'CONCLUIR SERVIÇO'}
            </button>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
