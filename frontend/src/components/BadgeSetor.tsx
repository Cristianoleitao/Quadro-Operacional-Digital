import type { Setor } from '../types';
import { SETOR_CORES, SETOR_PREFIX } from '../types';

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
