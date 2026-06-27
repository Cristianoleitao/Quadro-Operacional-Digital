import fs from 'fs';
import path from 'path';
import {
  extrairHoraDoTexto,
  mapaExternoParaHorarios,
  normalizarNumeroVeiculo,
  parseHoraSaidaTexto,
  type SaidaVeiculoExterna,
} from './saidaVeiculosParse';

function filtrarNumerosQuadro(
  mapa: Map<string, Date>,
  numerosQuadro: string[],
): Map<string, Date> {
  const permitidos = new Set(numerosQuadro.map(normalizarNumeroVeiculo));
  const filtrado = new Map<string, Date>();
  for (const [numero, hora] of mapa) {
    if (permitidos.has(numero)) filtrado.set(numero, hora);
  }
  return filtrado;
}

function htmlParaTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairParVeiculoHora(
  texto: string,
  numerosQuadro: Set<string>,
): { veiculo: string; hora: string } | null {
  const hora = extrairHoraDoTexto(texto);
  if (!hora) return null;

  const textoNorm = texto.toUpperCase();
  for (const numero of numerosQuadro) {
    const padrao = new RegExp(`(^|[^0-9])${numero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^0-9]|$)`);
    if (padrao.test(textoNorm)) {
      return { veiculo: numero, hora };
    }
  }
  return null;
}

function blocosHtml(html: string): string[] {
  const porTag = html.split(/<\/tr>|<\/li>|<\/div>/i).map((b) => htmlParaTexto(b));
  const linhas = porTag.filter((b) => b.length > 0);

  if (linhas.length > 1) return linhas;

  const texto = htmlParaTexto(html);
  return texto.split(/\n/).map((l) => l.trim()).filter(Boolean);
}

/** Varre blocos/linhas do HTML e cruza número do carro com horário de saída. */
export function extrairHorariosDoHtml(
  html: string,
  numerosQuadro: string[],
): Map<string, Date> {
  const mapa = new Map<string, Date>();
  const numeros = new Set(numerosQuadro.map(normalizarNumeroVeiculo));
  if (numeros.size === 0) return mapa;

  for (const bloco of blocosHtml(html)) {
    const par = extrairParVeiculoHora(bloco, numeros);
    if (!par || mapa.has(par.veiculo)) continue;

    const hora = parseHoraSaidaTexto(par.hora);
    if (hora) mapa.set(par.veiculo, hora);
  }

  if (mapa.size === 0) {
    for (const numero of numeros) {
      const hora = buscarHoraProximaAoNumero(html, numero);
      if (hora) mapa.set(numero, hora);
    }
  }

  return mapa;
}

function buscarHoraProximaAoNumero(html: string, numero: string): Date | null {
  const texto = htmlParaTexto(html);
  const idx = texto.toUpperCase().indexOf(numero);
  if (idx < 0) return null;

  const trecho = texto.slice(idx, idx + 400);
  const horaStr = extrairHoraDoTexto(trecho);
  if (!horaStr) return null;
  return parseHoraSaidaTexto(horaStr);
}

async function baixarConteudoSite(url: string): Promise<{ body: string; contentType: string }> {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'User-Agent':
        process.env.SAIDA_VEICULOS_SITE_USER_AGENT?.trim() ||
        'QuadroOperacional-Digital/1.0 (+horario-saida)',
    },
    signal: AbortSignal.timeout(Number(process.env.SAIDA_VEICULOS_TIMEOUT_MS || 15_000)),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Site retornou HTTP ${res.status}`);
  }

  return {
    body: await res.text(),
    contentType: res.headers.get('content-type') ?? '',
  };
}

function carregarFixtureLocal(caminho: string): string {
  const resolvido = path.resolve(caminho);
  if (!fs.existsSync(resolvido)) {
    throw new Error(`Fixture não encontrado: ${resolvido}`);
  }
  return fs.readFileSync(resolvido, 'utf-8');
}

function resolverConteudo(url: string): { body: string; contentType: string } {
  const fixtureEnv = process.env.SAIDA_VEICULOS_SITE_FIXTURE_PATH?.trim();

  if (url.startsWith('fixture:')) {
    const caminho = url.slice('fixture:'.length).trim() || fixtureEnv;
    if (!caminho) throw new Error('fixture: sem caminho de arquivo');
    return { body: carregarFixtureLocal(caminho), contentType: 'text/html' };
  }

  if (fixtureEnv && process.env.SAIDA_VEICULOS_USAR_FIXTURE === 'true') {
    return { body: carregarFixtureLocal(fixtureEnv), contentType: 'text/html' };
  }

  return { body: '', contentType: '' };
}

/**
 * Acessa o site externo (ou fixture HTML local) e retorna horários apenas dos
 * veículos que estão no quadro corretivo neste momento.
 */
export async function carregarHorariosDoSite(
  url: string,
  numerosQuadro: string[],
): Promise<Map<string, Date>> {
  const local = resolverConteudo(url);
  let body: string;
  let contentType: string;

  if (local.body) {
    body = local.body;
    contentType = local.contentType;
  } else {
    const resposta = await baixarConteudoSite(url);
    body = resposta.body;
    contentType = resposta.contentType;
  }

  let mapa: Map<string, Date>;

  if (contentType.includes('application/json')) {
    mapa = mapaExternoParaHorarios(JSON.parse(body) as SaidaVeiculoExterna);
  } else {
    mapa = extrairHorariosDoHtml(body, numerosQuadro);
  }

  const filtrado = filtrarNumerosQuadro(mapa, numerosQuadro);

  if (filtrado.size > 0) {
    console.info(
      `[saida-veiculos] Site: ${filtrado.size} veículo(s) do quadro com saída — ${[...filtrado.keys()].join(', ')}`,
    );
  }

  return filtrado;
}
