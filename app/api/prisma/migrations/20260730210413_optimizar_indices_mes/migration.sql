-- CreateIndex
CREATE INDEX "gastos_mes_destino_idx" ON "gastos"("mes", "destino");

-- CreateIndex
CREATE INDEX "liquidaciones_mes_idx" ON "liquidaciones"("mes");
