-- AlterTable
ALTER TABLE "Servico" ADD COLUMN "pausadoEm" TIMESTAMP(3);
ALTER TABLE "Servico" ADD COLUMN "minutosPausadosAcum" INTEGER NOT NULL DEFAULT 0;
