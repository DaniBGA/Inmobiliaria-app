/*
  `Cliente.origen` pasa de texto libre a un enum fijo de 5 opciones
  (Instagram / Página web / En persona / Facebook / Contactos), para poder
  agruparlo en el gráfico de torta de §2.6. Los valores libres existentes se
  mapean al más parecido en vez de perderse: "Portal web" -> PAGINA_WEB.
  Cualquier otro texto libre no reconocido queda en NULL (no hay ninguno hoy
  en la base real).
*/
CREATE TYPE "OrigenCliente" AS ENUM ('INSTAGRAM', 'PAGINA_WEB', 'EN_PERSONA', 'FACEBOOK', 'CONTACTOS');

ALTER TABLE "clientes" ADD COLUMN "origen_new" "OrigenCliente";

UPDATE "clientes" SET "origen_new" = CASE
  WHEN "origen" ILIKE '%portal web%' OR "origen" ILIKE '%pagina web%' OR "origen" ILIKE '%página web%' THEN 'PAGINA_WEB'::"OrigenCliente"
  WHEN "origen" ILIKE '%instagram%' THEN 'INSTAGRAM'::"OrigenCliente"
  WHEN "origen" ILIKE '%facebook%' THEN 'FACEBOOK'::"OrigenCliente"
  WHEN "origen" ILIKE '%persona%' THEN 'EN_PERSONA'::"OrigenCliente"
  WHEN "origen" ILIKE '%contacto%' THEN 'CONTACTOS'::"OrigenCliente"
  ELSE NULL
END;

ALTER TABLE "clientes" DROP COLUMN "origen";
ALTER TABLE "clientes" RENAME COLUMN "origen_new" TO "origen";
