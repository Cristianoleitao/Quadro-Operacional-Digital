export function isEncarregado(usuario?: { especialidade?: string | null } | null): boolean {
  return usuario?.especialidade?.trim().toUpperCase() === 'ENCARREGADO';
}
