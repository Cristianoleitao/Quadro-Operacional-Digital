-- Desconecta profissionais de serviços em status interno (aguardando peça / externo)
UPDATE "Servico"
SET
  "profissionalId" = NULL,
  "horaAssumido" = NULL,
  "horaInicio" = NULL
WHERE
  "status" IN ('AGUARDANDO_INSUMO', 'SERVICO_EXTERNO')
  AND "profissionalId" IS NOT NULL;
