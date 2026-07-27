/*
  Warnings:

  - Added the required column `monto` to the `movimientos_caja` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "movimientos_caja" ADD COLUMN     "monto" DECIMAL(14,2) NOT NULL;
