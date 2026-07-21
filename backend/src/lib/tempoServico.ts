/** Minutos efetivos de trabalho (desconta pausas). */
export function minutosTrabalhadosServico(
  servico: {
    horaInicio: Date | null;
    pausadoEm: Date | null;
    minutosPausadosAcum: number;
  },
  ate: Date = new Date(),
): number {
  if (!servico.horaInicio) return 0;
  let total = Math.round((ate.getTime() - servico.horaInicio.getTime()) / 60000);
  total -= servico.minutosPausadosAcum ?? 0;
  if (servico.pausadoEm) {
    total -= Math.round((ate.getTime() - servico.pausadoEm.getTime()) / 60000);
  }
  return Math.max(0, total);
}

export function encerrarPausaServico(
  servico: { pausadoEm: Date | null; minutosPausadosAcum: number },
  ate: Date = new Date(),
): { pausadoEm: null; minutosPausadosAcum: number } {
  if (!servico.pausadoEm) {
    return { pausadoEm: null, minutosPausadosAcum: servico.minutosPausadosAcum };
  }
  const minutos = Math.round((ate.getTime() - servico.pausadoEm.getTime()) / 60000);
  return {
    pausadoEm: null,
    minutosPausadosAcum: servico.minutosPausadosAcum + Math.max(0, minutos),
  };
}
