import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  destinoPosCadastro,
  labelSetorCadastro,
  setorCadastroExigeGaragem,
  SETORES_CADASTRO,
  SETOR_CORES,
  TIPO_CADASTRO_LABELS,
  TIPOS_CADASTRO,
  type Garagem,
  type SetorCadastro,
  type TipoCadastro,
} from '../types';
import { getApiOrigin } from '../lib/config';
import { useAuth } from '../context/AuthContext';

export default function CadastroProfissionalPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipo, setTipo] = useState<TipoCadastro>('PROFISSIONAL');
  const [setor, setSetor] = useState<SetorCadastro>('MEC');
  const [garagemId, setGaragemId] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const exigeSetor = tipo === 'PROFISSIONAL';
  const exigeGaragem = tipo === 'PROFISSIONAL' && setorCadastroExigeGaragem(setor);

  useEffect(() => {
    const emProducao = !['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (emProducao && !getApiOrigin()) {
      setErro(
        'API não configurada. Na Vercel, defina VITE_API_URL (URL do Render) e faça redeploy.',
      );
      return;
    }

    api.getGaragens()
      .then((lista) => {
        setGaragens(lista);
        if (lista.length > 0) setGaragemId(lista[0].id);
        else if (exigeGaragem) {
          setErro('Nenhuma garagem no banco. Rode o seed no Render ou cadastre via admin.');
        }
      })
      .catch(() => {
        const origemApi = getApiOrigin() || window.location.origin;
        setErro(
          `Não foi possível carregar as garagens. Confira ${origemApi}/api/health no navegador (API pode demorar ~30s na 1ª vez). Se o health ok, no Render defina FRONTEND_URL=${window.location.origin} e redeploy a API.`,
        );
      });
  }, [exigeGaragem]);

  const classeSelectSetor = (s: SetorCadastro) => {
    if (s === 'APONTADOR' || s === 'ESTOQUE') return SETOR_CORES.OUTRO.select;
    return SETOR_CORES[s].select;
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!nome.trim() || !matricula.trim() || !senha.trim()) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }
    if (exigeGaragem && !garagemId) {
      setErro('Selecione a garagem');
      return;
    }
    if (senha.length < 4) {
      setErro('A senha deve ter no mínimo 4 caracteres');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      await api.cadastrarUsuario({
        nome: nome.trim(),
        matricula: matricula.trim(),
        senha,
        tipo,
        ...(exigeSetor ? { setor } : {}),
        ...(exigeGaragem ? { garagemId } : {}),
      });
      await login(matricula.trim(), senha);
      navigate(destinoPosCadastro(tipo, exigeSetor ? setor : undefined), { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="bg-slate-950 border-b border-slate-700 px-6 py-4">
        <h1 className="text-2xl font-bold">Cadastro de usuário</h1>
        <p className="text-slate-400 text-sm">Crie sua conta para acessar o sistema</p>
      </header>

      <main className="flex-1 flex items-start justify-center p-6">
        <form
          onSubmit={salvar}
          className="w-full max-w-md space-y-4 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl"
        >
          <div>
            <label className="block text-sm text-slate-400 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCadastro)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 font-semibold"
              required
            >
              {TIPOS_CADASTRO.map((t) => (
                <option key={t} value={t} className="text-black">
                  {TIPO_CADASTRO_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Nome completo</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 uppercase"
              placeholder="SEU NOME"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Matrícula</label>
            <input
              value={matricula}
              onChange={(e) => setMatricula(e.target.value.toUpperCase())}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 uppercase font-mono"
              placeholder={tipo === 'GERENCIA' ? 'GER002' : setor === 'APONTADOR' ? 'ADM002' : setor === 'ESTOQUE' ? 'EST002' : 'MEC002'}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5"
                minLength={4}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Confirmar senha</label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5"
                minLength={4}
                required
              />
            </div>
          </div>

          {exigeSetor && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Setor</label>
              <select
                value={setor}
                onChange={(e) => setSetor(e.target.value as SetorCadastro)}
                className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 font-bold uppercase ${classeSelectSetor(setor)}`}
                required
              >
                {SETORES_CADASTRO.map((s) => (
                  <option key={s} value={s} className="text-black">
                    {labelSetorCadastro(s)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {exigeGaragem && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Garagem / local</label>
              <select
                value={garagemId}
                onChange={(e) => setGaragemId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5"
                required
              >
                {garagens.length === 0 && (
                  <option value="">Nenhuma garagem disponível — contate o administrador</option>
                )}
                {garagens.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.rotulo ?? `${g.nome} - ${g.estado}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {erro && (
            <div className="p-3 bg-red-900/50 border border-red-600 rounded text-red-200 text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (exigeGaragem && garagens.length === 0)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Já tem conta?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Entrar
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
