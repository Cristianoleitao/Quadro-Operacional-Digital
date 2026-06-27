export function rotuloGaragem(garagem: { nome: string; estado: string }): string {
  return `${garagem.nome} - ${garagem.estado}`;
}

export function normalizarGaragemTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}
