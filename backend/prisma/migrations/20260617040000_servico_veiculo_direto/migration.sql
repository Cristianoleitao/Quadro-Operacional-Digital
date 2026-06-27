-- AlterTable
ALTER TABLE "Servico" ADD COLUMN "veiculoId" TEXT;
ALTER TABLE "Servico" ADD COLUMN "numeroOs" TEXT;

-- Backfill veiculoId from OrdemServico
UPDATE "Servico" s
SET "veiculoId" = os."veiculoId"
FROM "OrdemServico" os
WHERE s."ordemServicoId" = os.id;

ALTER TABLE "Servico" ALTER COLUMN "veiculoId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Servico" DROP CONSTRAINT "Servico_ordemServicoId_fkey";

-- AlterTable
ALTER TABLE "Servico" ALTER COLUMN "ordemServicoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "Veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Servico" ADD CONSTRAINT "Servico_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
