import { useState } from 'react';
import { api } from '../lib/api';
import { SETOR_QUADRO } from '../lib/quadro';
import type { Setor } from '../types';
import { SETOR_CORES } from '../types';

const SETORES: Setor[] = ['MEC', 'ELE', 'LANT', 'PINT', 'REFR', 'BORR', 'LIMP', 'OUTRO'];

interface SelectSetorServicoProps {
  servicoId: string;
  setor: Setor;
  onAtualizado: () => void;
  disabled?: boolean;
  className?: string;
  compacto?: boolean;
}

export function SelectSetorServico({
  servicoId,
  setor,
  onAtualizado,
  disabled = false,
  className = '',
  compacto = false,
}: SelectSetorServicoProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alterar = async (novoSetor: Setor) => {
    if (novoSetor === setor || disabled) return;

    setSalvando(true);
    setErro('');
    try {
      await api.atualizarSetorServico(servicoId, novoSetor);
      onAtualizado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao alterar setor');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <select
        value={setor}
        disabled={disabled || salvando}
        onChange={(e) => void alterar(e.target.value as Setor)}
        aria-label="Setor do serviço"
        title="Alterar setor do serviço"
        className={`rounded border border-slate-600 bg-white font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 ${
          compacto ? 'text-[10px] px-1 py-0.5 min-w-[3.5rem]' : 'text-xs px-2 py-1 min-w-[4rem]'
        } ${SETOR_CORES[setor].select}`}
      >
        {SETORES.map((s) => (
          <option key={s} value={s}>
            {SETOR_QUADRO[s]}
          </option>
        ))}
      </select>
      {erro ? <p className="text-[10px] text-red-400 mt-0.5 max-w-[8rem] leading-tight">{erro}</p> : null}
    </div>
  );
}
