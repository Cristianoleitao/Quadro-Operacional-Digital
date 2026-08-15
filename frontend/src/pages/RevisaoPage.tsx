import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { HeaderPublico } from '../components/HeaderPublico';
import { BotaoVoltarLogin } from '../components/BotaoVoltarLogin';
import { getApiOrigin } from '../lib/config';
import {
  chaveItemChecklist,
  itensModeloChecklist,
  setoresDoTipoChecklist,
} from '../lib/checklistRevisao';
import { SETOR_QUADRO } from '../lib/quadro';
import type { Garagem, Setor, TipoChecklist } from '../types';

const TIPOS: Array<{ value: TipoChecklist; label: string }> = [
  { value: 'REVISAO_PREVENTIVA', label: 'REVISÃO PREVENTIVA' },
  { value: 'CHECKLIST_15000', label: 'CHECKLIST 15.000' },
];

export default function RevisaoPage() {
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [veiculoNumero, setVeiculoNumero] = useState('');
  const [tipo, setTipo] = useState<TipoChecklist>('REVISAO_PREVENTIVA');
  const [garagemId, setGaragemId] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const modelo = useMemo(() => itensModeloChecklist(tipo), [tipo]);
  const setores = useMemo(() => setoresDoTipoChecklist(tipo), [tipo]);

  useEffect(() => {
    const emProducao = !['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (emProducao && !getApiOrigin()) {
      setErro(
        'API não configurada. Na Vercel, defina VITE_API_URL (URL do Render) e faça redeploy.',
      );
      return;
    }

    api
      .getGaragens()
      .then((lista) => {
        setGaragens(lista);
        if (lista.length > 0) setGaragemId(lista[0].id);
        else setErro('Nenhuma garagem cadastrada. Contate o administrador.');
      })
      .catch(() => {
        const origemApi = getApiOrigin() || window.location.origin;
        setErro(
          `Não foi possível carregar as garagens. Confira ${origemApi}/api/health no navegador.`,
        );
      });
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!veiculoNumero.trim()) {
      setErro('Informe o número do veículo');
      return;
    }
    if (!garagemId) {
      setErro('Selecione a garagem');
      return;
    }

    const itens = modelo.filter((item) =>
      selecionados.has(chaveItemChecklist(item.setor, item.ordem)),
    );
    if (itens.length === 0) {
      setErro('Selecione ao menos um item para algum setor');
      return;
    }

    const carro = veiculoNumero.trim().toUpperCase();
    const label = TIPOS.find((t) => t.value === tipo)?.label ?? tipo;

    setLoading(true);
    try {
      const resp = await api.cadastroRevisao({
        veiculoNumero: carro,
        tipo,
        garagemId,
        itens,
      });
      const aviso = resp.reutilizado
        ? `${label} já estava aberta para o veículo ${carro}.`
        : `${label} registrada no veículo ${carro} com ${itens.length} item(ns).`;
      navigate('/login', { replace: true, state: { aviso } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar revisão');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (setor: Setor, ordem: number) => {
    const chave = chaveItemChecklist(setor, ordem);
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  };

  const toggleSetor = (setor: Setor) => {
    const doSetor = modelo.filter((item) => item.setor === setor);
    const todosMarcados = doSetor.every((item) =>
      selecionados.has(chaveItemChecklist(item.setor, item.ordem)),
    );
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      for (const item of doSetor) {
        const chave = chaveItemChecklist(item.setor, item.ordem);
        if (todosMarcados) proximo.delete(chave);
        else proximo.add(chave);
      }
      return proximo;
    });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900">
      <HeaderPublico />

      <main className="flex flex-1 justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-3xl">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white sm:text-2xl">Revisão</h2>
            <p className="mt-1 text-sm text-slate-400">
              Informe o veículo, o tipo e marque os itens de cada setor. Só os selecionados
              aparecem na tela do profissional.
            </p>
          </div>

          <form
            onSubmit={enviar}
            className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6"
          >
            {erro && (
              <div className="rounded border border-red-600 bg-red-900/50 p-3 text-sm text-red-200">
                {erro}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Número do carro</span>
              <input
                type="text"
                inputMode="numeric"
                value={veiculoNumero}
                onChange={(e) => setVeiculoNumero(e.target.value.toUpperCase())}
                placeholder="Nº do veículo"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base font-mono font-bold uppercase text-white focus:border-violet-500 focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Tipo</span>
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoChecklist);
                  setSelecionados(new Set());
                }}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base font-semibold uppercase text-white focus:border-violet-500 focus:outline-none"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Garagem</span>
              <select
                value={garagemId}
                onChange={(e) => setGaragemId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base text-white focus:border-violet-500 focus:outline-none"
                required
              >
                <option value="">Selecione</option>
                {garagens.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.rotulo ?? `${g.nome} - ${g.estado}`}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">
                Itens por setor
                {tipo === 'CHECKLIST_15000' ? (
                  <span className="ml-2 font-normal text-slate-500">(sem pintura)</span>
                ) : null}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {setores.map((setor) => {
                  const itensSetor = modelo.filter((item) => item.setor === setor);
                  const marcados = itensSetor.filter((item) =>
                    selecionados.has(chaveItemChecklist(item.setor, item.ordem)),
                  ).length;
                  return (
                    <fieldset
                      key={setor}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"
                    >
                      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-violet-300">
                        {SETOR_QUADRO[setor]}
                      </legend>
                      <button
                        type="button"
                        onClick={() => toggleSetor(setor)}
                        className="mb-2 text-[11px] font-semibold uppercase text-slate-400 hover:text-violet-300"
                      >
                        {marcados === itensSetor.length ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                      <ul className="space-y-1.5">
                        {itensSetor.map((item) => {
                          const chave = chaveItemChecklist(item.setor, item.ordem);
                          const marcado = selecionados.has(chave);
                          return (
                            <li key={chave}>
                              <label className="flex cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => toggleItem(item.setor, item.ordem)}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
                                />
                                <span className="text-sm uppercase leading-snug text-slate-200">
                                  {item.descricao}
                                  {item.quantidade > 1 ? ` × ${item.quantidade}` : ''}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </fieldset>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 py-3.5 text-base font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar revisão'}
            </button>
          </form>

          <div className="mt-5 flex justify-center">
            <BotaoVoltarLogin className="w-full max-w-xs" />
          </div>
        </div>
      </main>
    </div>
  );
}
