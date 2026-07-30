/*
  "Tipo de cartel" pasa a ser el mismo dato que antes vivía en "estado"
  (Colocado / A pedido / Retirado) en vez de texto libre — el usuario pidió
  que el campo "tipo de cartel" ofrezca esas 3 opciones fijas, y mantener
  un campo "estado" aparte quedaría duplicado. Se preserva el valor real de
  "estado" de cada fila (no el texto libre viejo de "tipoCartel", que se
  descarta a propósito) copiándolo a la columna nueva antes de borrar las
  dos columnas viejas.
*/
ALTER TABLE "carteles" ADD COLUMN "tipoCartel_new" "EstadoCartel";
UPDATE "carteles" SET "tipoCartel_new" = "estado";
ALTER TABLE "carteles" DROP COLUMN "tipoCartel";
ALTER TABLE "carteles" DROP COLUMN "estado";
ALTER TABLE "carteles" RENAME COLUMN "tipoCartel_new" TO "tipoCartel";
ALTER TABLE "carteles" ALTER COLUMN "tipoCartel" SET NOT NULL;
ALTER TABLE "carteles" ALTER COLUMN "tipoCartel" SET DEFAULT 'A_PEDIDO';
