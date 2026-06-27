-- AlterTable
ALTER TABLE "Veiculo" ADD COLUMN "dataEntrada" TIMESTAMP(3),
ADD COLUMN "numeroOs" TEXT;

-- Backfill dataEntrada e numeroOs a partir dos serviços existentes
UPDATE "Veiculo" v
SET "dataEntrada" = COALESCE(
  (
    SELECT s."horaOs"
    FROM "Servico" s
    WHERE s."veiculoId" = v.id AND s."horaOs" IS NOT NULL
    ORDER BY s."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT MIN(s."createdAt")
    FROM "Servico" s
    WHERE s."veiculoId" = v.id
  )
)
WHERE EXISTS (SELECT 1 FROM "Servico" s WHERE s."veiculoId" = v.id);

UPDATE "Veiculo" v
SET "numeroOs" = sub."numeroOs"
FROM (
  SELECT DISTINCT ON ("veiculoId") "veiculoId", "numeroOs"
  FROM "Servico"
  WHERE "numeroOs" IS NOT NULL
  ORDER BY "veiculoId", "createdAt" ASC
) sub
WHERE v.id = sub."veiculoId" AND v."numeroOs" IS NULL;
