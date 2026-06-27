-- AlterTable
ALTER TABLE "Servico" DROP COLUMN "diagnostico",
DROP COLUMN "causaRaiz";

-- DropEnum
DROP TYPE "CausaRaiz";
