-- CreateTable
CREATE TABLE "avisos_descartados" (
    "id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_descartados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avisos_descartados_grupo_clave_key" ON "avisos_descartados"("grupo", "clave");
