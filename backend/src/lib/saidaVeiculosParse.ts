/** Utilitários compartilhados para horário de saída (parse e normalização). */

export type SaidaVeiculoExterna =
  | Array<{ veiculo: string; horaSaida: string }>
  | Record<string, string>;

export function normalizarNumeroVeiculo(numero: string): string {
  return numero.trim().toUpperCase();
}

export function parseHoraSaidaTexto(hora: string): Date | null {
  const texto = hora.trim();
  if (!texto) return null;

  const iso = Date.parse(texto);
  if (!Number.isNaN(iso)) {
    return new Date(iso);
  }

  const match = texto.replace(/^(\d{2})H(\d{2})$/i, '$1:$2').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;

  const saida = new Date();
  saida.setHours(h, m, 0, 0);
  return saida;
}

export function mapaExternoParaHorarios(dados: SaidaVeiculoExterna): Map<string, Date> {
  const mapa = new Map<string, Date>();

  if (Array.isArray(dados)) {
    for (const item of dados) {
      const numero = normalizarNumeroVeiculo(item.veiculo);
      const hora = parseHoraSaidaTexto(item.horaSaida);
      if (numero && hora) mapa.set(numero, hora);
    }
    return mapa;
  }

  for (const [veiculo, horaSaida] of Object.entries(dados)) {
    const numero = normalizarNumeroVeiculo(veiculo);
    const hora = parseHoraSaidaTexto(horaSaida);
    if (numero && hora) mapa.set(numero, hora);
  }

  return mapa;
}

const REGEX_HORA = /(\d{1,2})\s*[:hH]\s*(\d{2})/;

/** Extrai a primeira hora (HH:MM ou HHhMM) encontrada no texto. */
export function extrairHoraDoTexto(texto: string): string | null {
  const match = texto.match(REGEX_HORA);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
