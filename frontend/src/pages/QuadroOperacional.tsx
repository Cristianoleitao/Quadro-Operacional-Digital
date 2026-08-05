import { Fragment, useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { api, connectWebSocket } from '../lib/api';
import {
  organizarQuadroPorSecao,
  alertaPrazoVeiculo,
  classeFundoPrazoVeiculo,
  contarLinhasVisuaisQuadro,
  dataVeiculoQuadro,
  ESTILO_QUADRO,
  horaInputVeiculo,
  linhaVeiculoRowClass,
  mapaServicosPorVeiculo,
  medirLayoutEscalaQuadro,
  osInputVeiculo,
  idsVeiculosSaidaPrioritaria,
  saidaVeiculoQuadro,
  type AlertaPrazoVeiculo,
  type LinhaVeiculoQuadro,
  type SecaoQuadro,
} from '../lib/quadro';
import type { Servico, Garagem } from '../types';
import { SETOR_PREFIX } from '../types';
import { textoAguardandoPecaQuadro, isPreventivaRev, participantesExibicao, textoPreventivaRev, textosPecaPendenteDoProfissional, textosPecaPendenteOrfas } from '../lib/servico';
import { ChipSetor, classeNomeProfissionalServico, classeNomeSolicitantePeca } from '../components/BadgeSetor';
import { InputProfissionalServico, primeiroNome } from '../components/InputProfissionalServico';

const COLUNAS = [
  { key: 'carro', label: 'CARRO' },
  { key: 'data', label: 'DATA' },
  { key: 'hora', label: 'HORA' },
  { key: 'os', label: 'OS' },
  { key: 'descricao', label: 'SERVIÇO' },
  { key: 'saida', label: 'SAÍDA' },
] as const;

const estilo = ESTILO_QUADRO;

function Relogio() {
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-right font-mono tabular-nums leading-tight">
      <div className="text-lg font-bold text-white">{hora.toLocaleTimeString('pt-BR')}</div>
      <div className="text-[10px] text-slate-400">
        {hora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
}

function CabecalhoColunas() {
  return (
    <tr className="bg-neutral-300 text-black">
      {COLUNAS.map((col) => (
        <th
          key={col.key}
          className={`border border-neutral-800 font-bold uppercase ${
            col.key === 'descricao'
              ? `${estilo.thServico} text-left`
              : `${estilo.th} text-center`
          }`}
        >
          {col.label}
        </th>
      ))}
    </tr>
  );
}

function FaixaSecao({ secao }: { secao: SecaoQuadro }) {
  return (
    <tr className={`${secao.headerClass} [&>td]:bg-inherit`}>
      <td
        colSpan={COLUNAS.length}
        className={`border border-neutral-800 text-center font-bold tracking-wide align-middle ${estilo.tituloSecao} ${secao.headerTextClass}`}
      >
        {secao.titulo}
      </td>
    </tr>
  );
}

function CelulaServicos({
  servicos,
  textoClaro,
  profissionais,
  servicoProfissionalEditando,
  onEditarProfissional,
  onProfissionalAtualizado,
}: {
  servicos: Servico[];
  textoClaro: boolean;
  profissionais: Array<{ id: string; nome: string; matricula: string; setor?: string | null }>;
  servicoProfissionalEditando: string | null;
  onEditarProfissional: (servicoId: string | null) => void;
  onProfissionalAtualizado: () => void;
}) {
  return (
    <td className={`border border-neutral-800 align-middle font-medium ${estilo.tdServico}`}>
      <div className="flex flex-wrap items-center justify-start content-center gap-x-3 gap-y-1.5 w-full h-full min-h-[1em] text-left">
        {servicos.map((s, i) => {
          const editando = servicoProfissionalEditando === s.id;
          const aguardandoPeca = s.status === 'AGUARDANDO_INSUMO';
          const textoAguardando = aguardandoPeca ? textoAguardandoPecaQuadro(s) : '';
          const preventiva = isPreventivaRev(s);
          const exibicao = preventiva ? participantesExibicao(s) : [];

          if (preventiva) {
            return (
              <Fragment key={s.id}>
                {i > 0 && (
                  <span
                    className={`${estilo.separador} mx-1 font-bold self-center shrink-0 ${
                      textoClaro ? 'text-white/70' : 'text-neutral-600'
                    }`}
                  >
                    /
                  </span>
                )}
                <div className="inline-flex flex-wrap items-center justify-start gap-x-1 gap-y-0.5 min-w-0 max-w-full leading-snug text-left">
                  <span className="break-words text-left font-semibold uppercase">
                    {textoPreventivaRev(s)}
                  </span>
                  {exibicao.map((p, pi) => {
                    const setorP = p.profissional?.setor ?? s.setor;
                    const nome = p.profissional?.nome
                      ? primeiroNome(p.profissional.nome)
                      : SETOR_PREFIX[setorP];
                    const obs = !p.horaTermino ? p.obs?.trim() : undefined;
                    const pecas = !p.horaTermino
                      ? textosPecaPendenteDoProfissional(s, p.profissionalId)
                      : [];
                    return (
                      <Fragment key={p.id}>
                        {pi > 0 && (
                          <span
                            className={`${estilo.separador} mx-0.5 font-bold self-center shrink-0 ${
                              textoClaro ? 'text-white/70' : 'text-neutral-600'
                            }`}
                          >
                            /
                          </span>
                        )}
                        <span className="inline-flex items-center gap-x-1 flex-wrap">
                          {obs ? (
                            <span
                              className="break-words font-normal uppercase text-black"
                              title={`OBS ${SETOR_PREFIX[setorP]}`}
                            >
                              {obs}
                            </span>
                          ) : null}
                          {pecas.map((peca) => (
                            <span
                              key={peca}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black uppercase bg-yellow-300 text-black"
                              title="Peça solicitada ao estoque"
                            >
                              {peca}
                            </span>
                          ))}
                          <span
                            className={`${classeNomeProfissionalServico(setorP, p.pausadoEm)}`}
                            title={p.profissional?.nome ?? SETOR_PREFIX[setorP]}
                          >
                            {nome}
                          </span>
                        </span>
                      </Fragment>
                    );
                  })}
                  {textosPecaPendenteOrfas(s).map((peca) => (
                    <Fragment key={`orf-${peca}`}>
                      <span
                        className={`${estilo.separador} mx-0.5 font-bold self-center shrink-0 ${
                          textoClaro ? 'text-white/70' : 'text-neutral-600'
                        }`}
                      >
                        /
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black uppercase bg-yellow-300 text-black">
                        {peca}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </Fragment>
            );
          }

          const badgeProfissional = classeNomeProfissionalServico(s.setor, s.pausadoEm);
          const temProfissional = Boolean(s.profissional?.nome);
          const badgeSetorOuProfissional = temProfissional ? (
            <span className={`${badgeProfissional} mr-0.5`}>
              {primeiroNome(s.profissional!.nome)}
            </span>
          ) : (
            <ChipSetor setor={s.setor} className="mr-0.5" />
          );
          return (
            <Fragment key={s.id}>
              {i > 0 && (
                <span
                  className={`${estilo.separador} mx-1 font-bold self-center shrink-0 ${
                    textoClaro ? 'text-white/70' : 'text-neutral-600'
                  }`}
                >
                  /
                </span>
              )}
              <div className="inline-flex flex-wrap items-center justify-start gap-x-1 gap-y-0.5 min-w-0 max-w-full leading-snug text-left">
              {aguardandoPeca ? (
                badgeSetorOuProfissional
              ) : editando ? (
                <InputProfissionalServico
                  servicoId={s.id}
                  profissional={s.profissional}
                  profissionais={profissionais}
                  onAtualizado={onProfissionalAtualizado}
                  variant="quadro"
                  editando
                  onEditandoChange={(ativo) => onEditarProfissional(ativo ? s.id : null)}
                  badgeClass={badgeProfissional}
                  textoClaro={textoClaro}
                />
              ) : (
                badgeSetorOuProfissional
              )}
              <span
                role={aguardandoPeca ? undefined : 'button'}
                tabIndex={aguardandoPeca ? undefined : 0}
                className={`break-words text-left ${
                  aguardandoPeca ? '' : 'cursor-pointer hover:underline decoration-dotted underline-offset-2'
                }`}
                title={aguardandoPeca ? undefined : 'Clique para incluir profissional'}
                onClick={aguardandoPeca ? undefined : () => onEditarProfissional(editando ? null : s.id)}
                onKeyDown={
                  aguardandoPeca
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onEditarProfissional(editando ? null : s.id);
                        }
                      }
                }
              >
                {s.descricao}
              </span>
              {aguardandoPeca ? (
                textoAguardando ? (
                  <span className={classeNomeSolicitantePeca(textoClaro)} title="Aguardando peça">
                    {textoAguardando}
                  </span>
                ) : null
              ) : s.status === 'SERVICO_EXTERNO' ? (
                <>
                  {s.localExterno?.trim() ? (
                    <span className={badgeProfissional} title="Local do serviço externo">
                      {s.localExterno.trim().toUpperCase()}
                    </span>
                  ) : null}
                </>
              ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
    </td>
  );
}

function CelulaSaida({
  veiculo,
  secaoId,
  prioridade,
}: {
  veiculo: LinhaVeiculoQuadro['veiculoRef'];
  secaoId: string;
  prioridade: boolean;
}) {
  const tdBase = 'border border-neutral-800';

  if (secaoId !== 'corretiva') {
    return <td className={`${tdBase} text-center align-middle ${estilo.td}`} />;
  }

  const texto = saidaVeiculoQuadro(veiculo);
  if (!texto) {
    return <td className={`${tdBase} text-center align-middle ${estilo.td}`} />;
  }

  if (!prioridade) {
    return (
      <td
        className={`${tdBase} text-center align-middle font-mono tabular-nums whitespace-nowrap ${estilo.td} font-semibold`}
        title="Horário previsto de saída da oficina"
      >
        {texto}
      </td>
    );
  }

  return (
    <td
      className={`${tdBase} text-center align-middle font-mono tabular-nums whitespace-nowrap ${estilo.td} !bg-[#FF0000] !text-white font-bold`}
      title="Saída mais próxima — prioridade"
    >
      {texto}
    </td>
  );
}

function LinhaVeiculo({
  linha,
  secao,
  indice,
  alertaPrazo,
  profissionais,
  servicoProfissionalEditando,
  onEditarProfissional,
  onProfissionalAtualizado,
  saidaPrioritaria,
}: {
  linha: LinhaVeiculoQuadro;
  secao: SecaoQuadro;
  indice: number;
  alertaPrazo: AlertaPrazoVeiculo;
  profissionais: Array<{ id: string; nome: string; matricula: string; setor?: string | null }>;
  servicoProfissionalEditando: string | null;
  onEditarProfissional: (servicoId: string | null) => void;
  onProfissionalAtualizado: () => void;
  saidaPrioritaria: boolean;
}) {
  const rowClass = linhaVeiculoRowClass(linha.servicos, secao);
  const critico = linha.servicos.some((s) => s.status === 'PARADO_CRITICO');
  const fundoPrazo = critico ? '' : classeFundoPrazoVeiculo(alertaPrazo);
  const textoClaro =
    critico ||
    (secao.rowTextClass.includes('text-white') && alertaPrazo === 'nenhum');

  const zebra =
    secao.id === 'corretiva' && !critico && indice % 2 === 1 && alertaPrazo === 'nenhum'
      ? 'bg-neutral-100'
      : '';

  const tdBase = 'border border-neutral-800';

  return (
    <tr className={`${rowClass} ${fundoPrazo} ${zebra} [&>td]:bg-inherit`}>
      <td className={`${tdBase} text-center align-middle ${estilo.td} ${estilo.tdCarro}`}>
        {linha.veiculo}
      </td>
      <td className={`${tdBase} text-center align-middle tabular-nums whitespace-nowrap ${estilo.td}`}>
        {dataVeiculoQuadro(linha.veiculoRef, linha.servicos)}
      </td>
      <td className={`${tdBase} text-center align-middle tabular-nums whitespace-nowrap ${estilo.td}`}>
        {horaInputVeiculo(linha.veiculoRef, linha.servicos)}
      </td>
      <td className={`${tdBase} text-center align-middle font-mono tabular-nums whitespace-nowrap ${estilo.td}`}>
        {osInputVeiculo(linha.veiculoRef) || '—'}
      </td>
      <CelulaServicos
        servicos={linha.servicos}
        textoClaro={textoClaro}
        profissionais={profissionais}
        servicoProfissionalEditando={servicoProfissionalEditando}
        onEditarProfissional={onEditarProfissional}
        onProfissionalAtualizado={onProfissionalAtualizado}
      />
      <CelulaSaida
        veiculo={linha.veiculoRef}
        secaoId={secao.id}
        prioridade={saidaPrioritaria}
      />
    </tr>
  );
}

export default function QuadroOperacional() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [garagemId, setGaragemId] = useState(
    () => localStorage.getItem('quadro-garagem-id') ?? '',
  );
  const [profissionais, setProfissionais] = useState<
    Array<{ id: string; nome: string; matricula: string; setor?: string | null }>
  >([]);
  const [servicoProfissionalEditando, setServicoProfissionalEditando] = useState<string | null>(null);
  const areaQuadroRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const layoutRef = useRef({ fator: 1, larguraPx: 0 });
  const medindoRef = useRef(false);
  const [layout, setLayout] = useState({ fator: 1, larguraPx: 0 });

  const grupos = useMemo(() => organizarQuadroPorSecao(servicos), [servicos]);
  const contagemQuadro = useMemo(() => contarLinhasVisuaisQuadro(grupos), [grupos]);
  const servicosPorVeiculo = useMemo(() => mapaServicosPorVeiculo(servicos), [servicos]);
  const [agora, setAgora] = useState(() => new Date());
  const prioridadeSaidaIds = useMemo(() => {
    const corretiva = grupos.find((g) => g.secao.id === 'corretiva');
    if (!corretiva) return new Set<string>();
    return idsVeiculosSaidaPrioritaria(corretiva.linhas, agora);
  }, [grupos, agora]);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const medirEscala = useCallback(() => {
    if (medindoRef.current) return;
    const area = areaQuadroRef.current;
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    if (!area || !wrapper || !table) return;

    medindoRef.current = true;
    try {
      const resultado = medirLayoutEscalaQuadro(area, table, contagemQuadro.carros);
      if (!resultado) return;

      const { fator, larguraPx } = resultado;
      const prev = layoutRef.current;
      if (
        Math.abs(prev.fator - fator) < 0.002 &&
        Math.abs(prev.larguraPx - larguraPx) < 1
      ) {
        return;
      }

      const next = { fator, larguraPx };
      layoutRef.current = next;
      setLayout(next);
    } finally {
      medindoRef.current = false;
    }
  }, [contagemQuadro.carros]);

  useLayoutEffect(() => {
    if (grupos.length === 0) {
      const vazio = { fator: 1, larguraPx: 0 };
      layoutRef.current = vazio;
      setLayout(vazio);
      return;
    }

    let cancelled = false;
    const tentar = (tentativas = 0) => {
      if (cancelled) return;
      medirEscala();
      if (tentativas < 3 && layoutRef.current.larguraPx <= 0) {
        requestAnimationFrame(() => tentar(tentativas + 1));
      }
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => tentar());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [servicos, grupos.length, medirEscala]);

  useLayoutEffect(() => {
    const area = areaQuadroRef.current;
    if (!area) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => medirEscala());
    });
    observer.observe(area);

    const onResize = () => requestAnimationFrame(() => medirEscala());
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [medirEscala]);

  const garagemAtual = useMemo(
    () => garagens.find((g) => g.id === garagemId) ?? null,
    [garagens, garagemId],
  );

  useEffect(() => {
    api.getGaragens().then((lista) => {
      setGaragens(lista);
      if (!garagemId && lista.length > 0) {
        setGaragemId(lista[0].id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (garagemId) localStorage.setItem('quadro-garagem-id', garagemId);
  }, [garagemId]);

  const carregar = useCallback(async () => {
    try {
      const data = await api.getQuadro(garagemId || undefined);
      setServicos(data);
    } catch (err) {
      console.error(err);
    }
  }, [garagemId]);

  useEffect(() => {
    api.getProfissionais().then(setProfissionais).catch(console.error);
  }, []);

  useEffect(() => {
    carregar();
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') carregar();
    });
    return () => ws.close();
  }, [carregar]);

  return (
    <div className="fixed inset-0 flex flex-col w-screen h-[100dvh] overflow-hidden bg-white font-sans antialiased">
      <header className="grid grid-cols-3 items-center px-3 py-1.5 bg-slate-950 border-b border-slate-700 shrink-0 select-none z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <div className="text-2xl font-bold text-white tabular-nums leading-none">
              {contagemQuadro.carros}
            </div>
            <div className="text-[8px] text-slate-400 uppercase tracking-wide">Total carros</div>
          </div>
          {garagemAtual && (
            <div className="border-l border-slate-600 pl-3 min-w-0">
              <div className="text-xs font-bold text-amber-300 truncate leading-tight">
                {garagemAtual.nome}
              </div>
              <div className="text-[8px] text-slate-400 uppercase truncate">{garagemAtual.estado}</div>
            </div>
          )}
          {garagens.length > 1 && (
            <select
              value={garagemId}
              onChange={(e) => setGaragemId(e.target.value)}
              className="ml-1 max-w-[8rem] text-[10px] bg-slate-800 border border-slate-600 text-white rounded px-1 py-0.5 truncate"
              title="Selecionar garagem"
            >
              {garagens.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.rotulo ?? `${g.nome} - ${g.estado}`}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
            QUADRO OPERACIONAL DIGITAL
          </h1>
          <p className="text-slate-400 text-[10px]">Oficina de Manutenção de Ônibus</p>
        </div>
        <div className="flex justify-end">
          <Relogio />
        </div>
      </header>

      <div ref={areaQuadroRef} className="relative flex-1 w-full min-h-0 overflow-hidden bg-white select-none">
        {grupos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600 text-xl font-medium">
            Nenhum serviço em andamento
          </div>
        ) : (
          <div
            ref={wrapperRef}
            className="origin-top-left will-change-transform"
            style={
              layout.fator < 1
                ? {
                    transform: `scale(${layout.fator})`,
                    transformOrigin: 'top left',
                    width: layout.larguraPx > 0 ? `${layout.larguraPx}px` : '100%',
                  }
                : { width: '100%' }
            }
          >
            <table ref={tableRef} className="w-full border-collapse table-fixed bg-white">
              <colgroup>
                <col className="w-[64px]" />
                <col className="w-[78px]" />
                <col className="w-[58px]" />
                <col className="w-[62px]" />
                <col />
                <col className="w-[68px]" />
              </colgroup>
              <thead>
                <CabecalhoColunas />
              </thead>
              <tbody>
                {grupos.map(({ secao, linhas }) => (
                  <Fragment key={secao.id}>
                    <FaixaSecao secao={secao} />
                    {linhas.map((linha, i) => (
                      <LinhaVeiculo
                        key={`${secao.id}-${linha.veiculoId}`}
                          linha={linha}
                          secao={secao}
                          indice={i}
                          profissionais={profissionais}
                          servicoProfissionalEditando={servicoProfissionalEditando}
                          onEditarProfissional={setServicoProfissionalEditando}
                          onProfissionalAtualizado={carregar}
                          alertaPrazo={
                            secao.id === 'corretiva'
                              ? alertaPrazoVeiculo(
                                  linha.veiculoRef,
                                  servicosPorVeiculo.get(linha.veiculoId) ?? linha.servicos,
                                  agora,
                                )
                              : 'nenhum'
                          }
                          saidaPrioritaria={prioridadeSaidaIds.has(linha.veiculoId)}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
