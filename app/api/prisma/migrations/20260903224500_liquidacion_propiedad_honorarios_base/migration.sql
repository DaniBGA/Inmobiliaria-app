-- AlterTable
ALTER TABLE "liquidacion_propiedades" ADD COLUMN     "baseAlquilerHonorarios" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "porcentajeHonorariosAdministracion" DECIMAL(5,2) NOT NULL DEFAULT 0;
