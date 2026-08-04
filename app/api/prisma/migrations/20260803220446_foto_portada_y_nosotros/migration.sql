-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "publicoFotoNosotrosUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "fotos_propiedad" ADD COLUMN     "esPortada" BOOLEAN NOT NULL DEFAULT false;
