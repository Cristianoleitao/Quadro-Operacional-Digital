-- CreateTable
CREATE TABLE "ServicoParticipante" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "horaAssumido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaInicio" TIMESTAMP(3),
    "horaTermino" TIMESTAMP(3),
    "pausadoEm" TIMESTAMP(3),
    "minutosPausadosAcum" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicoParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicoParticipante_profissionalId_horaTermino_idx" ON "ServicoParticipante"("profissionalId", "horaTermino");

-- CreateIndex
CREATE UNIQUE INDEX "ServicoParticipante_servicoId_profissionalId_key" ON "ServicoParticipante"("servicoId", "profissionalId");

-- AddForeignKey
ALTER TABLE "ServicoParticipante" ADD CONSTRAINT "ServicoParticipante_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoParticipante" ADD CONSTRAINT "ServicoParticipante_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
