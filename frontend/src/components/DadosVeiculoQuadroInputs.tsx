import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { horaInputVeiculo, osInputVeiculo } from '../lib/quadro';
import type { Servico, Veiculo } from '../types';

function classeInput(className?: string): string {
  return [
    'border border-neutral-400 rounded font-mono text-center uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black leading-none',
    className ?? 'w-full min-w-0 text-xs px-1 py-0.5',
  ].join(' ');
}

interface PropsBase {
  veiculoId: string;
  veiculo: Veiculo;
  className?: string;
}

export function InputHoraVeiculo({
  veiculoId,
  veiculo,
  servicos,
  className,
}: PropsBase & { servicos: Servico[] }) {
  const [valor, setValor] = useState(() => horaInputVeiculo(veiculo, servicos));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(horaInputVeiculo(veiculo, servicos));
  }, [veiculoId, veiculo.dataEntrada, servicos]);

  const salvar = async () => {
    const normalizado = valor.trim().replace(/^(\d{2})H(\d{2})$/i, '$1:$2');
    if (normalizado === horaInputVeiculo(veiculo, servicos)) return;
    if (normalizado && !/^\d{2}:\d{2}$/.test(normalizado)) return;

    setSalvando(true);
    try {
      await api.atualizarDadosVeiculoQuadro(veiculoId, { hora: normalizado || '' });
    } catch (err) {
      console.error(err);
      setValor(horaInputVeiculo(veiculo, servicos));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <input
      type="text"
      value={valor}
      disabled={salvando}
      placeholder="HH:MM"
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d:Hh]/g, '').slice(0, 5);
        setValor(v.toUpperCase());
      }}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={classeInput(className)}
    />
  );
}

export function InputOsVeiculo({ veiculoId, veiculo, className }: PropsBase) {
  const [valor, setValor] = useState(() => osInputVeiculo(veiculo));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(osInputVeiculo(veiculo));
  }, [veiculoId, veiculo.numeroOs]);

  const salvar = async () => {
    const novo = valor.trim().toUpperCase();
    if (novo === osInputVeiculo(veiculo)) return;

    setSalvando(true);
    try {
      await api.atualizarDadosVeiculoQuadro(veiculoId, { numeroOs: novo });
    } catch (err) {
      console.error(err);
      setValor(osInputVeiculo(veiculo));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <input
      type="text"
      value={valor}
      disabled={salvando}
      placeholder="OS"
      onChange={(e) => setValor(e.target.value.toUpperCase())}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={classeInput(className)}
    />
  );
}
