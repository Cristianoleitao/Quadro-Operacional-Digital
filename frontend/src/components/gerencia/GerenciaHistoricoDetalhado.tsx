import { useMemo, useState } from 'react';
import type { AuditoriaResponse, DashboardGerencia } from '../../lib/api';
import type { HistoricoInsumo, Servico } from '../../types';
import { BadgeSetor } from '../BadgeSetor';
import { STATUS_LABELS } from '../../types';
import { numeroOsExibicao, textoAguardandoPecaPendente, veiculoNumero } from '../../lib/servico';
import {
  COLUNAS_OPCIONAIS_HISTORICO,
  formatDataBr,
  linhasInsumoHistorico,
  profissionaisDoHistorico,
  resumoEstoque,
  resumoInsumosServico,
  rotuloGaragemServico,
  somaTempoServicos,
  textoBuscaInsumo,
  textoBuscaServico,
  textoCorrecaoResumo,
  type ColunaOpcionalHistorico,
} from '../../lib/historicoGerencia';
import {
  exportarHistoricoExcel,
  exportarHistoricoPdf,
  type MetaExportacaoGerencia,
} from '../../lib/gerenciaExport';

type AbaHistorico = 'servicos' | 'estoque';

const COLUNAS_BASE_SERVICOS = 8;

const chipDestaqueNome =
  'inline-block rounded-md bg-amber-500/25 border border-amber-400/60 text-amber-100 font-bold px-2.5 py-1 shadow-sm shadow-amber-950/40';
const chipDestaqueData =
  'inline-block rounded-md bg-sky-500/25 border border-sky-400/60 text-sky-100 font-bold px-2.5 py-1 tabular-nums shadow-sm shadow-sky-950/40';
const chipDestaqueTempo =
  'inline-block rounded-md bg-emerald-500/30 border border-emerald-400/70 text-emerald-100 font-black px-3 py-1 text-base tabular-nums shadow-sm shadow-emerald-950/40';

function toggleColuna(
  atual: Set<ColunaOpcionalHistorico>,
  coluna: ColunaOpcionalHistorico,
): Set<ColunaOpcionalHistorico> {
  const next = new Set(atual);
  if (next.has(coluna)) next.delete(coluna);
  else next.add(coluna);
  return next;
}

export function GerenciaHistoricoDetalhado({
  historico,
  historicoInsumos,
  dashboard,
  auditoria,
  meta,
  carregando,
  dataDia,
  dataAte,
  modoIntervalo,
  periodoDias,
  periodoTexto,
  onDataDiaChange,
  onDataAteChange,
  onModoIntervaloChange,
  onLimparPeriodo,
}: {
  historico: Servico[];
  historicoInsumos: HistoricoInsumo[];
  dashboard: DashboardGerencia | null;
  auditoria: AuditoriaResponse['registros'];
  meta: MetaExportacaoGerencia;
  carregando?: boolean;
  dataDia: string;
  dataAte: string;
  modoIntervalo: boolean;
  periodoDias: number;
  periodoTexto: string;
  onDataDiaChange: (valor: string) => void;
  onDataAteChange: (valor: string) => void;
  onModoIntervaloChange: (valor: boolean) => void;
  onLimparPeriodo: () => void;
}) {
  const [aba, setAba] = useState<AbaHistorico>('servicos');
  const [filtro, setFiltro] = useState('');
  const [filtroProfissionalId, setFiltroProfissionalId] = useState('');
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<ColunaOpcionalHistorico>>(
    () => new Set(),
  );
  const [filtroEstoque, setFiltroEstoque] = useState('');
  const [tipoEstoque, setTipoEstoque] = useState<'todos' | 'peca' | 'insumo'>('todos');
  const [statusEstoque, setStatusEstoque] = useState<'todos' | 'pendente' | 'atendido'>('todos');
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null);

  const periodoPersonalizado = Boolean(dataDia);
  const periodoInvalido = Boolean(
    modoIntervalo && dataDia && dataAte && dataDia > dataAte,
  );

  const profissionaisHistorico = useMemo(() => profissionaisDoHistorico(historico), [historico]);

  const mostraColuna = (id: ColunaOpcionalHistorico) => colunasVisiveis.has(id);

  const totalColunasServicos =
    COLUNAS_BASE_SERVICOS + colunasVisiveis.size;

  const servicosFiltrados = useMemo(() => {
    let lista = historico;
    if (filtroProfissionalId) {
      lista = lista.filter((s) => s.profissional?.id === filtroProfissionalId);
    }
    const termo = filtro.trim().toUpperCase();
    if (termo) {
      lista = lista.filter((s) => textoBuscaServico(s).includes(termo));
    }
    return lista;
  }, [historico, filtro, filtroProfissionalId]);

  const tempoTotalProfissional = useMemo(
    () => somaTempoServicos(servicosFiltrados),
    [servicosFiltrados],
  );

  const nomeProfissionalFiltrado = useMemo(
    () => profissionaisHistorico.find((p) => p.id === filtroProfissionalId)?.nome ?? '',
    [profissionaisHistorico, filtroProfissionalId],
  );

  const insumosFiltrados = useMemo(() => {
    let lista = historicoInsumos;
    if (tipoEstoque === 'peca') lista = lista.filter((i) => i.aguardarPeca);
    if (tipoEstoque === 'insumo') lista = lista.filter((i) => !i.aguardarPeca);
    if (statusEstoque === 'pendente') lista = lista.filter((i) => !i.atendido);
    if (statusEstoque === 'atendido') lista = lista.filter((i) => i.atendido);
    const termo = filtroEstoque.trim().toUpperCase();
    if (!termo) return lista;
    return lista.filter((i) => textoBuscaInsumo(i).includes(termo));
  }, [historicoInsumos, filtroEstoque, tipoEstoque, statusEstoque]);

  const linhasEstoque = useMemo(
    () => linhasInsumoHistorico(insumosFiltrados),
    [insumosFiltrados],
  );

  const resumo = useMemo(() => resumoEstoque(historicoInsumos), [historicoInsumos]);

  const temDadosExport = servicosFiltrados.length > 0 || insumosFiltrados.length > 0;

  const exportarPdf = async () => {
    if (!dashboard) return;
    setExportando('pdf');
    try {
      exportarHistoricoPdf(dashboard, servicosFiltrados, insumosFiltrados, meta);
    } finally {
      setExportando(null);
    }
  };

  const exportarExcel = async () => {
    if (!dashboard) return;
    setExportando('excel');
    try {
      exportarHistoricoExcel(dashboard, servicosFiltrados, insumosFiltrados, auditoria, meta);
    } finally {
      setExportando(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Histórico detalhado</h2>
          <p className="text-slate-500 text-sm mt-1">
            {aba === 'servicos'
              ? `${servicosFiltrados.length} serviço${servicosFiltrados.length !== 1 ? 's' : ''}`
              : `${insumosFiltrados.length} solicitação${insumosFiltrados.length !== 1 ? 'ões' : ''} de estoque/insumos`}
            {' — '}
            <span className="text-slate-400">{periodoTexto}</span>
            {' — '}exclusões por erro de cadastro não entram nas métricas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dashboard || exportando != null || !temDadosExport}
            onClick={() => void exportarPdf()}
            className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2"
          >
            {exportando === 'pdf' ? 'Gerando PDF…' : 'Exportar PDF'}
          </button>
          <button
            type="button"
            disabled={!dashboard || exportando != null || !temDadosExport}
            onClick={() => void exportarExcel()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2"
          >
            {exportando === 'excel' ? 'Gerando Excel…' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-1">
        <button
          type="button"
          onClick={() => setAba('servicos')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            aba === 'servicos'
              ? 'border-blue-500 text-white bg-slate-800/80'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Serviços
        </button>
        <button
          type="button"
          onClick={() => setAba('estoque')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            aba === 'estoque'
              ? 'border-amber-500 text-white bg-slate-800/80'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Estoque e insumos
          {resumo.pendentes > 0 && (
            <span className="ml-2 rounded-full bg-amber-600 text-white text-xs px-2 py-0.5">
              {resumo.pendentes} pend.
            </span>
          )}
        </button>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-3 space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Filtros do histórico</p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-slate-300">
            <span className="block text-xs text-slate-500 mb-1">Dia</span>
            <input
              type="date"
              value={dataDia}
              onChange={(e) => onDataDiaChange(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            <span className="block text-xs text-slate-500 mb-1">Profissional</span>
            <select
              value={filtroProfissionalId}
              onChange={(e) => setFiltroProfissionalId(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm min-w-[12rem]"
            >
              <option value="">Todos</option>
              {profissionaisHistorico.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-300 pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={modoIntervalo}
              onChange={(e) => onModoIntervaloChange(e.target.checked)}
              className="rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            Intervalo de datas
          </label>
          {modoIntervalo ? (
            <label className="text-sm text-slate-300">
              <span className="block text-xs text-slate-500 mb-1">Até</span>
              <input
                type="date"
                value={dataAte}
                min={dataDia || undefined}
                onChange={(e) => onDataAteChange(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          {periodoPersonalizado ? (
            <button
              type="button"
              onClick={() => {
                onLimparPeriodo();
                setFiltroProfissionalId('');
              }}
              className="rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 px-3 py-2 text-sm"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
        {periodoInvalido ? (
          <p className="text-xs text-red-400">A data inicial não pode ser posterior à data final.</p>
        ) : filtroProfissionalId && dataDia ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-400">
            <span className={chipDestaqueNome}>{nomeProfissionalFiltrado}</span>
            <span>em</span>
            <span className={chipDestaqueData}>
              {modoIntervalo && dataAte && dataAte !== dataDia
                ? `${formatDataBr(dataDia)} até ${formatDataBr(dataAte)}`
                : formatDataBr(dataDia)}
            </span>
            <span className="text-slate-600">·</span>
            <span>
              {servicosFiltrados.length} serviço{servicosFiltrados.length !== 1 ? 's' : ''}
            </span>
            <span className="text-slate-600">·</span>
            <span>tempo total</span>
            <span className={chipDestaqueTempo}>{tempoTotalProfissional.totalMin} min</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {dataDia
              ? 'Selecione um dia e combine com o profissional para ver os serviços realizados (ex.: o que o João fez naquele dia).'
              : `Sem dia informado: exibindo os últimos ${periodoDias} dias. Escolha um dia para consultar um período específico.`}
          </p>
        )}
      </div>

      {aba === 'servicos' ? (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <input
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por veículo, OS, setor, serviço…"
              className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
            />
          </div>

          {filtroProfissionalId && !dataDia ? (
            <div className="rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-400">
              <span className={chipDestaqueNome}>{nomeProfissionalFiltrado}</span>
              <span className="text-slate-600">·</span>
              <span>tempo total</span>
              <span className={chipDestaqueTempo}>{tempoTotalProfissional.totalMin} min</span>
              <span className="text-slate-500 text-xs w-full sm:w-auto">
                ({tempoTotalProfissional.servicosComTempo} de {servicosFiltrados.length} serviço
                {servicosFiltrados.length !== 1 ? 's' : ''} com tempo registrado)
              </span>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Mostrar colunas</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {COLUNAS_OPCIONAIS_HISTORICO.map((col) => (
                <label
                  key={col.id}
                  className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={mostraColuna(col.id)}
                    onChange={() =>
                      setColunasVisiveis((atual) => toggleColuna(atual, col.id))
                    }
                    className="rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-auto max-h-[32rem] rounded-xl border border-slate-700">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-800 text-slate-300 uppercase text-xs sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Garagem</th>
                  <th className="px-3 py-2 text-left">Veículo</th>
                  <th className="px-3 py-2 text-left">OS</th>
                  <th className="px-3 py-2 text-left">Setor</th>
                  <th className="px-3 py-2 text-left">Serviço</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Profissional</th>
                  {mostraColuna('tempo') ? (
                    <th className="px-3 py-2 text-right">Tempo</th>
                  ) : null}
                  {mostraColuna('insumos') ? (
                    <th className="px-3 py-2 text-left">Insumos / peças</th>
                  ) : null}
                  {mostraColuna('pecaPendente') ? (
                    <th className="px-3 py-2 text-left">Peça pend.</th>
                  ) : null}
                  {mostraColuna('correcao') ? (
                    <th className="px-3 py-2 text-left">Correção / finalização</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={totalColunasServicos} className="px-3 py-8 text-center text-slate-500">
                      Carregando histórico…
                    </td>
                  </tr>
                ) : servicosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={totalColunasServicos} className="px-3 py-8 text-center text-slate-500">
                      Nenhum registro encontrado
                    </td>
                  </tr>
                ) : (
                  servicosFiltrados.map((s) => (
                    <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap tabular-nums">
                        {new Date(s.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs max-w-[8rem]">
                        {rotuloGaragemServico(s)}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-white">{veiculoNumero(s)}</td>
                      <td className="px-3 py-2 text-slate-300">{numeroOsExibicao(s)}</td>
                      <td className="px-3 py-2">
                        <BadgeSetor setor={s.setor} />
                      </td>
                      <td className="px-3 py-2 text-slate-200 max-w-[12rem]">{s.descricao}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                        {STATUS_LABELS[s.status]}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{s.profissional?.nome ?? '—'}</td>
                      {mostraColuna('tempo') ? (
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">
                          {s.tempoTotalMin != null ? `${s.tempoTotalMin} min` : '—'}
                        </td>
                      ) : null}
                      {mostraColuna('insumos') ? (
                        <td className="px-3 py-2 text-slate-400 text-xs max-w-[14rem]">
                          {resumoInsumosServico(s)}
                        </td>
                      ) : null}
                      {mostraColuna('pecaPendente') ? (
                        <td className="px-3 py-2 text-red-400 text-xs uppercase max-w-[10rem]">
                          {textoAguardandoPecaPendente(s) || '—'}
                        </td>
                      ) : null}
                      {mostraColuna('correcao') ? (
                        <td className="px-3 py-2 text-slate-400 text-xs max-w-[12rem]">
                          {textoCorrecaoResumo(s)}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { rotulo: 'Total', valor: resumo.total, cor: 'text-white' },
              { rotulo: 'Peças', valor: resumo.pecas, cor: 'text-red-400' },
              { rotulo: 'Insumos', valor: resumo.insumos, cor: 'text-blue-400' },
              { rotulo: 'Pendentes', valor: resumo.pendentes, cor: 'text-amber-400' },
              { rotulo: 'Atendidos', valor: resumo.atendidos, cor: 'text-emerald-400' },
              { rotulo: 'Peças pendentes', valor: resumo.pecasPendentes, cor: 'text-red-300' },
            ].map((c) => (
              <div
                key={c.rotulo}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-center"
              >
                <p className="text-xs text-slate-500 uppercase">{c.rotulo}</p>
                <p className={`text-xl font-bold tabular-nums ${c.cor}`}>{c.valor}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <input
              type="search"
              value={filtroEstoque}
              onChange={(e) => setFiltroEstoque(e.target.value)}
              placeholder="Filtrar insumos, veículo, solicitante…"
              className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
            />
            <label className="text-sm text-slate-300">
              <span className="block text-xs text-slate-500 mb-1">Tipo</span>
              <select
                value={tipoEstoque}
                onChange={(e) => setTipoEstoque(e.target.value as typeof tipoEstoque)}
                className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="peca">Aguardando peça</option>
                <option value="insumo">Insumo operacional</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="block text-xs text-slate-500 mb-1">Status</span>
              <select
                value={statusEstoque}
                onChange={(e) => setStatusEstoque(e.target.value as typeof statusEstoque)}
                className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="atendido">Atendido</option>
              </select>
            </label>
          </div>

          <div className="overflow-auto max-h-[32rem] rounded-xl border border-amber-900/40">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-800 text-slate-300 uppercase text-xs sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left">Solicitação</th>
                  <th className="px-3 py-2 text-left">Atendimento</th>
                  <th className="px-3 py-2 text-left">Garagem</th>
                  <th className="px-3 py-2 text-left">Veículo</th>
                  <th className="px-3 py-2 text-left">OS</th>
                  <th className="px-3 py-2 text-left">Setor serv.</th>
                  <th className="px-3 py-2 text-left">Serviço</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Solicitado por</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                      Carregando histórico de estoque…
                    </td>
                  </tr>
                ) : linhasEstoque.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                      Nenhuma solicitação de insumo ou peça no período
                    </td>
                  </tr>
                ) : (
                  linhasEstoque.map((l, idx) => {
                    const origem = insumosFiltrados[idx];
                    const pendente = !origem?.atendido;
                    return (
                      <tr
                        key={origem?.id ?? idx}
                        className={`border-t border-slate-800 hover:bg-slate-800/50 ${
                          pendente ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap tabular-nums">
                          {l.dataSolicitacao}
                        </td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap tabular-nums text-xs">
                          {l.dataAtendimento}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{l.garagem}</td>
                        <td className="px-3 py-2 font-mono font-bold text-white">{l.veiculo}</td>
                        <td className="px-3 py-2 text-slate-300">{l.os}</td>
                        <td className="px-3 py-2">
                          {origem?.servico?.setor ? (
                            <BadgeSetor setor={origem.servico.setor} />
                          ) : (
                            l.setorServico
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-200 max-w-[10rem]">{l.servico}</td>
                        <td className="px-3 py-2 text-slate-200 font-medium">{l.insumo}</td>
                        <td className="px-3 py-2 text-xs uppercase whitespace-nowrap">
                          <span
                            className={
                              l.tipo === 'Aguardando peça' ? 'text-red-400' : 'text-blue-400'
                            }
                          >
                            {l.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold uppercase ${
                              pendente ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">{l.solicitadoPor}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            Setor Estoque: atendimentos registrados pelo perfil de estoque. Insumos operacionais
            aparecem separados das peças que colocam o veículo em aguardando peça.
          </p>
        </>
      )}
    </section>
  );
}
