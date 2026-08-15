import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { HeaderPublico } from '../components/HeaderPublico';
import { BotaoVoltarLogin } from '../components/BotaoVoltarLogin';
import { getApiOrigin } from '../lib/config';
import type { Garagem } from '../types';

export default function MotoristaPage() {
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [veiculoNumero, setVeiculoNumero] = useState('');
  const [garagemId, setGaragemId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

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
    setMensagem('');

    if (!veiculoNumero.trim()) {
      setErro('Informe o número do veículo');
      return;
    }
    if (!garagemId) {
      setErro('Selecione a garagem');
      return;
    }
    if (!descricao.trim()) {
      setErro('Informe a descrição do serviço');
      return;
    }

    const base = descricao.trim().toUpperCase();
    const obs = observacao.trim().toUpperCase();
    const descricaoFinal = obs ? `${base} — OBS: ${obs}` : base;
    const carro = veiculoNumero.trim().toUpperCase();

    setLoading(true);
    try {
      await api.cadastroRapido({
        veiculoNumero: carro,
        descricao: descricaoFinal,
        garagemId,
        // setor omitido → backend grava PENDENTE; ADM define depois
      });
      setVeiculoNumero('');
      setDescricao('');
      setObservacao('');
      setMensagem(`Veículo ${carro} registrado. O setor será definido na central.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar serviço');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900">
      <HeaderPublico />

      <main className="flex flex-1 justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white sm:text-2xl">Motorista</h2>
            <p className="mt-1 text-sm text-slate-400">
              Informe o veículo e o problema. O setor é definido depois na central.
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
            {mensagem && (
              <div className="rounded border border-emerald-600 bg-emerald-900/40 p-3 text-sm text-emerald-200">
                {mensagem}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Veículo</span>
              <input
                type="text"
                inputMode="numeric"
                value={veiculoNumero}
                onChange={(e) => setVeiculoNumero(e.target.value.toUpperCase())}
                placeholder="Nº do carro"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base font-mono font-bold uppercase text-white focus:border-sky-500 focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Garagem</span>
              <select
                value={garagemId}
                onChange={(e) => setGaragemId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base text-white focus:border-sky-500 focus:outline-none"
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

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Serviço / problema</span>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.toUpperCase())}
                placeholder="Ex.: BARULHO NO MOTOR"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base uppercase text-white focus:border-sky-500 focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Observação <span className="font-normal text-slate-500">(opcional)</span>
              </span>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value.toUpperCase())}
                placeholder="Detalhes adicionais..."
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base uppercase text-white focus:border-sky-500 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 py-3.5 text-base font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar serviço'}
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
