import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const auditorias = await prisma.auditoria.findMany({
    where: { acao: 'CRIAR', entidade: 'Servico', entidadeId: { not: null } },
    select: { entidadeId: true },
  });

  const servicoIdsManter = [
    ...new Set(auditorias.map((a) => a.entidadeId).filter((id): id is string => Boolean(id))),
  ];

  if (servicoIdsManter.length === 0) {
    console.log('Nenhum serviço via cadastro rápido encontrado na auditoria.');
    console.log('Removendo todos os veículos e serviços do quadro...');
  } else {
    console.log(`Serviços a manter (cadastro rápido): ${servicoIdsManter.length}`);
  }

  const servicosManter = await prisma.servico.findMany({
    where: { id: { in: servicoIdsManter } },
    select: { id: true, veiculoId: true },
  });

  const veiculoIdsManter = [...new Set(servicosManter.map((s) => s.veiculoId))];

  const servicosRemover = await prisma.servico.findMany({
    where: { id: { notIn: servicoIdsManter } },
    select: { id: true },
  });
  const servicoRemoverIds = servicosRemover.map((s) => s.id);

  const veiculosRemover = await prisma.veiculo.findMany({
    where: { id: { notIn: veiculoIdsManter } },
    select: { id: true, numero: true },
  });
  const veiculoRemoverIds = veiculosRemover.map((v) => v.id);

  if (servicoRemoverIds.length > 0) {
    await prisma.solicitacaoInsumo.deleteMany({
      where: { servicoId: { in: servicoRemoverIds } },
    });
    await prisma.servico.deleteMany({ where: { id: { in: servicoRemoverIds } } });
  }

  if (veiculoRemoverIds.length > 0) {
    await prisma.ordemServico.deleteMany({ where: { veiculoId: { in: veiculoRemoverIds } } });
    await prisma.veiculo.deleteMany({ where: { id: { in: veiculoRemoverIds } } });
  }

  console.log(`Removidos ${servicoRemoverIds.length} serviço(s).`);
  console.log(`Removidos ${veiculosRemover.length} veículo(s): ${veiculosRemover.map((v) => v.numero).join(', ') || '—'}`);
  console.log(`Mantidos ${servicosManter.length} serviço(s) em ${veiculoIdsManter.length} veículo(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
