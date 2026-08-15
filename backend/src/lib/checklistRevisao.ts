import { Setor, TipoChecklist } from '@prisma/client';

export const SETORES_CHECKLIST_PREVENTIVA: Setor[] = [
  Setor.MEC,
  Setor.ELE,
  Setor.REFR,
  Setor.LANT,
  Setor.PINT,
  Setor.BORR,
];

/** Checklist 15.000 na corretiva — sem pintura. */
export const SETORES_CHECKLIST_15000: Setor[] = [
  Setor.MEC,
  Setor.ELE,
  Setor.LANT,
  Setor.BORR,
  Setor.REFR,
];

export const TEXTO_CHECKLIST_15000 = 'CHECKLIST 15.000';
export const TEXTO_REVISAO_PREVENTIVA = 'REVISÃO PREVENTIVA';

export function setoresDoTipoChecklist(tipo: TipoChecklist): Setor[] {
  return tipo === TipoChecklist.CHECKLIST_15000
    ? SETORES_CHECKLIST_15000
    : SETORES_CHECKLIST_PREVENTIVA;
}

export function descricaoTipoChecklist(tipo: TipoChecklist): string {
  return tipo === TipoChecklist.CHECKLIST_15000
    ? TEXTO_CHECKLIST_15000
    : TEXTO_REVISAO_PREVENTIVA;
}

export type ItemModeloChecklist = {
  setor: Setor;
  ordem: number;
  descricao: string;
  quantidade: number;
};

/** Placeholders — 5 itens por setor até a lista definitiva. */
export function itensModeloChecklist(tipo: TipoChecklist): ItemModeloChecklist[] {
  const prefixo = tipo === TipoChecklist.CHECKLIST_15000 ? 'CK15' : 'REV';
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
