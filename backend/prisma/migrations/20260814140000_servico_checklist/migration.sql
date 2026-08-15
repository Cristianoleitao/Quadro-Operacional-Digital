-- CreateEnum
CREATE TYPE "TipoChecklist" AS ENUM ('REVISAO_PREVENTIVA', 'CHECKLIST_15000');

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN "tipoChecklist" "TipoChecklist";

-- CreateTable
CREATE TABLE "ServicoChecklistItem" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "setor" "Setor" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "conferido" BOOLEAN NOT NULL DEFAULT false,
    "conferidoEm" TIMESTAMP(3),
    "conferidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicoChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicoChecklistItem_servicoId_setor_idx" ON "ServicoChecklistItem"("servicoId", "setor");

-- AddForeignKey
ALTER TABLE "ServicoChecklistItem" ADD CONSTRAINT "ServicoChecklistItem_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoChecklistItem" ADD CONSTRAINT "ServicoChecklistItem_conferidoPorId_fkey" FOREIGN KEY ("conferidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
