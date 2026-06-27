-- Backfill de garagem em registros legados (no-op em banco novo).
UPDATE "Veiculo" SET "garagemId" = "garagemId" WHERE false;
