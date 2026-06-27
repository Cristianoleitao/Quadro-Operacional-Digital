-- AlterTable
ALTER TABLE "SolicitacaoInsumo" ADD COLUMN "solicitadoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "SolicitacaoInsumo" ADD CONSTRAINT "SolicitacaoInsumo_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
