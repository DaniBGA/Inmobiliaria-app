-- CreateTable
CREATE TABLE "fotos_propiedad" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "propiedadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fotos_propiedad_propiedadId_idx" ON "fotos_propiedad"("propiedadId");

-- AddForeignKey
ALTER TABLE "fotos_propiedad" ADD CONSTRAINT "fotos_propiedad_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
