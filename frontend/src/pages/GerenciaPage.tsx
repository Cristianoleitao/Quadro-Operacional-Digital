import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, connectWebSocket, type AuditoriaResponse, type DashboardGerencia, type ParamsHistoricoGerencia } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Garagem, HistoricoInsumo, Servico } from '../types';
import { QuadroTabelaLeitura } from '../components/QuadroTabelaLeitura';
import { GerenciaGraficos } from '../components/GerenciaGraficos';
import { SeletorLayoutGraficos } from '../components/gerencia/SeletorLayoutGraficos';
import { GerenciaHistoricoDetalhado } from '../components/gerencia/GerenciaHistoricoDetalhado';
import type { MetaExportacaoGerencia } from '../lib/gerenciaExport';
import { lerLayoutSalvo, salvarLayout, type LayoutGraficosGerencia } from '../lib/gerenciaGraficos';
import { rotuloPeriodoHistorico } from '../lib/historicoGerencia';

const PERIODOS = [7, 15, 30, 60, 90] as const;

export default function GerenciaPage() {
  const { usuario, logout } = useAuth();
  const [servicosQuadro, setServicosQuadro] = useState<Servico[]>([]);
  const [dashboard, setDashboard] = useState<DashboardGerencia | null>(null);
  const [historico, setHistorico] = useState<Servico[]>([]);
  const [historicoInsumos, setHistoricoInsumos] = useState<HistoricoInsumo[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaResponse['registros']>([]);
  const [garagens, setGaragens] = useState<Garagem[]>([]);
  const [garagemId, setGaragemId] = useState('');
  const [dias, setDias] = useState<number>(30);
  const [histDataDia, setHistDataDia] = useState('');
  const [histModoIntervalo, setHistModoIntervalo] = useState(false);
  const [histDataAte, setHistDataAte] = useState('');
  const [layoutGraficos, setLayoutGraficos] = useState<LayoutGraficosGerencia>(() => lerLayoutSalvo());
  const [carregando, setCarregando] = useState(true);

  const paramsHistorico = useMemo((): ParamsHistoricoGerencia => {
    const gid = garagemId || undefined;
    if (histDataDia) {
      if (histModoIntervalo && histDataAte) {
        if (histDataDia > histDataAte) return { garagemId: gid, dias };
        return {
          garagemId: gid,
          dataInicio: histDataDia,
          dataFim: histDataAte,
        };
      }
      return { garagemId: gid, dataDia: histDataDia };
    }
    return { garagemId: gid, dias };
  }, [garagemId, dias, histDataDia, histModoIntervalo, histDataAte]);

  const periodoHistoricoTexto = useMemo(
    () => rotuloPeriodoHistorico(dias, histDataDia, histModoIntervalo, histDataAte),
    [dias, histDataDia, histModoIntervalo, histDataAte],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const gid = garagemId || undefined;
      const [quadro, dash, hist, histIns, aud] = await Promise.all([
        api.getQuadro(gid),
        api.getDashboardGerencia({ dias, garagemId: gid }),
        api.getHistorico(paramsHistorico),
        api.getHistoricoInsumos(paramsHistorico),
        api.getAuditoriaGerencia({ dias, limit: 500 }),
      ]);
      setServicosQuadro(quadro);
      setDashboard(dash);
      setHistorico(hist);
      setHistoricoInsumos(histIns);
      setAuditoria(aud.registros);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [dias, garagemId, paramsHistorico]);

  useEffect(() => {
    api.getGaragens()
      .then((lista) => {
        setGaragens(lista);
        if (lista.length > 0) {
          setGaragemId((atual) => atual || lista[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    void carregar();
    const ws = connectWebSocket((type) => {
      if (type === 'quadro:update') void carregar();
    });
    return () => ws.close();
  }, [carregar]);

  const garagemAtual = garagens.find((g) => g.id === garagemId);

  const metaExportacao: MetaExportacaoGerencia = {
    titulo: 'Painel Gerencial — Quadro Operacional Digital',
    garagem: garagemAtual ? `${garagemAtual.nome} - ${garagemAtual.estado}` : undefined,
    periodoDias: dias,
    periodoTexto: periodoHistoricoTexto,
    geradoEm: new Date().toLocaleString('pt-BR'),
    usuario: usuario?.nome,
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-950 border-b border-slate-700 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Gerencial</h1>
          <p className="text-slate-400 text-sm">{usuario?.nome} — Gerência</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/quadro" className="text-blue-400 hover:text-blue-300">
            Quadro TV
          </Link>
          <button type="button" onClick={logout} className="text-red-400 hover:text-red-300">
            Sair
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="flex flex-wrap items-end gap-4">
          {garagens.length > 1 && (
            <label className="text-sm text-slate-300">
              <span className="block text-xs text-slate-500 mb-1">Garagem</span>
              <select
                value={garagemId}
                onChange={(e) => setGaragemId(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm min-w-[12rem]"
              >
                {garagens.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.rotulo ?? `${g.nome} - ${g.estado}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {garagemAtual && garagens.length <= 1 && (
            <p className="text-sm text-amber-300 font-semibold">
              {garagemAtual.nome} — {garagemAtual.estado}
            </p>
          )}
          <label className="text-sm text-slate-300">
            <span className="block text-xs text-slate-500 mb-1">Período dos gráficos</span>
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm"
            >
              {PERIODOS.map((p) => (
                <option key={p} value={p}>
                  Últimos {p} dias
                </option>
              ))}
            </select>
          </label>
          {carregando && <span className="text-slate-500 text-sm pb-2">Atualizando…</span>}
        </div>

        <section>
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-lg font-bold text-white">Quadro operacional (tempo real)</h2>
            <span className="text-xs text-slate-500">Role para ver todas as seções</span>
          </div>
          <QuadroTabelaLeitura servicos={servicosQuadro} />
        </section>

        <section>
          <div className="flex flex-col gap-4 mb-4">
            <h2 className="text-lg font-bold text-white">Indicadores e gráficos</h2>
            <SeletorLayoutGraficos
              layout={layoutGraficos}
              onChange={(novo) => {
                salvarLayout(novo);
                setLayoutGraficos(novo);
              }}
            />
          </div>
          {dashboard ? <GerenciaGraficos dados={dashboard} layout={layoutGraficos} /> : null}
        </section>

        <GerenciaHistoricoDetalhado
          historico={historico}
          historicoInsumos={historicoInsumos}
          dashboard={dashboard}
          auditoria={auditoria}
          meta={metaExportacao}
          carregando={carregando}
          dataDia={histDataDia}
          dataAte={histDataAte}
          modoIntervalo={histModoIntervalo}
          periodoDias={dias}
          periodoTexto={periodoHistoricoTexto}
          onDataDiaChange={setHistDataDia}
          onDataAteChange={setHistDataAte}
          onModoIntervaloChange={setHistModoIntervalo}
          onLimparPeriodo={() => {
            setHistDataDia('');
            setHistDataAte('');
            setHistModoIntervalo(false);
          }}
        />
      </div>
    </div>
  );
}
