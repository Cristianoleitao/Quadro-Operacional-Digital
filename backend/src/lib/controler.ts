/** Profissional que acompanha apenas serviços com status SERVICO_EXTERNO. */
export function isControler(usuario: { especialidade?: string | null } | null | undefined): boolean {
  return usuario?.especialidade?.toUpperCase() === 'CONTROLER';
}
