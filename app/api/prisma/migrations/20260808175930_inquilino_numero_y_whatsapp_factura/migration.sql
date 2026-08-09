-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "facturaWhatsappMensaje" TEXT NOT NULL DEFAULT 'Hola {nombre}, te comparto la Factura N° {numero} de {propiedad} correspondiente a {mes}. Te dejo el PDF descargado — adjuntalo acá mismo en el chat.';

-- AlterTable
ALTER TABLE "inquilinos" ADD COLUMN     "numero" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_numero_key" ON "inquilinos"("numero");
