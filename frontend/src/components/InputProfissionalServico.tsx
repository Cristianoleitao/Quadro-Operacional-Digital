import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ProfissionalResumo } from '../types';

interface ProfissionalLista {
  id: string;
  nome: string;
  matricula: string;
  setor?: string | null;
}

interface InputProfissionalServicoProps {
  servicoId: string;
  profissional?: ProfissionalResumo | null;
  profissionais: ProfissionalLista[];
  onAtualizado: () => void;
  variant: 'admin' | 'quadro';
  editando: boolean;
  onEditandoChange: (editando: boolean) => void;
  badgeClass?: string;
  textoClaro?: boolean;
}

export function primeiroNome(nome?: string | null): string {
  if (!nome) return '';
  return nome.split(' ')[0]?.toUpperCase() ?? '';
}

export function InputProfissionalServico({
  servicoId,
  profissional,
  profissionais,
  onAtualizado,
  variant,
  editando,
  onEditandoChange,
  badgeClass,
  textoClaro,
}: InputProfissionalServicoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelandoRef = useRef(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (editando) {
      setNome(profissional?.nome?.split(' ')[0] ?? '');
      setErro('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editando, profissional?.nome]);

  const cancelar = () => {
    cancelandoRef.current = true;
    setErro('');
    onEditandoChange(false);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await api.atribuirProfissional(servicoId, nome.trim());
      onAtualizado();
      onEditandoChange(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void salvar();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelar();
    }
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (cancelandoRef.current) {
        cancelandoRef.current = false;
        return;
      }
      void salvar();
    }, 120);
  };

  const listId = `prof-list-${servicoId}`;

  if (editando) {
    if (variant === 'quadro') {
      return (
        <span className="inline-flex flex-col align-middle ml-0.5 max-w-[88px]">
          <input
            ref={inputRef}
            type="text"
            list={listId}
            value={nome}
            disabled={salvando}
            onChange={(e) => setNome(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            data-prof-input={servicoId}
            placeholder="NOME"
            className="w-full min-w-[64px] px-0.5 py-px text-[10px] font-bold uppercase bg-white text-black border border-neutral-800 rounded"
          />
          {erro && <span className="text-[8px] text-red-600 leading-none mt-px">{erro}</span>}
          <datalist id={listId}>
            {profissionais.map((p) => (
              <option key={p.id} value={primeiroNome(p.nome)} />
            ))}
          </datalist>
        </span>
      );
    }

    return (
      <div className="min-w-[120px]" data-prof-input={servicoId}>
        <input
          ref={inputRef}
          type="text"
          list={listId}
          value={nome}
          disabled={salvando}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Nome do profissional"
          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white uppercase"
        />
        {erro && <p className="text-xs text-red-400 mt-1">{erro}</p>}
        <datalist id={listId}>
          {profissionais.map((p) => (
            <option key={p.id} value={p.nome} />
          ))}
        </datalist>
      </div>
    );
  }

  if (variant === 'quadro') {
    if (profissional?.nome) {
      return (
        <span className={badgeClass}>
          {primeiroNome(profissional.nome)}
        </span>
      );
    }
    return null;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onEditandoChange(true);
      }}
      className="text-left hover:opacity-90"
      title="Clique para incluir profissional"
    >
      {profissional?.nome ? (
        <span className={badgeClass ?? ''}>{profissional.nome}</span>
      ) : (
        <span className={textoClaro ? 'text-white' : 'text-inherit'}>—</span>
      )}
    </button>
  );
}
