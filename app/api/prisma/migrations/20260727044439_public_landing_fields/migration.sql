-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "publicoDireccion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publicoEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publicoInstagramUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publicoMatricula" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publicoTelefono" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publicoWhatsapp" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "ambientes" INTEGER,
ADD COLUMN     "banos" INTEGER,
ADD COLUMN     "superficieM2" DECIMAL(8,2);
