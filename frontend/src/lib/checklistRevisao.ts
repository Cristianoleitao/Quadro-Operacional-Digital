import type { Setor, TipoChecklist } from '../types';

export const SETORES_CHECKLIST_PREVENTIVA: Setor[] = [
  'MEC',
  'ELE',
  'REFR',
  'LANT',
  'PINT',
  'BORR',
];

export const SETORES_CHECKLIST_15000: Setor[] = ['MEC', 'ELE', 'LANT', 'BORR', 'REFR'];

export type ItemModeloChecklist = {
  setor: Setor;
  ordem: number;
  descricao: string;
  quantidade: number;
};

export function setoresDoTipoChecklist(tipo: TipoChecklist): Setor[] {
  return tipo === 'CHECKLIST_15000' ? SETORES_CHECKLIST_15000 : SETORES_CHECKLIST_PREVENTIVA;
}

export function itensModeloChecklist(tipo: TipoChecklist): ItemModeloChecklist[] {
  const prefixo = tipo === 'CHECKLIST_15000' ? 'CK15' : 'REV';
  return setoresDoTipoChecklist(tipo).flatMap((setor) =>
    [1, 2, 3, 4, 5].map((n) => ({
      setor,
      ordem: n,
      descricao: `${prefixo} ITEM ${n}`,
      quantidade: 1,
    })),
  );
}

export function chaveItemChecklist(setor: Setor, ordem: number): string {
  return `${setor}:${ordem}`;
}
