import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PREFIXO = 'TV';

async function main() {
  const veiculos = await prisma.veiculo.findMany({
    where: { numero: { startsWith: PREFIXO } },
    select: { id: true, numero: true },
  });

  if (veiculos.length === 0) {
    console.log('Nenhum carro demo no quadro.');
    return;
  }

  const ids = veiculos.map((v) => v.id);
  await prisma.solicitacaoInsumo.deleteMany({
    where: { servico: { veiculoId: { in: ids } } },
  });
  await prisma.servico.deleteMany({ where: { veiculoId: { in: ids } } });
  await prisma.veiculo.deleteMany({ where: { id: { in: ids } } });

  console.log(`Removidos ${veiculos.length} carros demo (${PREFIXO}*).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
