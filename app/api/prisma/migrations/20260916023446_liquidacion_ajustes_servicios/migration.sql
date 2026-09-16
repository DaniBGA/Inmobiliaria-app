-- AlterTable
ALTER TABLE "liquidaciones" ADD COLUMN     "sumaAlquileres" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "liquidacion_ajustes_servicios" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "liquidacionId" TEXT NOT NULL,

    CONSTRAINT "liquidacion_ajustes_servicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidacion_ajustes_servicios_liquidacionId_idx" ON "liquidacion_ajustes_servicios"("liquidacionId");

-- AddForeignKey
ALTER TABLE "liquidacion_ajustes_servicios" ADD CONSTRAINT "liquidacion_ajustes_servicios_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
