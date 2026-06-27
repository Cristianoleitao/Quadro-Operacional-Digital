import fs from 'fs';

import path from 'path';

import { StatusServico } from '@prisma/client';

import { prisma } from './prisma';

import {

  mapaExternoParaHorarios,

  normalizarNumeroVeiculo,

  parseHoraSaidaTexto,

  type SaidaVeiculoExterna,

} from './saidaVeiculosParse';

import { carregarHorariosDoSite } from './saidaVeiculosSite';



let ultimaSincronizacao = 0;

let sincronizando: Promise<void> | null = null;

let primeiraSincronizacao = true;



function caminhoMock(): string {

  const custom = process.env.SAIDA_VEICULOS_MOCK_PATH?.trim();

  if (custom) return path.resolve(custom);



  const candidatos = [

    path.resolve(process.cwd(), 'data/saida-veiculos-mock.json'),

    path.resolve(__dirname, '../../data/saida-veiculos-mock.json'),

  ];



  for (const arquivo of candidatos) {

    if (fs.existsSync(arquivo)) return arquivo;

  }



  return candidatos[0];

}



async function carregarMockArquivo(): Promise<Map<string, Date>> {

  const arquivo = caminhoMock();

  if (!fs.existsSync(arquivo)) return new Map();



  try {

    const bruto = fs.readFileSync(arquivo, 'utf-8');

    const dados = JSON.parse(bruto) as SaidaVeiculoExterna;

    return mapaExternoParaHorarios(dados);

  } catch (err) {

    console.warn('[saida-veiculos] Falha ao ler mock:', err);

    return new Map();

  }

}



async function carregarMock(numerosQuadro: string[]): Promise<Map<string, Date>> {

  const mapa = await carregarMockArquivo();

  const permitidos = new Set(numerosQuadro.map(normalizarNumeroVeiculo));

  const filtrado = new Map<string, Date>();

  for (const [numero, hora] of mapa) {

    if (permitidos.has(numero)) filtrado.set(numero, hora);

  }

  return filtrado;

}



/** Aplica ou remove hora de saída apenas dos veículos corretivos informados. */

async function aplicarHorarios(mapa: Map<string, Date>, numerosVeiculo: string[]): Promise<void> {

  if (numerosVeiculo.length === 0) return;



  const numeros = [...new Set(numerosVeiculo.map(normalizarNumeroVeiculo))];

  const veiculos = await prisma.veiculo.findMany({

    where: {

      OR: numeros.map((numero) => ({

        numero: { equals: numero, mode: 'insensitive' as const },

      })),

    },

    select: { id: true, numero: true, horaSaida: true },

  });



  const updates = veiculos

    .map((veiculo) => {

      const chave = normalizarNumeroVeiculo(veiculo.numero);

      const hora = mapa.get(chave) ?? null;



      if (!hora && !veiculo.horaSaida) return null;

      if (hora && veiculo.horaSaida?.getTime() === hora.getTime()) return null;



      return prisma.veiculo.update({

        where: { id: veiculo.id },

        data: { horaSaida: hora },

      });

    })

    .filter((op): op is NonNullable<typeof op> => op !== null);



  if (updates.length > 0) {

    await prisma.$transaction(updates);

  }



  const comSaida = veiculos.filter((v) => mapa.has(normalizarNumeroVeiculo(v.numero))).length;

  const semSaida = veiculos.length - comSaida;

  if (veiculos.length > 0 && comSaida === 0) {

    console.warn(

      '[saida-veiculos] Nenhum veículo corretivo do quadro encontrado no site/mock. ' +

        `Corretivos: ${numeros.join(', ')}.`,

    );

  } else if (semSaida > 0) {

    console.info(

      `[saida-veiculos] ${comSaida} com saída hoje, ${semSaida} corretivos sem horário na fonte.`,

    );

  }

}



async function sincronizarSaidas(numerosVeiculo: string[]): Promise<void> {

  const url = process.env.SAIDA_VEICULOS_URL?.trim();

  const usarMock =

    process.env.SAIDA_VEICULOS_MOCK === 'true' || process.env.SAIDA_VEICULOS_MOCK === '1' || !url;



  try {

    const mapa = usarMock

      ? await carregarMock(numerosVeiculo)

      : await carregarHorariosDoSite(url!, numerosVeiculo);

    await aplicarHorarios(mapa, numerosVeiculo);

  } catch (err) {

    console.warn('[saida-veiculos] Falha ao consultar site, tentando mock:', err);

    const mapa = await carregarMock(numerosVeiculo);

    await aplicarHorarios(mapa, numerosVeiculo);

  }

}



/** Atualiza horários de saída dos veículos corretivos do quadro (cache curto). */

export async function garantirSaidasAtualizadas(numerosVeiculo: string[]): Promise<void> {

  if (numerosVeiculo.length === 0) return;



  if (primeiraSincronizacao) {

    primeiraSincronizacao = false;

    ultimaSincronizacao = 0;

  }



  const intervalo = Number(process.env.SAIDA_VEICULOS_SYNC_INTERVAL_MS || 60_000);

  if (Date.now() - ultimaSincronizacao < intervalo) return;



  if (sincronizando) {

    await sincronizando;

    return;

  }



  sincronizando = sincronizarSaidas(numerosVeiculo)

    .catch((err) => {

      console.error('[saida-veiculos] Erro ao sincronizar:', err);

    })

    .finally(() => {

      ultimaSincronizacao = Date.now();

      sincronizando = null;

    });



  await sincronizando;

}



export function modoSaidaVeiculos(): 'site' | 'mock' {

  const url = process.env.SAIDA_VEICULOS_URL?.trim();

  const mockForcado = process.env.SAIDA_VEICULOS_MOCK === 'true' || process.env.SAIDA_VEICULOS_MOCK === '1';

  if (mockForcado || !url) return 'mock';

  return 'site';

}



const STATUS_CORRETIVA_SAIDA: StatusServico[] = [

  StatusServico.EM_EXECUCAO,

  StatusServico.PARADO_CRITICO,

];



/** Sincroniza e anexa horaSaida aos veículos corretivos da lista. */

export async function anexarHoraSaidaVeiculos<

  T extends {

    veiculoId: string;

    status: StatusServico;

    veiculo: { numero: string; horaSaida?: Date | null };

  },

>(servicos: T[]): Promise<T[]> {

  if (servicos.length === 0) return servicos;



  const numerosCorretiva = [

    ...new Set(

      servicos

        .filter((s) => STATUS_CORRETIVA_SAIDA.includes(s.status))

        .map((s) => s.veiculo.numero),

    ),

  ];

  await garantirSaidasAtualizadas(numerosCorretiva);



  const veiculoIds = [...new Set(servicos.map((s) => s.veiculoId))];

  const veiculos = await prisma.veiculo.findMany({

    where: { id: { in: veiculoIds } },

    select: { id: true, horaSaida: true },

  });

  const mapa = new Map(veiculos.map((v) => [v.id, v.horaSaida]));



  return servicos.map((s) => ({

    ...s,

    veiculo: {

      ...s.veiculo,

      horaSaida: mapa.get(s.veiculoId) ?? s.veiculo.horaSaida ?? null,

    },

  }));

}


