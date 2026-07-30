-- CreateEnum
CREATE TYPE "ServicioFacturable" AS ENUM ('EXPENSAS', 'USINA', 'CAMUZZI', 'OBRAS_SANITARIAS', 'RETRIBUTIVAS');

-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "cochera" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "dormitorios" INTEGER,
ADD COLUMN     "serviciosHabilitados" "ServicioFacturable"[] DEFAULT ARRAY['EXPENSAS', 'USINA', 'CAMUZZI', 'OBRAS_SANITARIAS', 'RETRIBUTIVAS']::"ServicioFacturable"[],
ADD COLUMN     "superficieCubierta" DECIMAL(8,2);
