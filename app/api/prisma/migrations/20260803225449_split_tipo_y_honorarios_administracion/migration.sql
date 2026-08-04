-- AlterEnum
-- Separa "Departamento/Dúplex" en dos valores independientes. Las
-- propiedades ya cargadas como DEPARTAMENTO_DUPLEX pasan a DEPARTAMENTO por
-- defecto (se pueden reclasificar a DUPLEX a mano desde el admin).
BEGIN;
CREATE TYPE "TipoPropiedad_new" AS ENUM ('CASA', 'DEPARTAMENTO', 'DUPLEX', 'QUINTA', 'LOTE', 'CAMPO', 'GALPON', 'LOCAL_OFICINA', 'CABANIAS_HOTELES_OTROS', 'FONDO_DE_COMERCIO', 'COCHERAS');
ALTER TABLE "propiedades" ALTER COLUMN "tipo" TYPE "TipoPropiedad_new" USING (
  CASE WHEN "tipo"::text = 'DEPARTAMENTO_DUPLEX' THEN 'DEPARTAMENTO' ELSE "tipo"::text END
)::"TipoPropiedad_new";
ALTER TABLE "clientes" ALTER COLUMN "busquedaTipoPropiedad" TYPE "TipoPropiedad_new" USING (
  CASE WHEN "busquedaTipoPropiedad"::text = 'DEPARTAMENTO_DUPLEX' THEN 'DEPARTAMENTO' ELSE "busquedaTipoPropiedad"::text END
)::"TipoPropiedad_new";
ALTER TYPE "TipoPropiedad" RENAME TO "TipoPropiedad_old";
ALTER TYPE "TipoPropiedad_new" RENAME TO "TipoPropiedad";
DROP TYPE "TipoPropiedad_old";
COMMIT;

-- AlterTable
ALTER TABLE "liquidacion_propiedades" ADD COLUMN     "honorariosAdministracion" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "honorariosAdministracion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "honorariosAdministracionPorcentaje" DECIMAL(5,2);
