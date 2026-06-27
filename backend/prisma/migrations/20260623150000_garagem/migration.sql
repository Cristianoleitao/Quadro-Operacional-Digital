-- CreateTable
CREATE TABLE "Garagem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Garagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Garagem_nome_estado_key" ON "Garagem"("nome", "estado");

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "garagemId" TEXT;

-- AlterTable
ALTER TABLE "Veiculo" ADD COLUMN "garagemId" TEXT;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_garagemId_fkey" FOREIGN KEY ("garagemId") REFERENCES "Garagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_garagemId_fkey" FOREIGN KEY ("garagemId") REFERENCES "Garagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
