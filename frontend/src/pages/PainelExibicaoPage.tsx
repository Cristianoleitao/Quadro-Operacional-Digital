import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, connectWebSocket } from '../lib/api';
import { liberadoPassouHorarioSaida } from '../lib/liberadoEscala';
import type { Garagem, Setor } from '../types';
import { SETOR_LABELS } from '../types';

type ServicoPainel = {
  descricao: string | null;
  setor: string;
  status: string;
  desde: string;
  profissional: string | null;
};

type ItemPainel = {
  veiculoId: string;
  numero: string;
  descricao: string | null;
  horaSaida?: string | null;
  servicos?: ServicoPainel[];
};

const FAIXAS = [
  {
    id: 'liberados' as const,
    titulo: 'LIBERADOS',
    faixaClass: 'bg-emerald-950',
    headerClass: 'bg-emerald-600 text-white',
    chipClass: 'bg-emerald-400 text-emerald-950 border-emerald-200',
    compacto: true,
  },
  {
    id: 'teste' as const,
    titulo: 'TESTE',
    faixaClass: 'bg-violet-950',
    headerClass: 'bg-violet-500 text-white',
    chipClass: 'bg-violet-200 text-violet-950 border-violet-100',
    compacto: true,
  },
  {
    id: 'manutencao' as const,
    titulo: 'EM SERVIÇO',
    faixaClass: 'bg-orange-950',
    headerClass: 'bg-orange-500 text-white',
    chipClass: 'bg-white text-orange-950 border-orange-200',
    compacto: true,
  },
] as const;

function labelSetor(setor: string) {
  return SETOR_LABELS[setor as Setor] ?? setor;
}

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
        {hora.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </div>
    </div>
  );
}

export default function PainelExibicaoPage() {
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [garagemId, setGaragemId] = useState(
    () => localStorage.getItem('quadro-garagem-id') ?? '',
  );
  const [liberados, setLiberados] = useState<ItemPainel[]>([]);
  const [teste, setTeste] = useState<ItemPainel[]>([]);
  const [manutencao, setManutencao] = useState<ItemPainel[]>([]);
  const [agora, setAgora] = useState(() => new Date());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const liberadosNaTela = useMemo(
    () => liberados.filter((item) => !liberadoPassouHorarioSaida(item.horaSaida, agora)),
    [liberados, agora],
  );

  const listas = useMemo(
    () => ({ liberados: liberadosNaTela, teste, manutencao }),
    [liberadosNaTela, teste, manutencao],
  );

  const selecionado = useMemo(() => {
    if (!selecionadoId) return null;
    const emTeste = teste.find((item) => item.veiculoId === selecionadoId);
    if (emTeste) return { titulo: 'TESTE', item: emTeste };
    const emServico = manutencao.find((item) => item.veiculoId === selecionadoId);
    if (emServico) return { titulo: 'EM SERVIÇO', item: emServico };
    return null;
  }, [selecionadoId, teste, manutencao]);

  const garagemAtual = useMemo(
    () => garagens.find((g) => g.id === garagemId) ?? null,
    [garagens, garagemId],
  );

  useEffect(() => {
    api
      .getGaragens()
      .then((lista) => {
        setGaragens(lista);
        if (!garagemId && lista.length > 0) setGaragemId(lista[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (garagemId) localStorage.setItem('quadro-garagem-id', garagemId);
  }, [garagemId]);

  const carregar = useCallback(async () => {
    try {
      const data = await api.getPainelExibicao(garagemId || undefined);
      setLiberados(data.liberados);
      setTeste(data.teste);
      setManutencao(data.manutencao);
    } catch (err) {
      console.error(err);
    }
  }, [garagemId]);

  useEffect(() => {
    void carregar();
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') void carregar();
    });
    const poll = setInterval(() => void carregar(), 30_000);
    return () => {
      ws.close();
      clearInterval(poll);
    };
  }, [carregar]);

  const total = liberadosNaTela.length + teste.length + manutencao.length;

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950 font-sans antialiased">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-700 bg-slate-950 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0">
            <div className="text-2xl font-bold leading-none text-white tabular-nums">{total}</div>
            <div className="text-[8px] uppercase tracking-wide text-slate-400">Total carros</div>
          </div>
          {garagemAtual && (
            <div className="min-w-0 border-l border-slate-600 pl-3">
              <div className="truncate text-xs font-bold leading-tight text-amber-300">
                {garagemAtual.nome}
              </div>
              <div className="truncate text-[8px] uppercase text-slate-400">{garagemAtual.estado}</div>
            </div>
          )}
          {garagens.length > 1 && (
            <select
              value={garagemId}
              onChange={(e) => setGaragemId(e.target.value)}
              className="ml-1 max-w-[8rem] truncate rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-[10px] text-white"
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
        <div className="px-2 text-center">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">
            QUADRO DO
          </h1>
          <p className="text-[10px] text-slate-400">Liberados · Teste · Em serviço</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Link
            to="/valista"
            className="rounded border border-amber-500/50 bg-amber-800 px-2 py-1 text-[10px] font-semibold uppercase text-white hover:bg-amber-700"
          >
            Valista
          </Link>
          <Link
            to="/quadro"
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase text-slate-100 hover:bg-slate-700"
          >
            Quadro
          </Link>
          <Relogio />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3">
        {FAIXAS.map((faixa) => {
          const itens = listas[faixa.id];
          return (
            <section
              key={faixa.id}
              className={`flex min-h-0 min-w-0 flex-col border-r border-black/40 last:border-r-0 ${faixa.faixaClass}`}
            >
              <div
                className={`flex shrink-0 items-center justify-between px-3 py-2 sm:px-4 ${faixa.headerClass}`}
              >
                <h2 className="text-lg font-black tracking-wide sm:text-2xl">{faixa.titulo}</h2>
                <span className="text-lg font-black tabular-nums sm:text-2xl">{itens.length}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
                {itens.length === 0 ? (
                  <p className="text-base font-semibold text-white/40">Nenhum veículo</p>
                ) : (
                  <ul className={`flex flex-wrap content-start ${faixa.compacto ? 'gap-1.5' : 'gap-3'}`}>
                    {itens.map((item) => {
                      const clicavel = faixa.id !== 'liberados';
                      const classe = `flex flex-col items-center shadow ${faixa.chipClass} ${
                        faixa.compacto
                          ? 'min-w-[3.25rem] rounded-md border px-2 py-1'
                          : 'min-w-[5.5rem] rounded-xl border-2 px-4 py-3 shadow-lg'
                      }`;
                      const numero = (
                        <span
                          className={`font-mono font-black leading-none tabular-nums ${
                            faixa.compacto ? 'text-lg sm:text-xl' : 'text-3xl sm:text-4xl'
                          }`}
                        >
                          {item.numero}
                        </span>
                      );
                      return (
                        <li key={item.veiculoId}>
                          {clicavel ? (
                            <button
                              type="button"
                              onClick={() => setSelecionadoId(item.veiculoId)}
                              className={`${classe} cursor-pointer transition hover:brightness-110`}
                            >
                              {numero}
                            </button>
                          ) : (
                            <div className={classe}>{numero}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selecionado && (
        <div className="fixed inset-0 z-40 bg-black/45" onClick={() => setSelecionadoId(null)}>
          <div
            role="dialog"
            aria-label={`Informações do carro ${selecionado.item.numero}`}
            className="absolute left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-600 bg-slate-900 p-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-3xl font-black leading-none">{selecionado.item.numero}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {selecionado.titulo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelecionadoId(null)}
                className="rounded border border-slate-600 px-2 py-1 text-xs font-semibold uppercase text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
            <ul className="mt-4 max-h-[50vh] space-y-3 overflow-auto">
              {(selecionado.item.servicos?.length
                ? selecionado.item.servicos
                : [
                    {
                      descricao: selecionado.item.descricao,
                      setor: '',
                      status: '',
                      desde: '',
                      profissional: null,
                    },
                  ]
              ).map((servico, indice) => (
                <li key={`${servico.descricao ?? 'servico'}-${indice}`} className="rounded-lg bg-slate-800 px-3 py-2">
                  <p className="text-sm font-bold uppercase">
                    {servico.descricao?.trim() || 'Sem descrição'}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-300">
                    {servico.setor ? (
                      <>
                        <dt className="text-slate-500">Setor</dt>
                        <dd>{labelSetor(servico.setor)}</dd>
                      </>
                    ) : null}
                    {servico.profissional ? (
                      <>
                        <dt className="text-slate-500">Profissional</dt>
                        <dd>{servico.profissional}</dd>
                      </>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
