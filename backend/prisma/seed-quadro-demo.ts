import { PrismaClient, Role, Setor, StatusServico } from '@prisma/client';

const prisma = new PrismaClient();

const PREFIXO = 'TV';
const TOTAL = 15;

const DISTRIBUICAO: StatusServico[] = [
  ...Array(2).fill(StatusServico.SERVICO_EXTERNO),
  ...Array(2).fill(StatusServico.AGUARDANDO_INSUMO),
  ...Array(2).fill(StatusServico.SERVICO_DEMORADO),
  ...Array(2).fill(StatusServico.MANUTENCAO_PREVENTIVA),
  ...Array(5).fill(StatusServico.EM_EXECUCAO),
  ...Array(2).fill(StatusServico.PARADO_CRITICO),
] as StatusServico[];

const SETORES: Setor[] = ['MEC', 'ELE', 'LANT', 'PINT', 'REFR', 'BORR', 'LIMP', 'OUTRO'];

const DESCRICOES: Record<StatusServico, string[]> = {
  SERVICO_EXTERNO: ['GUINCHO EXTERNO', 'OFICINA PARCEIRA', 'RETIFICA EXTERNA'],
  AGUARDANDO_INSUMO: ['AGUARDA PEÇA MOTOR', 'AGUARDA FILTRO', 'AGUARDA LÂMPADA'],
  SERVICO_DEMORADO: ['TESTE ROTA', 'DIAGNÓSTICO DEMORADO', 'TESTE PRESSÃO'],
  MANUTENCAO_PREVENTIVA: ['REVISÃO 10M KM', 'REVISÃO OLEO', 'REVISÃO FREIO'],
  EM_EXECUCAO: ['TROCA PASTILHA', 'REGULAGEM FREIO', 'REPARO SUSPENSÃO', 'LIMPEZA FILTRO'],
  PARADO_CRITICO: ['SEM FREIO', 'SUPERAQUECIMENTO'],
  FINALIZADO: [],
  CONCLUIDO: [],
};

async function limparDemoAnterior() {
  const veiculos = await prisma.veiculo.findMany({
    where: { numero: { startsWith: PREFIXO } },
    select: { id: true },
  });

  if (veiculos.length === 0) return;

  const ids = veiculos.map((v) => v.id);
  await prisma.solicitacaoInsumo.deleteMany({
    where: { servico: { veiculoId: { in: ids } } },
  });
  await prisma.servico.deleteMany({ where: { veiculoId: { in: ids } } });
  await prisma.veiculo.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  await limparDemoAnterior();

  const profissionais = await prisma.usuario.findMany({
    where: { role: Role.PROFISSIONAL, ativo: true },
    select: { id: true, setor: true },
  });

  const agora = Date.now();

  for (let i = 0; i < TOTAL; i++) {
    const numero = `${PREFIXO}${String(i + 1).padStart(3, '0')}`;
    const status = DISTRIBUICAO[i];
    const setor = SETORES[i % SETORES.length];
    const opcoes = DESCRICOES[status];
    const descricao = `${opcoes[i % opcoes.length]} #${i + 1}`;

    const minutosAtras = (TOTAL - i) * 12;
    const dataEntrada = new Date(agora - minutosAtras * 60_000);

    const profCorretiva =
      status === StatusServico.EM_EXECUCAO || status === StatusServico.PARADO_CRITICO
        ? profissionais.find((p) => p.setor === setor) ?? profissionais[i % profissionais.length]
        : null;

    const veiculo = await prisma.veiculo.create({
      data: {
        numero,
        dataEntrada,
        numeroOs: `OS${String(1000 + i)}`,
        fechadoAdmin: false,
      },
    });

    await prisma.servico.create({
      data: {
        veiculoId: veiculo.id,
        setor,
        descricao,
        status,
        profissionalId: profCorretiva?.id,
        horaAssumido: profCorretiva ? dataEntrada : null,
        horaInicio: profCorretiva ? dataEntrada : null,
      },
    });
  }

  console.log(`Quadro demo: ${TOTAL} carros (${PREFIXO}001–${PREFIXO}${String(TOTAL).padStart(3, '0')}) criados.`);
  console.log('Distribuição: 2 externo, 2 aguardando peça, 2 demorado, 2 preventiva, 5 corretiva, 2 parado crítico.');
  console.log('Para remover: npm run db:seed-quadro:clean -w backend');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
