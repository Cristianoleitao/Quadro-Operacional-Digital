import { useCallback, useEffect, useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import { numeroOsExibicao, textoInsumoExibicao, veiculoNumero } from '../lib/servico';
import type { Servico } from '../types';
import { BadgeSetor } from './BadgeSetor';
import { STATUS_LABELS } from '../types';

function formatHora(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR');
}

function formatTempo(min?: number | null) {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function DetalheServicoHistorico({ servico }: { servico: Servico }) {
  const transcricao = servico.correcao?.trim() ?? '';
  const pecas = (servico.insumos ?? []).filter((i) => i.aguardarPeca);
  const insumos = (servico.insumos ?? []).filter((i) => !i.aguardarPeca);

  return (
    <div className="border border-green-800/60 rounded-lg p-3 bg-green-950/20 text-sm text-slate-300">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
        <span className="font-mono font-bold text-white text-base">{veiculoNumero(servico)}</span>
        <span className="text-slate-500 text-xs tabular-nums">OS {numeroOsExibicao(servico)}</span>
        <BadgeSetor setor={servico.setor} />
        <span className="text-white font-medium">— {servico.descricao}</span>
        <span className="text-xs font-semibold text-green-300 uppercase">
          {STATUS_LABELS[servico.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <strong className="text-slate-400">Início:</strong> {formatHora(servico.horaInicio)}
        </div>
        <div>
          <strong className="text-slate-400">Término:</strong> {formatHora(servico.horaTermino)}
        </div>
        <div>
          <strong className="text-slate-400">Tempo:</strong> {formatTempo(servico.tempoTotalMin)}
        </div>
        {servico.status === 'SERVICO_EXTERNO' && (
          <div>
            <strong className="text-slate-400">Local:</strong> {servico.localExterno?.trim() || '—'}
          </div>
        )}
        <div className="sm:col-span-2">
          <strong className="text-slate-400">O que foi feito:</strong>
          <p className="mt-1 text-white whitespace-pre-wrap break-words">
            {transcricao || '—'}
          </p>
          {servico.correcaoAudio && !transcricao && (
            <>
              <p className="mt-2 text-yellow-400 text-xs">Transcrição indisponível — ouça a gravação:</p>
              <audio
                controls
                src={mediaUrl(servico.correcaoAudio)}
                className="mt-1 w-full max-w-md h-8"
              />
            </>
          )}
        </div>
        {pecas.length > 0 && (
          <div className="sm:col-span-2">
            <strong className="text-slate-400">Aguardando peça:</strong>
            <ul className="mt-1 space-y-1">
              {pecas.map((i) => (
                <li key={i.id} className="bg-slate-900/50 rounded px-2 py-1 text-slate-200">
                  {i.descricao}
                  {i.atendido ? ' ✓' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {insumos.length > 0 && (
          <div className="sm:col-span-2">
            <strong className="text-slate-400">Insumos:</strong>
            <ul className="mt-1 space-y-1">
              {insumos.map((i) => (
                <li
                  key={i.id}
                  className={`bg-slate-900/50 rounded px-2 py-1 ${i.atendido ? 'text-green-400 line-through' : 'text-slate-200'}`}
                >
                  {textoInsumoExibicao(i.descricao, i.quantidade ?? 1, i.posicao)}
                  {i.atendido ? ' ✓' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(servico.fotoAntes || servico.fotoDepois) && (
          <div className="sm:col-span-2 flex flex-wrap gap-3">
            {servico.fotoAntes && (
              <img src={mediaUrl(servico.fotoAntes)} alt="Antes" className="h-24 rounded" />
            )}
            {servico.fotoDepois && (
              <img src={mediaUrl(servico.fotoDepois)} alt="Depois" className="h-24 rounded" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface HistoricoProfissionalPanelProps {
  /** Incrementa quando a lista de serviços ativos mudar (ex.: após finalizar). */
  versaoAtualizacao?: number;
}

export function HistoricoProfissionalPanel({ versaoAtualizacao = 0 }: HistoricoProfissionalPanelProps) {
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarHistorico = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await api.getMeuHistoricoProfissional(30);
      setHistorico(lista);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!aberto) return;
    void carregarHistorico();
  }, [aberto, versaoAtualizacao, carregarHistorico]);

  return (
    <section className="mt-4 border-t border-slate-700 pt-3">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-600 hover:border-slate-500 text-left transition"
      >
        <span className="text-sm font-semibold text-white">
          {aberto ? 'Ocultar meu histórico' : 'Ver meu histórico'}
        </span>
        <span className="text-xs text-slate-400 shrink-0">
          {aberto ? '▲' : '▼'}
          {historico.length > 0 && !carregando ? ` · ${historico.length}` : ''}
        </span>
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500 px-1">
            Serviços finalizados por você nos últimos 30 dias
          </p>

          {carregando && (
            <p className="text-center text-slate-500 text-sm py-6">Carregando histórico…</p>
          )}

          {erro && !carregando && (
            <p className="text-center text-red-400 text-sm py-4">{erro}</p>
          )}

          {!carregando && !erro && historico.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">
              Nenhum serviço finalizado no período
            </p>
          )}

          {!carregando && historico.length > 0 && (
            <div className="space-y-3 max-h-[45dvh] overflow-y-auto overscroll-y-contain pr-1">
              {historico.map((s) => (
                <DetalheServicoHistorico key={s.id} servico={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
