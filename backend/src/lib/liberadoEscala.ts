/**
 * Coluna Liberados do QUADRO DO.
 * O carro escalado permanece no minuto da saída e sai da tela no minuto seguinte.
 * Ex.: saída 14:10 continua visível às 14:10 e some às 14:11.
 */
export function liberadoPassouHorarioSaida(horaSaida: Date, agora = new Date()): boolean {
  const limite = new Date(horaSaida.getTime());
  limite.setSeconds(0, 0);
  limite.setMinutes(limite.getMinutes() + 1);
  return agora.getTime() >= limite.getTime();
}
