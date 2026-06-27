import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Seed mínimo para produção: apenas garagens (cadastro exige garagem). */
async function main() {
  await prisma.garagem.upsert({
    where: { nome_estado: { nome: 'CEARÁ', estado: 'RIO DE JANEIRO' } },
    update: {},
    create: { nome: 'CEARÁ', estado: 'RIO DE JANEIRO' },
  });

  await prisma.garagem.upsert({
    where: { nome_estado: { nome: 'CURICICA', estado: 'RIO DE JANEIRO' } },
    update: {},
    create: { nome: 'CURICICA', estado: 'RIO DE JANEIRO' },
  });

  console.log('Seed mínimo concluído: garagens CEARÁ e CURICICA.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
