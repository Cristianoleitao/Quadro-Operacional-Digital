/**
 * Coluna Liberados do QUADRO DO.
 * O carro escalado permanece no minuto da saída e sai da tela no minuto seguinte.
 * Ex.: saída 14:10 continua visível às 14:10 e some às 14:11.
 */
export function liberadoPassouHorarioSaida(
  horaSaida: string | Date | null | undefined,
  agora = new Date(),
): boolean {
  if (!horaSaida) return false;
  const saida = horaSaida instanceof Date ? horaSaida : new Date(horaSaida);
  if (Number.isNaN(saida.getTime())) return false;
  const limite = new Date(saida.getTime());
  limite.setSeconds(0, 0);
  limite.setMinutes(limite.getMinutes() + 1);
  return agora.getTime() >= limite.getTime();
}