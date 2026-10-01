import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { HeaderPublico } from '../components/HeaderPublico';
import { BotaoVoltarLogin } from '../components/BotaoVoltarLogin';
import { getApiOrigin } from '../lib/config';
import type { Garagem } from '../types';

export default function ValistaPage() {
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [veiculoNumero, setVeiculoNumero] = useState('');
  const [garagemId, setGaragemId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [liberando, setLiberando] = useState(false);

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

  const dadosBase = () => {
    if (!veiculoNumero.trim()) {
      setErro('Informe o número do veículo');
      return null;
    }
    if (!garagemId) {
      setErro('Selecione a garagem');
      return null;
    }
    return {
      veiculoNumero: veiculoNumero.trim().toUpperCase(),
      garagemId,
      descricao: descricao.trim().toUpperCase(),
    };
  };

  const registrarServico = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setErro('');
    setMensagem('');

    const dados = dadosBase();
    if (!dados) return;
    if (!dados.descricao) {
      setErro('Informe o serviço / problema');
      return;
    }

    setRegistrando(true);
    try {
      await api.cadastroRapido({
        veiculoNumero: dados.veiculoNumero,
        descricao: dados.descricao,
        garagemId: dados.garagemId,
        setor: 'VALA',
      });
      setVeiculoNumero('');
      setDescricao('');
      setMensagem(`Veículo ${dados.veiculoNumero} enviado ao quadro da TV.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar serviço');
    } finally {
      setRegistrando(false);
    }
  };

  const liberar = async () => {
    setErro('');
    setMensagem('');

    const dados = dadosBase();
    if (!dados) return;

    setLiberando(true);
    try {
      const res = await api.liberarVeiculoValista({
        veiculoNumero: dados.veiculoNumero,
        garagemId: dados.garagemId,
        ...(dados.descricao ? { descricao: dados.descricao } : {}),
      });
      setVeiculoNumero('');
      setDescricao('');
      setMensagem(`Veículo ${res.veiculoNumero} liberado e enviado ao QUADRO DO.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao liberar veículo');
    } finally {
      setLiberando(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900">
      <HeaderPublico />

      <main className="flex flex-1 justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white sm:text-2xl">Valista</h2>
            <p className="mt-1 text-sm text-slate-400">
              Descreva o serviço e pressione Enter para o quadro da TV. Informe o número e toque em Liberado para o QUADRO DO.
            </p>
          </div>

          <form
            onSubmit={registrarServico}
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
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base font-mono font-bold uppercase text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Garagem</span>
              <select
                value={garagemId}
                onChange={(e) => setGaragemId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base text-white focus:border-emerald-500 focus:outline-none"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void registrarServico(e);
                  }
                }}
                placeholder="Ex.: BARULHO NO MOTOR"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base uppercase text-white focus:border-emerald-500 focus:outline-none"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {registrando ? 'Enviando ao quadro da TV...' : 'Enter envia o carro ao quadro da TV.'}
              </span>
            </label>

            <button
              type="button"
              disabled={registrando || liberando}
              onClick={() => void liberar()}
              className="w-full rounded-lg bg-emerald-600 py-3.5 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {liberando ? 'Liberando...' : 'Liberado'}
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
