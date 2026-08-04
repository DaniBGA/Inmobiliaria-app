-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "eliminadoEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "clientes_eliminadoEn_idx" ON "clientes"("eliminadoEn");
