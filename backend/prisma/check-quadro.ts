import { PrismaClient, StatusServico } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const todos = await prisma.servico.groupBy({
    by: ['status'],
    _count: true,
  });
  console.log('Serviços por status:', todos);

  const noQuadro = await prisma.servico.count({
    where: { status: { notIn: [StatusServico.FINALIZADO, StatusServico.CONCLUIDO] } },
  });
  console.log('Serviços visíveis no quadro:', noQuadro);

  const amostra = await prisma.servico.findMany({
    where: { status: { notIn: [StatusServico.FINALIZADO, StatusServico.CONCLUIDO] } },
    take: 5,
    include: { veiculo: { select: { numero: true, fechadoAdmin: true } } },
  });
  console.log('Amostra:', amostra.map((s) => ({
    veiculo: s.veiculo.numero,
    status: s.status,
    descricao: s.descricao,
    fechadoAdmin: s.veiculo.fechadoAdmin,
  })));

  const veiculos = await prisma.veiculo.count();
  console.log('Total veículos:', veiculos);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
