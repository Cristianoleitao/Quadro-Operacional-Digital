import { Fragment, useMemo, useState, useEffect } from 'react';
import type { Servico } from '../types';
import {
  ESTILO_QUADRO,
  alertaPrazoVeiculo,
  classeFundoPrazoVeiculo,
  dataVeiculoQuadro,
  horaInputVeiculo,
  idsVeiculosSaidaPrioritaria,
  linhaVeiculoRowClass,
  mapaServicosPorVeiculo,
  organizarQuadroPorSecao,
  osInputVeiculo,
  saidaVeiculoQuadro,
  type LinhaVeiculoQuadro,
  type SecaoQuadro,
} from '../lib/quadro';
import { textoAguardandoPecaQuadro, isPreventivaRev, textoPreventivaRev } from '../lib/servico';
import { ChipSetor, classeNomeProfissionalServico, classeNomeSolicitantePeca, BadgesPreventivaQuadro } from './BadgeSetor';
import { primeiroNome } from './InputProfissionalServico';

const COLUNAS = [
  { key: 'carro', label: 'CARRO' },
  { key: 'data', label: 'DATA' },
  { key: 'hora', label: 'HORA' },
  { key: 'os', label: 'OS' },
  { key: 'descricao', label: 'SERVIÇO' },
  { key: 'saida', label: 'SAÍDA' },
] as const;

const estilo = ESTILO_QUADRO;

function CelulaServicosLeitura({
  servicos,
  textoClaro,
}: {
  servicos: Servico[];
  textoClaro: boolean;
}) {
  return (
    <td className={`border border-neutral-800 align-middle font-medium px-1 py-1 ${estilo.tdServico}`}>
      <div className="flex flex-wrap items-start justify-start content-start gap-x-3 gap-y-1.5 w-full text-left">
        {servicos.map((s, i) => {
          const aguardandoPeca = s.status === 'AGUARDANDO_INSUMO';
          const textoAguardando = aguardandoPeca ? textoAguardandoPecaQuadro(s) : '';
          const preventiva = isPreventivaRev(s);

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
                <div className="inline-flex flex-wrap items-center justify-start gap-x-1 gap-y-0.5 min-w-0 leading-snug text-left">
                  <span className="break-words text-left font-semibold uppercase">
                    {textoPreventivaRev(s)}
                  </span>
                  <BadgesPreventivaQuadro
                    servico={s}
                    separadorClassName={`${estilo.separador} ${
                      textoClaro ? 'text-white/70' : 'text-neutral-600'
                    }`}
                  />
                </div>
              </Fragment>
            );
          }

          const badgeProfissional = classeNomeProfissionalServico(s.setor, s.pausadoEm);
          const temProfissional = Boolean(s.profissional?.nome);
          const badgeSetorOuProfissional = temProfissional ? (
            <span className={`${badgeProfissional} mr-0.5`}>{primeiroNome(s.profissional!.nome)}</span>
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
              <div className="inline-flex flex-wrap items-center justify-start gap-x-1 gap-y-0.5 min-w-0 leading-snug text-left">
                {badgeSetorOuProfissional}
                <span className="break-words text-left">{s.descricao}</span>
                {aguardandoPeca ? (
                  textoAguardando ? (
                    <span className={classeNomeSolicitantePeca(textoClaro)} title="Aguardando peça">
                      {textoAguardando}
                    </span>
                  ) : null
                ) : s.status === 'SERVICO_EXTERNO' && s.localExterno?.trim() ? (
                  <span className={badgeProfissional} title="Local do serviço externo">
                    {s.localExterno.trim().toUpperCase()}
                  </span>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
    </td>
  );
}

function LinhaVeiculoLeitura({
  linha,
  secao,
  indice,
  alertaPrazo,
  saidaPrioritaria,
}: {
  linha: LinhaVeiculoQuadro;
  secao: SecaoQuadro;
  indice: number;
  alertaPrazo: ReturnType<typeof alertaPrazoVeiculo>;
  saidaPrioritaria: boolean;
}) {
  const rowClass = linhaVeiculoRowClass(linha.servicos, secao);
  const critico = linha.servicos.some((s) => s.status === 'PARADO_CRITICO');
  const fundoPrazo = critico ? '' : classeFundoPrazoVeiculo(alertaPrazo);
  const textoClaro =
    critico || (secao.rowTextClass.includes('text-white') && alertaPrazo === 'nenhum');
  const zebra =
    secao.id === 'corretiva' && !critico && indice % 2 === 1 && alertaPrazo === 'nenhum'
      ? 'bg-neutral-100'
      : '';
  const tdBase = 'border border-neutral-800 px-1 py-1';

  return (
    <tr className={`${rowClass} ${fundoPrazo} ${zebra}`}>
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
      <CelulaServicosLeitura servicos={linha.servicos} textoClaro={textoClaro} />
      <td className={`${tdBase} text-center align-middle ${estilo.td}`}>
        {secao.id === 'corretiva' && saidaVeiculoQuadro(linha.veiculoRef) ? (
          <span
            className={`font-mono tabular-nums whitespace-nowrap font-semibold ${
              saidaPrioritaria ? '!text-white inline-block px-1 rounded bg-[#FF0000]' : ''
            }`}
          >
            {saidaVeiculoQuadro(linha.veiculoRef)}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function QuadroTabelaLeitura({ servicos }: { servicos: Servico[] }) {
  const grupos = useMemo(() => organizarQuadroPorSecao(servicos), [servicos]);
  const servicosPorVeiculo = useMemo(() => mapaServicosPorVeiculo(servicos), [servicos]);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const prioridadeSaidaIds = useMemo(() => {
    const corretiva = grupos.find((g) => g.secao.id === 'corretiva');
    if (!corretiva) return new Set<string>();
    return idsVeiculosSaidaPrioritaria(corretiva.linhas, agora);
  }, [grupos, agora]);

  if (grupos.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-500 text-lg font-medium bg-white rounded-lg border border-slate-700">
        Nenhum serviço em andamento no quadro
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[min(52vh,560px)] rounded-lg border border-slate-600 bg-white">
      <table className="w-full min-w-[720px] border-collapse table-fixed">
        <colgroup>
          <col className="w-[64px]" />
          <col className="w-[78px]" />
          <col className="w-[58px]" />
          <col className="w-[62px]" />
          <col />
          <col className="w-[68px]" />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-neutral-300 text-black">
            {COLUNAS.map((col) => (
              <th
                key={col.key}
                className={`border border-neutral-800 font-bold uppercase ${
                  col.key === 'descricao' ? `${estilo.thServico} text-left` : `${estilo.th} text-center`
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ secao, linhas }) => (
            <Fragment key={secao.id}>
              <tr className={secao.headerClass}>
                <td
                  colSpan={COLUNAS.length}
                  className={`border border-neutral-800 text-center font-bold tracking-wide py-1 ${estilo.tituloSecao} ${secao.headerTextClass}`}
                >
                  {secao.titulo}
                </td>
              </tr>
              {linhas.map((linha, i) => (
                <LinhaVeiculoLeitura
                  key={`${secao.id}-${linha.veiculoId}`}
                  linha={linha}
                  secao={secao}
                  indice={i}
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
  );
}
