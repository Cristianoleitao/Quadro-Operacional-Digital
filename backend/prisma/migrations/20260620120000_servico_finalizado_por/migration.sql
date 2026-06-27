-- AlterTable
ALTER TABLE "Servico" ADD COLUMN "finalizadoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_finalizadoPorId_fkey" FOREIGN KEY ("finalizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
