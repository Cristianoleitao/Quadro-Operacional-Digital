import { Fragment } from 'react';
import type { Servico, Setor } from '../types';
import { SETOR_CORES, SETOR_PREFIX } from '../types';
import {
  badgesPreventivaQuadro,
  textosPecaPendenteDoProfissional,
  textosPecaPendenteOrfas,
} from '../lib/servico';

const BASE_CHIP_SETOR =
  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0';

export function classeChipSetor(setor: Setor, className = ''): string {
  return `${BASE_CHIP_SETOR} ${SETOR_CORES[setor].chip} ${className}`.trim();
}

export function classeBadgeProfissionalSetor(setor: Setor): string {
  return classeChipSetor(setor, 'ml-0.5');
}

/** Profissional no veículo — preto quando pausado (almoço, etc.). */
export function classeNomeProfissionalServico(setor: Setor, pausadoEm?: string | null): string {
  if (pausadoEm) {
    return `${BASE_CHIP_SETOR} bg-black text-white ml-0.5`;
  }
  return classeBadgeProfissionalSetor(setor);
}

/** Nome de quem solicitou peça — vermelho, para não confundir com profissional em serviço. */
export function classeNomeSolicitantePeca(textoClaro = false, temaEscuro = false): string {
  const cor = temaEscuro ? 'text-red-400' : textoClaro ? 'text-red-300' : 'text-red-600';
  return `inline-block ml-0.5 font-bold uppercase text-[11px] leading-snug break-words align-middle whitespace-nowrap ${cor}`;
}

export function BadgeSetor({
  setor,
  className = '',
}: {
  setor: Setor;
  className?: string;
}) {
  return (
    <span className={`font-bold ${SETOR_CORES[setor].badge} ${className}`}>
      {SETOR_PREFIX[setor]}
    </span>
  );
}

export function ChipSetor({
  setor,
  className = '',
}: {
  setor: Setor;
  className?: string;
}) {
  return (
    <span className={classeChipSetor(setor, className)}>
      {SETOR_PREFIX[setor]}
    </span>
  );
}

/** Badges da revisão preventiva no quadro: setor → nome → some ao concluir. */
export function BadgesPreventivaQuadro({
  servico,
  separadorClassName = 'text-neutral-600',
  pecaClassName = 'text-[11px]',
  ocultarPecas = false,
}: {
  servico: Servico;
  separadorClassName?: string;
  pecaClassName?: string;
  ocultarPecas?: boolean;
}) {
  const badges = badgesPreventivaQuadro(servico);
  const pecaBase = `inline-flex items-center px-1.5 py-0.5 rounded ${pecaClassName} font-black uppercase bg-yellow-300 text-black`;

  return (
    <>
      {badges.map((b, i) => (
        <Fragment key={b.key}>
          {i > 0 && (
            <span className={`mx-0.5 font-bold self-center shrink-0 ${separadorClassName}`}>/</span>
          )}
          {b.tipo === 'setor' ? (
            <ChipSetor setor={b.setor} className="mr-0" />
          ) : (
            <span className="inline-flex items-center gap-x-1 flex-wrap">
              {!ocultarPecas && b.obs?.trim() ? (
                <span
                  className="break-words font-normal uppercase text-black"
                  title={`OBS ${SETOR_PREFIX[b.setor]}`}
                >
                  {b.obs.trim()}
                </span>
              ) : null}
              {!ocultarPecas &&
                textosPecaPendenteDoProfissional(servico, b.profissionalId).map((peca) => (
                  <span key={peca} className={pecaBase} title="Peça solicitada ao estoque">
                    {peca}
                  </span>
                ))}
              <span
                className={classeNomeProfissionalServico(b.setor, b.pausadoEm)}
                title={b.nome}
              >
                {b.nome}
              </span>
            </span>
          )}
        </Fragment>
      ))}
      {!ocultarPecas &&
        textosPecaPendenteOrfas(servico).map((peca, i) => (
          <Fragment key={`orf-${peca}`}>
            {(badges.length > 0 || i > 0) && (
              <span className={`mx-0.5 font-bold self-center shrink-0 ${separadorClassName}`}>/</span>
            )}
            <span className={pecaBase}>{peca}</span>
          </Fragment>
        ))}
    </>
  );
}
