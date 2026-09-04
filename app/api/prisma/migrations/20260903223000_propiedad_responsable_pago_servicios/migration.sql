-- CreateEnum
CREATE TYPE "ResponsablePagoServicios" AS ENUM ('PROPIETARIO', 'INMOBILIARIA', 'INQUILINO');

-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "responsablePagoServicios" "ResponsablePagoServicios" NOT NULL DEFAULT 'PROPIETARIO';
