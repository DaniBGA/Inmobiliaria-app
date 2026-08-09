-- AlterTable
ALTER TABLE "eventos_agenda" ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "integrantes_equipo" ADD COLUMN     "usuarioId" TEXT;

-- CreateIndex
CREATE INDEX "eventos_agenda_usuarioId_idx" ON "eventos_agenda"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "integrantes_equipo_usuarioId_key" ON "integrantes_equipo"("usuarioId");

-- AddForeignKey
ALTER TABLE "integrantes_equipo" ADD CONSTRAINT "integrantes_equipo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
