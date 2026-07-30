-- CreateTable
CREATE TABLE "liquidacion_gastos" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "liquidacionPropiedadId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "liquidacion_gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidacion_gastos_liquidacionPropiedadId_idx" ON "liquidacion_gastos"("liquidacionPropiedadId");

-- AddForeignKey
ALTER TABLE "liquidacion_gastos" ADD CONSTRAINT "liquidacion_gastos_liquidacionPropiedadId_fkey" FOREIGN KEY ("liquidacionPropiedadId") REFERENCES "liquidacion_propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
