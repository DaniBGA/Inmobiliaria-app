-- AlterEnum
-- Nuevos servicios facturables opcionales por propiedad (§3.5) — aditivo,
-- no toca filas existentes.
ALTER TYPE "ServicioFacturable" ADD VALUE 'CLOACAS';
ALTER TYPE "ServicioFacturable" ADD VALUE 'GAS_ENVASADO';
ALTER TYPE "ServicioFacturable" ADD VALUE 'SISTEMA_BIODIGESTOR';
