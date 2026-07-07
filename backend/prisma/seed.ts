import { PrismaClient, Role, Setor } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10);

  const garagemCeara = await prisma.garagem.upsert({
    where: { nome_estado: { nome: 'CEARÁ', estado: 'RIO DE JANEIRO' } },
    update: {},
    create: { nome: 'CEARÁ', estado: 'RIO DE JANEIRO' },
  });

  const garagemCuricica = await prisma.garagem.upsert({
    where: { nome_estado: { nome: 'CURICICA', estado: 'RIO DE JANEIRO' } },
    update: {},
    create: { nome: 'CURICICA', estado: 'RIO DE JANEIRO' },
  });

  await prisma.usuario.upsert({
    where: { matricula: 'ADM001' },
    update: {},
    create: {
      nome: 'Administrador',
      matricula: 'ADM001',
      senha: senhaHash,
      role: Role.ADMINISTRADOR,
    },
  });

  await prisma.usuario.upsert({
    where: { matricula: 'GER001' },
    update: {},
    create: {
      nome: 'Gerente',
      matricula: 'GER001',
      senha: senhaHash,
      role: Role.GERENCIA,
    },
  });

  await prisma.usuario.upsert({
    where: { matricula: 'EST001' },
    update: {},
    create: {
      nome: 'Estoque',
      matricula: 'EST001',
      senha: senhaHash,
      role: Role.ESTOQUE,
      especialidade: 'Estoque',
    },
  });

  const profissionais = [
    { nome: 'João Silva', matricula: 'MEC001', setor: Setor.MEC, especialidade: 'Mecânico', garagemId: garagemCeara.id },
    { nome: 'Carlos Santos', matricula: 'ELE001', setor: Setor.ELE, especialidade: 'Eletricista', garagemId: garagemCeara.id },
    { nome: 'Pedro Oliveira', matricula: 'LANT001', setor: Setor.LANT, especialidade: 'Lanterneiro', garagemId: garagemCuricica.id },
    { nome: 'Marcos Souza', matricula: 'PINT001', setor: Setor.PINT, especialidade: 'Pintor', garagemId: garagemCuricica.id },
    { nome: 'Ana Costa', matricula: 'REFR001', setor: Setor.REFR, especialidade: 'Técnico Refrigeração', garagemId: garagemCeara.id },
    { nome: 'Luiz Ferreira', matricula: 'BORR001', setor: Setor.BORR, especialidade: 'Borracheiro', garagemId: garagemCeara.id },
    { nome: 'Fernanda Lima', matricula: 'LIMP001', setor: Setor.LIMP, especialidade: 'Limpeza', garagemId: garagemCuricica.id },
    { nome: 'Controler', matricula: 'CTR001', setor: null, especialidade: 'Controler', garagemId: null },
  ];

  for (const prof of profissionais) {
    await prisma.usuario.upsert({
      where: { matricula: prof.matricula },
      update: {
        garagemId: prof.garagemId,
        setor: prof.setor,
        especialidade: prof.especialidade,
        nome: prof.nome,
      },
      create: {
        nome: prof.nome,
        matricula: prof.matricula,
        senha: senhaHash,
        role: Role.PROFISSIONAL,
        setor: prof.setor,
        especialidade: prof.especialidade,
        garagemId: prof.garagemId,
      },
    });
  }

  const veiculos = Array.from({ length: 50 }, (_, i) => ({
    numero: String(13300 + i),
    garagemId: i % 2 === 0 ? garagemCeara.id : garagemCuricica.id,
  }));

  for (const v of veiculos) {
    await prisma.veiculo.upsert({
      where: { numero: v.numero },
      update: { garagemId: v.garagemId },
      create: v,
    });
  }

  console.log('Seed concluído!');
  console.log('Garagens: CEARÁ e CURICICA — Rio de Janeiro');
  console.log('Usuários criados com senha: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
