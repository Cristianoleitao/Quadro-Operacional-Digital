import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface InputLocalExternoServicoProps {
  servicoId: string;
  local?: string | null;
  onAtualizado: () => void;
}

export function InputLocalExternoServico({
  servicoId,
  local,
  onAtualizado,
}: InputLocalExternoServicoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valorInicial = useRef(local ?? '');
  const [texto, setTexto] = useState(local ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const proximo = local ?? '';
    valorInicial.current = proximo;
    setTexto(proximo);
  }, [local, servicoId]);

  const salvar = async () => {
    const normalizado = texto.trim().toUpperCase();
    if (normalizado === valorInicial.current.trim().toUpperCase()) return;

    setSalvando(true);
    setErro('');
    try {
      await api.atualizarLocalExterno(servicoId, normalizado);
      valorInicial.current = normalizado;
      onAtualizado();
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
  };

  const handleBlur = () => {
    void salvar();
  };

  return (
    <div className="min-w-[140px]" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={texto}
        disabled={salvando}
        onChange={(e) => setTexto(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Local do serviço"
        aria-label="Local onde será realizado o serviço externo"
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white uppercase placeholder:normal-case placeholder:text-slate-500"
      />
      {erro ? <p className="text-xs text-red-400 mt-1">{erro}</p> : null}
    </div>
  );
}
