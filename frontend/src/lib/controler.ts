import type { Usuario } from '../types';

/** Profissional que acompanha apenas serviços externos. */
export function isControler(usuario: Usuario | null | undefined): boolean {
  return usuario?.especialidade?.toUpperCase() === 'CONTROLER';
}
