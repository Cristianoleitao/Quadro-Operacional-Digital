import { Fragment, useState, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api, connectWebSocket, mediaUrl } from '../lib/api';
import { SETOR_QUADRO, SECOES_QUADRO, secaoDoVeiculoQuadro } from '../lib/quadro';
import {
  veiculoNumero,
  textoAguardandoPecaQuadro,
  textoInsumoExibicao,
  formatInsumoCodigo,
  nomeCompletoProfissionalSolicitouPeca,
  tempoServicoAtivoMin,
  isMultiParticipante,
  badgesPreventivaQuadro,
  textoPreventivaRev,
  TEXTO_TESTE_POS_REVISAO,
  TEXTO_REVISAO_APS,
  TEXTO_REVISAO_CGB,
} from '../lib/servico';
import {
  InputHoraVeiculo,
  InputOsVeiculo,
} from '../components/DadosVeiculoQuadroInputs';
import { InputProfissionalServico } from '../components/InputProfissionalServico';
import { classeNomeProfissionalServico, classeNomeSolicitantePeca, BadgesPreventivaQuadro } from '../components/BadgeSetor';
import { InputLocalExternoServico } from '../components/InputLocalExternoServico';
import { SelectSetorServico } from '../components/SelectSetorServico';
import { useAuth } from '../context/AuthContext';
import type { Servico, Setor, StatusServico, Garagem } from '../types';
import { SETOR_CORES, SETOR_PREFIX, STATUS_COLORS, STATUS_LABELS, STATUS_SECAO_ADMIN } from '../types';

const SETORES: Setor[] = ['MEC', 'ELE', 'LANT', 'PINT', 'REFR', 'BORR', 'LIMP', 'OUTRO', 'APS', 'CGB'];

function formatHora(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR');
}

function textoOQueFoiFeito(s: Servico): string {
  if (isMultiParticipante(s)) {
    const linhas = (s.participantes ?? [])
      .filter((p) => Boolean(p.horaTermino))
      .slice()
      .sort((a, b) => {
        const ta = a.horaTermino ? new Date(a.horaTermino).getTime() : 0;
        const tb = b.horaTermino ? new Date(b.horaTermino).getTime() : 0;
        return ta - tb;
      })
      .map((p) => {
        const nome = p.profissional?.nome?.trim();
        const texto = p.correcao?.trim();
        if (texto && nome) return `${texto} - ${nome}`;
        if (texto) return texto;
        if (nome) return `- ${nome}`;
        return '';
      })
      .filter(Boolean);

    if (linhas.length > 0) return linhas.join('\n');

    // Legado: "[matricula/nome] texto" → "texto - nome"
    const bruto = s.correcao?.trim() ?? '';
    if (!bruto) return '';
    return bruto
      .split('\n')
      .map((linha) => {
        const m = linha.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (!m) return linha;
        const quem = m[1]?.trim() ?? '';
        const oque = m[2]?.trim() ?? '';
        if (oque && quem) return `${oque} - ${quem}`;
        if (oque) return oque;
        if (quem) return `- ${quem}`;
        return linha;
      })
      .filter(Boolean)
      .join('\n');
  }

  const correcao = s.correcao?.trim() ?? '';
  const finalizador = s.finalizadoPor?.nome ?? s.profissional?.nome;

  if (!correcao && !finalizador) return '';
  if (!finalizador) return correcao;
  if (!correcao) return `- ${finalizador}`;
  return `${correcao} - ${finalizador}`;
}

function CampoOQueFoiFeito({ servico }: { servico: Servico }) {
  const [copiado, setCopiado] = useState(false);
  const texto = textoOQueFoiFeito(servico);
  const exibir = texto || '—';
  const temTranscricao = Boolean(servico.correcao?.trim());

  const copiar = async () => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      alert('Não foi possível copiar o texto.');
    }
  };

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between gap-2">
        <strong>O que foi feito:</strong>
        <button
          type="button"
          disabled={!texto}
          onClick={copiar}
          className="text-xs font-semibold text-blue-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <p className="mt-1 text-white whitespace-pre-wrap break-words">{exibir}</p>
      {servico.correcaoAudio && !temTranscricao && (
        <>
          <p className="mt-2 text-yellow-400 text-xs">
            Transcrição indisponível neste registro — ouça a gravação:
          </p>
          <audio controls src={mediaUrl(servico.correcaoAudio)} className="mt-1 w-full max-w-md" />
        </>
      )}
    </div>
  );
}

function ItemSolicitacaoAdmin({
  insumo,
  servico,
  aguardarPeca,
  onAtender,
  onDesatender,
  onEstornar,
}: {
  insumo: { id: string; descricao: string; quantidade?: number; posicao?: string | null; atendido: boolean };
  servico: Servico;
  aguardarPeca: boolean;
  onAtender: (insumoId: string) => void;
  onDesatender: (insumoId: string) => void;
  onEstornar: (insumoId: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [confirmarEstorno, setConfirmarEstorno] = useState(false);
  const textoExibir = aguardarPeca
    ? insumo.descricao
    : textoInsumoExibicao(insumo.descricao, insumo.quantidade ?? 1, insumo.posicao);
  const servicoAberto =
    servico.status !== 'FINALIZADO' && servico.status !== 'CONCLUIDO';
  const podeAtender = !insumo.atendido && servicoAberto;
  const podeDesatender = insumo.atendido && servicoAberto;
  const podeEstornar = servico.status !== 'CONCLUIDO';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(formatInsumoCodigo(insumo.descricao));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      alert('Não foi possível copiar o texto.');
    }
  };

  return (
    <li className="bg-slate-900/50 rounded px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className={`min-w-0 break-words ${insumo.atendido ? 'text-green-400 line-through' : ''}`}>
          {textoExibir}
          {insumo.atendido && ' ✓ Atendido'}
        </span>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {!aguardarPeca && (
            <button
              type="button"
              onClick={copiar}
              className="text-xs font-semibold text-blue-300 hover:text-white whitespace-nowrap"
            >
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          )}
          {podeAtender && (
            <button
              type="button"
              onClick={() => onAtender(insumo.id)}
              className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded whitespace-nowrap"
            >
              Marcar como atendido
            </button>
          )}
          {podeDesatender && (
            <button
              type="button"
              onClick={() => onDesatender(insumo.id)}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded whitespace-nowrap"
            >
              Desmarcar atendido
            </button>
          )}
          {podeEstornar && !confirmarEstorno && (
            <button
              type="button"
              onClick={() => setConfirmarEstorno(true)}
              className="text-xs font-semibold text-red-300 hover:text-red-200 whitespace-nowrap"
            >
              Estornar
            </button>
          )}
        </div>
      </div>
      {confirmarEstorno && (
        <div className="mt-2 rounded border border-red-900/70 bg-slate-950 p-2.5">
          <p className="text-[11px] leading-snug text-slate-300 mb-1">
            Estornar esta solicitação?
          </p>
          <p className="text-[10px] text-slate-500 mb-2">
            Use em caso de código errado ou devolução. A solicitação será removida.
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setConfirmarEstorno(false);
                onEstornar(insumo.id);
              }}
              className="flex-1 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
            >
              Sim, estornar
            </button>
            <button
              type="button"
              onClick={() => setConfirmarEstorno(false)}
              className="flex-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ListaSolicitacoesAdmin({
  servico,
  aguardarPeca,
  onAtender,
  onDesatender,
  onEstornar,
  apenasPendentes = false,
}: {
  servico: Servico;
  aguardarPeca: boolean;
  onAtender: (insumoId: string) => void;
  onDesatender: (insumoId: string) => void;
  onEstornar: (insumoId: string) => void;
  apenasPendentes?: boolean;
}) {
  const itens = (servico.insumos ?? []).filter(
    (i) => Boolean(i.aguardarPeca) === aguardarPeca && (!apenasPendentes || !i.atendido),
  );
  if (itens.length === 0) return <> —</>;

  return (
    <ul className="mt-2 space-y-2">
      {itens.map((i) => (
        <ItemSolicitacaoAdmin
          key={i.id}
          insumo={i}
          servico={servico}
          aguardarPeca={aguardarPeca}
          onAtender={onAtender}
          onDesatender={onDesatender}
          onEstornar={onEstornar}
        />
      ))}
    </ul>
  );
}

/** Destaque no hover sem escurecer a cor de status da linha. */
function hoverLinhaAdmin(status: StatusServico): string {
  const fundoEscuro = ['PARADO_CRITICO', 'SERVICO_EXTERNO', 'FINALIZADO', 'CONCLUIDO'].includes(status);
  return fundoEscuro
    ? 'transition-[box-shadow] hover:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.55)]'
    : 'transition-[box-shadow] hover:shadow-[inset_0_0_0_2px_rgba(15,23,42,0.4)]';
}

interface GrupoVeiculoAdmin {
  veiculoId: string;
  numero: string;
  servicos: Servico[];
}

interface SecaoAdmin {
  secao: (typeof SECOES_QUADRO)[number];
  grupos: GrupoVeiculoAdmin[];
}

function servicosAbertosAdmin(servicos: Servico[]): Servico[] {
  return servicos.filter((s) => s.status !== 'FINALIZADO' && s.status !== 'CONCLUIDO');
}

function statusDominanteGrupo(servicos: Servico[]): StatusServico {
  if (servicos.some((s) => s.status === 'PARADO_CRITICO')) return 'PARADO_CRITICO';
  return servicos[servicos.length - 1]?.status ?? 'EM_EXECUCAO';
}

function secaoDoVeiculoAdmin(servicos: Servico[]): (typeof SECOES_QUADRO)[number] | null {
  return secaoDoVeiculoQuadro(servicosAbertosAdmin(servicos));
}

function aguardandoEncerramentoAdmin(grupo: GrupoVeiculoAdmin): boolean {
  return grupo.servicos.length > 0 && grupo.servicos.every((s) => s.status === 'FINALIZADO');
}

function grupoTemInsumoPendente(grupo: GrupoVeiculoAdmin): boolean {
  return grupo.servicos.some((s) => s.insumos?.some((i) => !i.atendido));
}

function organizarAdminPorSecao(servicos: Servico[]): { secoes: SecaoAdmin[] } {
  const porVeiculo = new Map<string, Servico[]>();

  for (const servico of servicos) {
    const id = servico.veiculo.id;
    const lista = porVeiculo.get(id) ?? [];
    lista.push(servico);
    porVeiculo.set(id, lista);
  }

  const gruposVeiculo: GrupoVeiculoAdmin[] = Array.from(porVeiculo.entries())
    .map(([veiculoId, lista]) => ({
      veiculoId,
      numero: veiculoNumero(lista[0]),
      servicos: lista.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }));

  const secoes: SecaoAdmin[] = SECOES_QUADRO.map((secao) => {
    let grupos = gruposVeiculo.filter((grupo) => secaoDoVeiculoAdmin(grupo.servicos)?.id === secao.id);

    if (secao.id === 'corretiva') {
      const aguardando = gruposVeiculo
        .filter(aguardandoEncerramentoAdmin)
        .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));

      const corretivaAbertos = gruposVeiculo
        .filter((grupo) => secaoDoVeiculoAdmin(grupo.servicos)?.id === 'corretiva')
        .sort((a, b) => {
          const abertosA = servicosAbertosAdmin(a.servicos);
          const abertosB = servicosAbertosAdmin(b.servicos);
          const ta = abertosA.length
            ? Math.min(...abertosA.map((s) => new Date(s.createdAt).getTime()))
            : 0;
          const tb = abertosB.length
            ? Math.min(...abertosB.map((s) => new Date(s.createdAt).getTime()))
            : 0;
          if (ta !== tb) return ta - tb;
          return a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true });
        });

      grupos = [...aguardando, ...corretivaAbertos];
    } else {
      grupos = [...grupos].sort((a, b) =>
        a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }),
      );
    }

    return { secao, grupos };
  }).filter((s) => s.grupos.length > 0);

  return { secoes };
}

function bordaInsumoPendenteAdmin(pendente: boolean): string {
  return pendente ? 'shadow-[inset_0_0_0_5px_#facc15]' : '';
}

function CelulaVeiculoAdmin({
  grupo,
  rowSpan,
  badge,
}: {
  grupo: GrupoVeiculoAdmin;
  rowSpan?: number;
  badge?: ReactNode;
}) {
  const veiculo = grupo.servicos[0].veiculo;
  const props = rowSpan ? { rowSpan } : {};

  return (
    <td {...props} className="px-1 py-1.5 align-top w-[8.5rem] max-w-[8.5rem]">
      <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
        <span className="font-mono font-bold text-lg leading-tight truncate">{grupo.numero}</span>
        {badge}
        <div className="flex items-center gap-0.5">
          <InputHoraVeiculo
            veiculoId={grupo.veiculoId}
            veiculo={veiculo}
            servicos={grupo.servicos}
            className="w-11 shrink-0 text-[11px] px-0.5 py-0.5"
          />
          <InputOsVeiculo
            veiculoId={grupo.veiculoId}
            veiculo={veiculo}
            className="w-16 shrink-0 text-[11px] px-0.5 py-0.5"
          />
        </div>
      </div>
    </td>
  );
}

function CelulaProfissionalAguardandoPeca({ servico }: { servico: Servico }) {
  const texto = textoAguardandoPecaQuadro(servico);

  if (!texto) {
    return <span className="text-slate-500">—</span>;
  }

  return (
    <span className={classeNomeSolicitantePeca(false, true)} title="Aguardando peça">
      {texto}
    </span>
  );
}
function classeItemServicoAdmin(compacto = false): string {
  return `block rounded px-0.5 focus:outline-none ${
    compacto ? 'py-0 min-h-[1.25rem] text-xs leading-snug' : 'py-0.5 min-h-[1.5rem]'
  }`;
}

function CelulasServicosAgregados({
  servicos,
  profissionais,
  profissionalEditando,
  onEditarProfissional,
  onAtualizado,
}: {
  servicos: Servico[];
  profissionais: Array<{ id: string; nome: string; matricula: string; setor?: string | null }>;
  profissionalEditando: string | null;
  onEditarProfissional: (id: string | null) => void;
  onAtualizado: () => void;
}) {
  const cellClass = 'px-3 py-2 align-top';

  return (
    <>
      <td className={cellClass} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1.5">
          {servicos.map((s) => {
            const encerrado = s.status === 'FINALIZADO' || s.status === 'CONCLUIDO';
            return (
              <div key={s.id} className={classeItemServicoAdmin(true)}>
                {encerrado ? (
                  <span
                    className={`font-semibold uppercase tracking-wide opacity-90 ${SETOR_CORES[s.setor].badge}`}
                  >
                    {SETOR_PREFIX[s.setor]}
                  </span>
                ) : (
                  <SelectSetorServico
                    servicoId={s.id}
                    setor={s.setor}
                    onAtualizado={onAtualizado}
                    compacto
                  />
                )}
              </div>
            );
          })}
        </div>
      </td>
      <td className={cellClass} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1.5">
          {servicos.map((s) => (
            <div key={s.id}>
              {s.status === 'SERVICO_EXTERNO' ? (
                <div className={`space-y-1 ${classeItemServicoAdmin(true)}`}>
                  <span className="block text-[10px] uppercase opacity-75 leading-snug">
                    {s.descricao}
                  </span>
                  <InputLocalExternoServico
                    servicoId={s.id}
                    local={s.localExterno}
                    onAtualizado={onAtualizado}
                  />
                </div>
              ) : isMultiParticipante(s) ? (
                <span className={`font-semibold uppercase text-xs ${classeItemServicoAdmin(true)}`}>
                  {textoPreventivaRev(s)}
                </span>
              ) : (
                <span className={`break-words ${classeItemServicoAdmin(true)}`}>
                  {s.descricao}
                </span>
              )}
            </div>
          ))}
        </div>
      </td>
      <td className={cellClass} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2">
          {servicos.map((s) => (
            <div key={s.id} className={classeItemServicoAdmin()}>
              {s.status === 'AGUARDANDO_INSUMO' ? (
                <CelulaProfissionalAguardandoPeca servico={s} />
              ) : s.status === 'SERVICO_EXTERNO' ? (
                <span className="text-slate-500">—</span>
              ) : isMultiParticipante(s) ? (
                <div className="flex flex-wrap gap-1">
                  {badgesPreventivaQuadro(s).length === 0 ? (
                    <span className="text-slate-500 text-xs">
                      {textoPreventivaRev(s) === TEXTO_TESTE_POS_REVISAO
                        ? 'Teste pós revisão'
                        : (s.participantes ?? []).some((p) => Boolean(p.horaTermino))
                          ? 'Setores concluídos'
                          : 'Aguardando alocação'}
                    </span>
                  ) : (
                    <BadgesPreventivaQuadro
                      servico={s}
                      separadorClassName="text-slate-500"
                      pecaClassName="text-[10px]"
                    />
                  )}
                </div>
              ) : (
                <InputProfissionalServico
                  servicoId={s.id}
                  profissional={s.profissional}
                  profissionais={profissionais}
                  onAtualizado={onAtualizado}
                  variant="admin"
                  editando={profissionalEditando === s.id}
                  onEditandoChange={(ativo) => onEditarProfissional(ativo ? s.id : null)}
                  badgeClass={classeNomeProfissionalServico(s.setor, s.pausadoEm)}
                />
              )}
            </div>
          ))}
        </div>
      </td>
      <td className={cellClass}>
        <div className="flex flex-col gap-2 tabular-nums">
          {servicos.map((s) => (
            <span key={s.id} className={`whitespace-nowrap ${classeItemServicoAdmin()}`}>
              {(() => {
                const tempo = tempoServicoAtivoMin(s);
                return tempo != null ? `${tempo} min` : '—';
              })()}
            </span>
          ))}
        </div>
      </td>
    </>
  );
}

function PopoverConfirmacaoAdmin({
  aberto,
  anchorRef,
  children,
  panelClassName,
}: {
  aberto: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  panelClassName: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!aberto || !anchorRef.current) return;

    const posicionar = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const rect = anchor.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const gap = 4;
      const margin = 8;

      let top = rect.bottom + gap;
      let left = rect.right - width;

      if (top + height > window.innerHeight - margin) {
        top = rect.top - height - gap;
      }

      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

      setPos({ position: 'fixed', top, left, zIndex: 50, visibility: 'visible' });
    };

    posicionar();
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    return () => {
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
    };
  }, [aberto, anchorRef]);

  if (!aberto) return null;

  return createPortal(
    <div ref={panelRef} style={pos} className={panelClassName}>
      {children}
    </div>,
    document.body,
  );
}

function AcoesVeiculoAdmin({
  grupo,
  finalizados,
  expandido,
  onToggleExpandido,
  confirmarExclusao,
  confirmarFinalizacao,
  onToggleExclusao,
  onToggleFinalizacao,
  acaoVeiculo,
  onFinalizar,
  onExcluir,
}: {
  grupo: GrupoVeiculoAdmin;
  finalizados: number;
  expandido: string | null;
  onToggleExpandido: () => void;
  confirmarExclusao: string | null;
  confirmarFinalizacao: string | null;
  onToggleExclusao: () => void;
  onToggleFinalizacao: () => void;
  acaoVeiculo: string | null;
  onFinalizar: () => void;
  onExcluir: () => void;
}) {
  const refFinalizar = useRef<HTMLButtonElement>(null);
  const refExcluir = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="inline-flex items-stretch divide-x divide-slate-600/70 rounded-md bg-slate-950/80 border border-slate-600/50 overflow-visible"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onToggleExpandido}
        className="px-2.5 py-1.5 text-blue-300 text-xs font-semibold hover:text-white hover:underline whitespace-nowrap"
      >
        {expandido === grupo.veiculoId ? 'Fechar' : 'Detalhes'}
        {finalizados > 0 && <span className="text-slate-400"> ({finalizados} fin.)</span>}
      </button>
      <div className="relative flex items-center">
        <button
          ref={refFinalizar}
          type="button"
          disabled={acaoVeiculo === grupo.veiculoId}
          onClick={onToggleFinalizacao}
          className="px-2.5 py-1.5 text-green-300 text-xs font-semibold hover:text-white hover:underline disabled:opacity-50 whitespace-nowrap"
        >
          Finalizar
        </button>
        <PopoverConfirmacaoAdmin
          aberto={confirmarFinalizacao === grupo.veiculoId}
          anchorRef={refFinalizar}
          panelClassName="w-52 rounded-md border border-green-900/70 bg-slate-950 p-2.5 shadow-xl shadow-black/40"
        >
          <p className="text-[10px] leading-snug text-slate-300 mb-2">
            Finalizar o carro <strong className="text-white">{grupo.numero}</strong> e remover da
            central?
          </p>
          <p className="text-[9px] text-slate-500 mb-2">Os serviços serão marcados como concluídos.</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={acaoVeiculo === grupo.veiculoId}
              onClick={onFinalizar}
              className="flex-1 rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              Sim, finalizar
            </button>
            <button
              type="button"
              onClick={() => onToggleFinalizacao()}
              className="flex-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </PopoverConfirmacaoAdmin>
      </div>
      <div className="relative flex items-center">
        <button
          ref={refExcluir}
          type="button"
          disabled={acaoVeiculo === grupo.veiculoId}
          onClick={onToggleExclusao}
          className="px-2.5 py-1.5 text-red-300 text-xs font-semibold hover:text-white hover:underline disabled:opacity-50 whitespace-nowrap"
        >
          Excluir
        </button>
        <PopoverConfirmacaoAdmin
          aberto={confirmarExclusao === grupo.veiculoId}
          anchorRef={refExcluir}
          panelClassName="w-52 rounded-md border border-red-900/70 bg-slate-950 p-2.5 shadow-xl shadow-black/40"
        >
          <p className="text-[10px] leading-snug text-slate-300 mb-2">
            Excluir o carro <strong className="text-white">{grupo.numero}</strong> e os serviços em
            aberto?
          </p>
          <p className="text-[9px] text-slate-500 mb-2">Use em caso de erro de digitação.</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={acaoVeiculo === grupo.veiculoId}
              onClick={onExcluir}
              className="flex-1 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Sim, excluir
            </button>
            <button
              type="button"
              onClick={onToggleExclusao}
              className="flex-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </PopoverConfirmacaoAdmin>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { usuario, logout } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<string | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);
  const [acaoVeiculo, setAcaoVeiculo] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);
  const [confirmarFinalizacao, setConfirmarFinalizacao] = useState<string | null>(null);
  const [veiculoNumeroInput, setVeiculoNumeroInput] = useState('');
  const [setor, setSetor] = useState<Setor>('MEC');
  const [descricao, setDescricao] = useState('');
  const [garagemId, setGaragemId] = useState('');
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [profissionalEditando, setProfissionalEditando] = useState<string | null>(null);
  const [modalAguardandoPeca, setModalAguardandoPeca] = useState(false);
  const [servicoAguardandoPecaId, setServicoAguardandoPecaId] = useState<string | null>(null);
  const [descricaoPecaInput, setDescricaoPecaInput] = useState('');
  const [profissionais, setProfissionais] = useState<
    Array<{ id: string; nome: string; matricula: string; setor?: string | null }>
  >([]);

  useEffect(() => {
    carregar();
    api.getProfissionais().then(setProfissionais).catch(console.error);
    api.getGaragens().then((lista) => {
      setGaragens(lista);
      if (lista.length > 0) setGaragemId((atual) => atual || lista[0].id);
    }).catch(console.error);
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') carregar();
    });
    return () => ws.close();
  }, []);

  const carregar = () => api.getAcompanhamento().then(setServicos);

  const atenderInsumo = async (insumoId: string) => {
    try {
      await api.atenderInsumo(insumoId);
      carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atender insumo');
    }
  };

  const desatenderInsumo = async (insumoId: string) => {
    try {
      await api.desatenderInsumo(insumoId);
      carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao desmarcar insumo');
    }
  };

  const estornarInsumo = async (insumoId: string) => {
    try {
      await api.estornarInsumo(insumoId);
      carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao estornar insumo');
    }
  };

  const alterarSecao = async (status: StatusServico) => {
    if (!veiculoSelecionado) {
      setMensagem('Selecione um veículo na tabela');
      return;
    }

    if (status === 'AGUARDANDO_INSUMO') {
      const abertos = servicosAbertosParaAguardandoPeca;
      setServicoAguardandoPecaId(abertos.length === 1 ? abertos[0].id : null);
      setDescricaoPecaInput('');
      setModalAguardandoPeca(true);
      return;
    }

    await executarAlteracaoStatus(status);
  };

  const executarAlteracaoStatus = async (
    status: StatusServico,
    descricaoPeca?: string,
    servicoId?: string,
  ) => {
    if (!veiculoSelecionado) return;

    setAlterandoStatus(veiculoSelecionado);
    try {
      const resultado = await api.atualizarStatusVeiculo(veiculoSelecionado, status, {
        descricaoPeca,
        servicoId,
      });
      setVeiculoSelecionado(null);
      setModalAguardandoPeca(false);
      setServicoAguardandoPecaId(null);
      setDescricaoPecaInput('');
      setMensagem(
        `Veículo movido para ${STATUS_LABELS[status]} (${resultado.atualizados} serviço${resultado.atualizados !== 1 ? 's' : ''})`,
      );
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar seção');
    } finally {
      setAlterandoStatus(null);
    }
  };

  const confirmarAguardandoPeca = () => {
    if (!servicoAguardandoPecaId) {
      setMensagem('Selecione o serviço que aguarda a peça');
      return;
    }
    if (!descricaoPecaInput.trim()) {
      setMensagem('Informe qual peça está faltando');
      return;
    }
    void executarAlteracaoStatus(
      'AGUARDANDO_INSUMO',
      descricaoPecaInput.trim().toUpperCase(),
      servicoAguardandoPecaId,
    );
  };

  const executarFinalizacao = async (grupo: GrupoVeiculoAdmin) => {
    setConfirmarFinalizacao(null);
    setAcaoVeiculo(grupo.veiculoId);
    try {
      await api.finalizarVeiculoAdmin(grupo.veiculoId);
      if (expandido === grupo.veiculoId) setExpandido(null);
      if (veiculoSelecionado === grupo.veiculoId) {
        setVeiculoSelecionado(null);
      }
      await carregar();
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao finalizar veículo');
    } finally {
      setAcaoVeiculo(null);
    }
  };

  const executarExclusao = async (grupo: GrupoVeiculoAdmin) => {
    setConfirmarExclusao(null);
    setAcaoVeiculo(grupo.veiculoId);
    try {
      await api.excluirVeiculoAdmin(grupo.veiculoId);
      if (expandido === grupo.veiculoId) setExpandido(null);
      if (veiculoSelecionado === grupo.veiculoId) {
        setVeiculoSelecionado(null);
      }
      await carregar();
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao excluir veículo');
    } finally {
      setAcaoVeiculo(null);
    }
  };

  const organizacao = useMemo(() => organizarAdminPorSecao(servicos), [servicos]);

  const servicosAbertosParaAguardandoPeca = useMemo(() => {
    if (!veiculoSelecionado) return [];
    return servicosAbertosAdmin(servicos.filter((s) => s.veiculo.id === veiculoSelecionado));
  }, [servicos, veiculoSelecionado]);

  const numeroVeiculoSelecionado = useMemo(() => {
    if (!veiculoSelecionado) return null;
    const servico = servicos.find((s) => s.veiculo.id === veiculoSelecionado);
    return servico ? veiculoNumero(servico) : null;
  }, [servicos, veiculoSelecionado]);

  const handleKeyDownCadastro = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (!veiculoNumeroInput.trim()) {
      setMensagem('Informe o número do veículo');
      return;
    }
    const isRev = setor === 'OUTRO';
    const isApsCgb = setor === 'APS' || setor === 'CGB';
    if (!isRev && !isApsCgb && !descricao.trim()) {
      setMensagem('Informe a descrição do serviço');
      return;
    }
    if (!garagemId) {
      setMensagem('Selecione a garagem');
      return;
    }

    const descricaoPadrao =
      setor === 'APS' ? TEXTO_REVISAO_APS : setor === 'CGB' ? TEXTO_REVISAO_CGB : 'REVISÃO PREVENTIVA';

    try {
      await api.cadastroRapido({
        veiculoNumero: veiculoNumeroInput.trim().toUpperCase(),
        setor,
        descricao:
          isRev || isApsCgb
            ? descricao.trim().toUpperCase() || descricaoPadrao
            : descricao.trim().toUpperCase(),
        garagemId,
      });
      setDescricao('');
      setMensagem(
        isRev
          ? 'Revisão preventiva adicionada (1 serviço por veículo)'
          : isApsCgb
            ? `Revisão ${setor} adicionada na corretiva (1 serviço por veículo)`
            : 'Serviço adicionado',
      );
      await carregar();
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao salvar serviço');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <header className="bg-slate-950 border-b border-slate-700 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Central de Acompanhamento</h1>
          <p className="text-slate-400 text-sm">{usuario?.nome} — Administrador</p>
        </div>
        <div className="flex gap-4 items-center text-sm">
          <Link to="/quadro" className="text-blue-400 hover:text-blue-300">Quadro TV</Link>
          <button onClick={logout} className="text-red-400 hover:text-red-300">Sair</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Status
            </span>
            {STATUS_SECAO_ADMIN.map((status) => {
              const ativo =
                veiculoSelecionado != null &&
                servicosAbertosParaAguardandoPeca.length > 0 &&
                alterandoStatus !== veiculoSelecionado;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={!ativo || alterandoStatus != null}
                  onClick={() => alterarSecao(status)}
                  className={`rounded border px-3 py-1.5 text-xs font-semibold transition ${
                    !ativo || alterandoStatus != null
                      ? 'cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500'
                      : `${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].text} border-slate-600 hover:brightness-110`
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {veiculoSelecionado && numeroVeiculoSelecionado
              ? `Veículo ${numeroVeiculoSelecionado} selecionado. A troca de status move todos os serviços abertos do veículo para a seção escolhida. Use o seletor de setor na tabela para corrigir o setor de cada serviço.`
              : 'Selecione um veículo na tabela (clique na linha) para liberar a troca de status.'}
          </p>
        </div>

        {modalAguardandoPeca && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2">Aguardando peça</h2>
              <p className="text-sm text-slate-400 mb-3">
                Escolha o serviço que aguarda a peça e informe qual peça está faltando. O veículo
                inteiro irá para aguardando peça e os profissionais serão desalocados.
              </p>
              <div className="mb-4 space-y-2 max-h-40 overflow-y-auto">
                {servicosAbertosParaAguardandoPeca.map((s) => (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm transition ${
                      servicoAguardandoPecaId === s.id
                        ? 'border-yellow-500 bg-yellow-500/10 text-white'
                        : 'border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="servico-aguardando-peca"
                      checked={servicoAguardandoPecaId === s.id}
                      onChange={() => setServicoAguardandoPecaId(s.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className={`font-bold ${SETOR_CORES[s.setor].badge}`}>
                        {SETOR_PREFIX[s.setor]}
                      </span>{' '}
                      {s.descricao}
                    </span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={descricaoPecaInput}
                onChange={(e) => setDescricaoPecaInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmarAguardandoPeca();
                  if (e.key === 'Escape') {
                    setModalAguardandoPeca(false);
                    setServicoAguardandoPecaId(null);
                    setDescricaoPecaInput('');
                  }
                }}
                placeholder="Ex.: FILTRO DE ÓLEO"
                autoFocus
                className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white uppercase mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalAguardandoPeca(false);
                    setServicoAguardandoPecaId(null);
                    setDescricaoPecaInput('');
                  }}
                  className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarAguardandoPeca}
                  disabled={alterandoStatus != null}
                  className="rounded bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-400 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-300 uppercase text-xs">
              <tr>
                <th className="px-1 py-1.5 text-left w-[8.5rem] max-w-[8.5rem]">Veículo</th>
                <th className="px-3 py-2 text-left">Setor</th>
                <th className="px-3 py-2 text-left">Serviço</th>
                <th className="px-3 py-2 text-left">Profissional</th>
                <th className="px-3 py-2 text-left">Tempo</th>
                <th className="px-3 py-2 text-right w-[1%] whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {organizacao.secoes.map(({ secao, grupos }) => (
                <Fragment key={secao.id}>
                  <tr className={`${secao.headerClass} border-b border-slate-700`}>
                    <td
                      colSpan={6}
                      className={`px-3 py-2 text-xs font-bold uppercase tracking-wide ${secao.headerTextClass}`}
                    >
                      {secao.titulo}
                    </td>
                  </tr>
                  {grupos.map((grupo) => {
                const servicosPrincipais = servicosAbertosAdmin(grupo.servicos);
                const todosFinalizados =
                  grupo.servicos.length > 0 &&
                  grupo.servicos.every((sv) => sv.status === 'FINALIZADO');
                const finalizados = grupo.servicos.length - servicosPrincipais.length;

                const acoesVeiculo = (
                  <AcoesVeiculoAdmin
                    grupo={grupo}
                    finalizados={finalizados}
                    expandido={expandido}
                    onToggleExpandido={() => {
                      setConfirmarExclusao(null);
                      setConfirmarFinalizacao(null);
                      setExpandido(expandido === grupo.veiculoId ? null : grupo.veiculoId);
                    }}
                    confirmarExclusao={confirmarExclusao}
                    confirmarFinalizacao={confirmarFinalizacao}
                    onToggleExclusao={() => {
                      setConfirmarFinalizacao(null);
                      setConfirmarExclusao(
                        confirmarExclusao === grupo.veiculoId ? null : grupo.veiculoId,
                      );
                    }}
                    onToggleFinalizacao={() => {
                      setConfirmarExclusao(null);
                      setConfirmarFinalizacao(
                        confirmarFinalizacao === grupo.veiculoId ? null : grupo.veiculoId,
                      );
                    }}
                    acaoVeiculo={acaoVeiculo}
                    onFinalizar={() => executarFinalizacao(grupo)}
                    onExcluir={() => executarExclusao(grupo)}
                  />
                );

                const insumoPendente = grupoTemInsumoPendente(grupo);

                return (
                <Fragment key={`${secao.id}-${grupo.veiculoId}`}>
                  {servicosPrincipais.length === 0 ? (
                    <tr className={`border-b border-slate-700 bg-slate-800/50 text-slate-200 transition-colors hover:bg-slate-700/70 hover:text-white ${bordaInsumoPendenteAdmin(insumoPendente)}`}>
                      <CelulaVeiculoAdmin
                        grupo={grupo}
                        badge={
                          todosFinalizados ? (
                            <span className="text-[10px] text-amber-300 font-semibold normal-case leading-tight">
                              Aguardando encerramento
                            </span>
                          ) : undefined
                        }
                      />
                      <td colSpan={4} className="px-3 py-2 italic opacity-90">
                        {finalizados} serviço{finalizados !== 1 ? 's' : ''} finalizado
                        {finalizados !== 1 ? 's' : ''} — abra Detalhes para ver
                      </td>
                      <td className="pl-3 pr-2 py-2 align-top text-right w-[1%] whitespace-nowrap">{acoesVeiculo}</td>
                    </tr>
                  ) : (
                  (() => {
                    const statusLinha = statusDominanteGrupo(servicosPrincipais);
                    const rowColor = STATUS_COLORS[statusLinha];
                    const selecionado = veiculoSelecionado === grupo.veiculoId;

                    return (
                      <tr
                        onClick={() => {
                          setConfirmarExclusao(null);
                          setConfirmarFinalizacao(null);
                          if (selecionado) {
                            setVeiculoSelecionado(null);
                          } else if (servicosPrincipais.length > 0) {
                            setVeiculoSelecionado(grupo.veiculoId);
                          }
                        }}
                        className={`border-b border-slate-800 cursor-pointer ${hoverLinhaAdmin(statusLinha)} ${rowColor.bg} ${rowColor.text} ${bordaInsumoPendenteAdmin(insumoPendente)} ${
                          selecionado ? 'shadow-[inset_0_0_0_3px_rgba(59,130,246,0.9)]' : ''
                        }`}
                      >
                        <CelulaVeiculoAdmin grupo={grupo} />
                        <CelulasServicosAgregados
                          servicos={servicosPrincipais}
                          profissionais={profissionais}
                          profissionalEditando={profissionalEditando}
                          onEditarProfissional={setProfissionalEditando}
                          onAtualizado={carregar}
                        />
                        <td className="pl-3 pr-2 py-2 align-top text-right w-[1%] whitespace-nowrap">{acoesVeiculo}</td>
                      </tr>
                    );
                  })()
                  )}
                  {expandido === grupo.veiculoId && (
                    <tr className="bg-slate-800/30">
                      <td colSpan={6} className="px-6 py-4 text-slate-300">
                        <div className="space-y-6">
                          {grupo.servicos.map((s) => (
                            <div
                              key={s.id}
                              className={`border rounded-lg p-4 transition-colors ${
                                s.status === 'FINALIZADO'
                                  ? 'border-green-700 bg-green-950/30 hover:border-green-500 hover:bg-green-950/50'
                                  : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/70'
                              }`}
                            >
                              <p className="font-semibold text-white mb-3 flex flex-wrap items-center gap-2">
                                <SelectSetorServico
                                  servicoId={s.id}
                                  setor={s.setor}
                                  onAtualizado={carregar}
                                  disabled={s.status === 'FINALIZADO' || s.status === 'CONCLUIDO'}
                                />
                                <span>— {s.descricao}</span>
                                {s.status === 'FINALIZADO' && (
                                  <span className="ml-2 text-xs font-semibold text-green-300 uppercase">
                                    Finalizado
                                  </span>
                                )}
                              </p>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Profissional:</strong>{' '}
                                  {s.status === 'AGUARDANDO_INSUMO'
                                    ? nomeCompletoProfissionalSolicitouPeca(s) ||
                                      s.finalizadoPor?.nome ||
                                      s.profissional?.nome ||
                                      '—'
                                    : s.finalizadoPor?.nome ?? s.profissional?.nome ?? '—'}
                                </div>
                                {s.status === 'SERVICO_EXTERNO' && (
                                  <div>
                                    <strong>Local:</strong> {s.localExterno?.trim() || '—'}
                                  </div>
                                )}
                                <div>
                                  <strong>Status:</strong> {STATUS_LABELS[s.status]}
                                </div>
                                <div>
                                  <strong>Início:</strong> {formatHora(s.horaInicio)}
                                </div>
                                <div>
                                  <strong>Término:</strong> {formatHora(s.horaTermino)}
                                </div>
                                <CampoOQueFoiFeito servico={s} />
                                <div className="col-span-2">
                                  <strong>Aguardando peça:</strong>
                                  <ListaSolicitacoesAdmin
                                    servico={s}
                                    aguardarPeca
                                    onAtender={atenderInsumo}
                                    onDesatender={desatenderInsumo}
                                    onEstornar={estornarInsumo}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <strong>Insumos:</strong>
                                  <ListaSolicitacoesAdmin
                                    servico={s}
                                    aguardarPeca={false}
                                    onAtender={atenderInsumo}
                                    onDesatender={desatenderInsumo}
                                    onEstornar={estornarInsumo}
                                  />
                                </div>
                                {(s.fotoAntes || s.fotoDepois) && (
                                  <div className="col-span-2 flex gap-4">
                                    {s.fotoAntes && (
                                      <img src={mediaUrl(s.fotoAntes)} alt="Antes" className="h-24 rounded" />
                                    )}
                                    {s.fotoDepois && (
                                      <img src={mediaUrl(s.fotoDepois)} alt="Depois" className="h-24 rounded" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="bg-neutral-100 border-t-2 border-neutral-800 shrink-0 text-black select-none">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="font-bold text-xs whitespace-nowrap bg-yellow-300 border border-neutral-800 px-2 py-1 rounded-sm">
            CADASTRO RÁPIDO
          </span>
          <input
            type="text"
            placeholder="CARRO"
            value={veiculoNumeroInput}
            onChange={(e) => setVeiculoNumeroInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDownCadastro}
            className="w-28 border border-neutral-800 rounded-sm px-2 py-1 text-xs font-mono font-bold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={garagemId}
            onChange={(e) => setGaragemId(e.target.value)}
            className="border border-neutral-800 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[11rem]"
            title="Garagem"
          >
            <option value="">GARAGEM</option>
            {garagens.map((g) => (
              <option key={g.id} value={g.id}>
                {g.rotulo ?? `${g.nome} - ${g.estado}`}
              </option>
            ))}
          </select>
          <select
            value={setor}
            onChange={(e) => setSetor(e.target.value as Setor)}
            className={`border border-neutral-800 rounded-sm px-2 py-1 text-xs uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold ${SETOR_CORES[setor].select}`}
          >
            {SETORES.map((s) => (
              <option key={s} value={s}>{SETOR_QUADRO[s]}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={
              setor === 'OUTRO'
                ? 'REVISÃO PREVENTIVA (opcional)'
                : setor === 'APS'
                  ? 'REVISÃO ANÁPOLIS (opcional)'
                  : setor === 'CGB'
                    ? 'REVISÃO DE CUIABÁ (opcional)'
                    : 'Descrição do serviço'
            }
            value={descricao}
            onChange={(e) => setDescricao(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDownCadastro}
            className="flex-1 border border-neutral-800 rounded-sm px-2 py-1 text-xs uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {mensagem && (
            <span className="text-blue-800 text-sm font-semibold whitespace-nowrap">{mensagem}</span>
          )}
          <span className="text-neutral-600 text-xs whitespace-nowrap ml-auto">ENTER = adicionar</span>
        </div>
      </footer>
    </div>
  );
}
