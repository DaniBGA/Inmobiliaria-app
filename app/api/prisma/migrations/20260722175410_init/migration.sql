-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EQUIPO');

-- CreateEnum
CREATE TYPE "ModalidadPropiedad" AS ENUM ('ALQUILER', 'VENTA');

-- CreateEnum
CREATE TYPE "TipoPropiedad" AS ENUM ('CASA', 'DEPARTAMENTO_DUPLEX', 'QUINTA', 'LOTE', 'CAMPO', 'GALPON', 'LOCAL_OFICINA', 'CABANIAS_HOTELES_OTROS', 'FONDO_DE_COMERCIO', 'COCHERAS');

-- CreateEnum
CREATE TYPE "TipoHonorarios" AS ENUM ('LIBRE', 'TRES_POR_CIENTO', 'SEIS_POR_CIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "IndiceAjuste" AS ENUM ('IPC', 'ICL');

-- CreateEnum
CREATE TYPE "PunitorioFrecuencia" AS ENUM ('DIA', 'SEMANA', 'MES', 'UNICO');

-- CreateEnum
CREATE TYPE "PunitorioTipo" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO');

-- CreateEnum
CREATE TYPE "DestinoGasto" AS ENUM ('PROPIETARIO', 'INQUILINO', 'INMOBILIARIA');

-- CreateEnum
CREATE TYPE "MonedaVenta" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PUBLICADA', 'RESERVADA', 'VENDIDA', 'VENDIDA_POR_TERCEROS', 'PAUSADA');

-- CreateEnum
CREATE TYPE "EtapaInteresado" AS ENUM ('CONSULTA', 'VISITA', 'NEGOCIACION', 'RESERVA', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "EstadoCartel" AS ENUM ('COLOCADO', 'A_PEDIDO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "PrioridadIncidencia" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "EstadoIncidencia" AS ENUM ('ABIERTA', 'EN_CURSO', 'RESUELTA');

-- CreateEnum
CREATE TYPE "TipoOperacionCliente" AS ENUM ('ALQUILAR', 'COMPRAR', 'VENDER');

-- CreateEnum
CREATE TYPE "ZonaCliente" AS ENUM ('CENTRO', 'SEMICENTRICO', 'INDIFERENTE');

-- CreateEnum
CREATE TYPE "EstadoCliente" AS ENUM ('SIN_CONTACTAR', 'EN_SEGUIMIENTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('VISITA', 'REUNION', 'FIRMA_BOLETO', 'FIRMA_ESCRITURA', 'TASACION', 'LLAMADO', 'TAREA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "OrigenMovimientoCaja" AS ENUM ('MANUAL', 'COBRO_ALQUILER', 'LIQUIDACION_PROPIETARIO', 'PAGO_PROVEEDOR', 'SENA_VENTA', 'COMISION_VENTA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'EQUIPO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrantes_equipo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "integrantes_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "honorariosDefaultPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "comisionVentaPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ipc" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "icl" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "dolarReferencia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "empresaNombre" TEXT NOT NULL DEFAULT '',
    "empresaCuit" TEXT NOT NULL DEFAULT '',
    "empresaDireccion" TEXT NOT NULL DEFAULT '',
    "empresaContacto" TEXT NOT NULL DEFAULT '',
    "proximoNumeroFactura" INTEGER NOT NULL DEFAULT 1,
    "proximoNumeroRecibo" INTEGER NOT NULL DEFAULT 1,
    "proximoNumeroLiquidacion" INTEGER NOT NULL DEFAULT 1,
    "diaVencimientoAlquiler" INTEGER NOT NULL DEFAULT 10,
    "diasAnticipacionAumento" INTEGER NOT NULL DEFAULT 30,
    "diasAnticipacionVencimiento" INTEGER NOT NULL DEFAULT 30,
    "saldoInicialCaja" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propietarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "modalidad" "ModalidadPropiedad" NOT NULL,
    "tipo" "TipoPropiedad" NOT NULL,
    "montoAlquilerVigente" DECIMAL(14,2),
    "honorariosTipo" "TipoHonorarios",
    "honorariosPorcentaje" DECIMAL(5,2),
    "designadoId" TEXT,
    "indice" "IndiceAjuste",
    "frecuenciaAumentoMeses" INTEGER,
    "contratoInicio" TIMESTAMP(3),
    "contratoFin" TIMESTAMP(3),
    "punitorioFrecuencia" "PunitorioFrecuencia",
    "punitorioTipo" "PunitorioTipo",
    "punitorioValor" DECIMAL(14,2),
    "propietarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquilinos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "propiedadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquilinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_aumentos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_aumentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "comprobante" TEXT,
    "observaciones" TEXT,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "propiedadId" TEXT NOT NULL,
    "movimientoCajaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT NOT NULL,
    "destino" "DestinoGasto" NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "incidenciaId" TEXT,
    "movimientoCajaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "total" DECIMAL(14,2) NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_items" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "numeroLiquidacion" TEXT,
    "facturaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "factura_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibos" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "montoFacturado" DECIMAL(14,2) NOT NULL,
    "montoCobrado" DECIMAL(14,2) NOT NULL,
    "ajusteSobreFacturado" DECIMAL(14,2),
    "propiedadId" TEXT NOT NULL,
    "facturaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibo_items" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "reciboId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recibo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "netoAGirar" DECIMAL(14,2) NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "movimientoCajaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_propiedades" (
    "id" TEXT NOT NULL,
    "cobradoTotal" DECIMAL(14,2) NOT NULL,
    "gastosAbsorbidos" DECIMAL(14,2) NOT NULL,
    "honorarios" DECIMAL(14,2) NOT NULL,
    "neto" DECIMAL(14,2) NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,

    CONSTRAINT "liquidacion_propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_items" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "numeroLiquidacion" TEXT,
    "liquidacionPropiedadId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "liquidacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "moneda" "MonedaVenta" NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'PUBLICADA',
    "vendidaPorTercerosDetalle" TEXT,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "senaRecibida" DECIMAL(14,2),
    "cierreEstimado" TIMESTAMP(3),
    "cierreReal" TIMESTAMP(3),
    "mejorOferta" DECIMAL(14,2),
    "propiedadId" TEXT NOT NULL,
    "movimientoCajaSenaId" TEXT,
    "movimientoCajaComisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interesados_venta" (
    "id" TEXT NOT NULL,
    "etapa" "EtapaInteresado" NOT NULL DEFAULT 'CONSULTA',
    "oferta" DECIMAL(14,2),
    "notas" TEXT,
    "ventaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "nombreLibre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interesados_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carteles" (
    "id" TEXT NOT NULL,
    "tipoCartel" TEXT NOT NULL,
    "medida" TEXT,
    "fechaColocacion" TIMESTAMP(3),
    "fechaRetiro" TIMESTAMP(3),
    "estado" "EstadoCartel" NOT NULL DEFAULT 'A_PEDIDO',
    "propiedadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carteles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "cuit" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "rubro" TEXT NOT NULL,
    "prioridad" "PrioridadIncidencia" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoIncidencia" NOT NULL DEFAULT 'ABIERTA',
    "reportadaPor" TEXT,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEjecucion" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "costo" DECIMAL(14,2),
    "quienPagaCosto" "DestinoGasto",
    "abonadaFecha" TIMESTAMP(3),
    "notas" TEXT,
    "propiedadId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_proveedor" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "movimientoCajaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_proveedor_incidencias" (
    "pagoProveedorId" TEXT NOT NULL,
    "incidenciaId" TEXT NOT NULL,

    CONSTRAINT "pagos_proveedor_incidencias_pkey" PRIMARY KEY ("pagoProveedorId","incidenciaId")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "tipoOperacion" "TipoOperacionCliente" NOT NULL,
    "busquedaTipoPropiedad" "TipoPropiedad",
    "montoDesde" DECIMAL(14,2),
    "montoHasta" DECIMAL(14,2),
    "zona" "ZonaCliente",
    "detalle" TEXT,
    "estado" "EstadoCliente" NOT NULL DEFAULT 'SIN_CONTACTAR',
    "origen" TEXT,
    "visitaOtraInmobiliariaConQuien" TEXT,
    "notas" TEXT,
    "delegadoId" TEXT,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_agenda" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "titulo" TEXT NOT NULL,
    "hecho" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" TEXT,
    "propiedadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT,
    "medio" TEXT,
    "referencia" TEXT,
    "origen" "OrigenMovimientoCaja" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propiedadId" TEXT NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "integrantes_equipo_nombre_key" ON "integrantes_equipo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_propiedadId_key" ON "inquilinos"("propiedadId");

-- CreateIndex
CREATE INDEX "historial_aumentos_propiedadId_fecha_idx" ON "historial_aumentos"("propiedadId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_movimientoCajaId_key" ON "pagos"("movimientoCajaId");

-- CreateIndex
CREATE INDEX "pagos_propiedadId_mes_idx" ON "pagos"("propiedadId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_incidenciaId_key" ON "gastos"("incidenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_movimientoCajaId_key" ON "gastos"("movimientoCajaId");

-- CreateIndex
CREATE INDEX "gastos_propiedadId_mes_idx" ON "gastos"("propiedadId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_propiedadId_mes_key" ON "facturas"("propiedadId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_movimientoCajaId_key" ON "liquidaciones"("movimientoCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_propietarioId_mes_key" ON "liquidaciones"("propietarioId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_propiedadId_key" ON "ventas"("propiedadId");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_movimientoCajaSenaId_key" ON "ventas"("movimientoCajaSenaId");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_movimientoCajaComisionId_key" ON "ventas"("movimientoCajaComisionId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_proveedor_movimientoCajaId_key" ON "pagos_proveedor"("movimientoCajaId");

-- CreateIndex
CREATE INDEX "movimientos_caja_fecha_moneda_idx" ON "movimientos_caja"("fecha", "moneda");

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_designadoId_fkey" FOREIGN KEY ("designadoId") REFERENCES "integrantes_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_aumentos" ADD CONSTRAINT "historial_aumentos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_movimientoCajaId_fkey" FOREIGN KEY ("movimientoCajaId") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_movimientoCajaId_fkey" FOREIGN KEY ("movimientoCajaId") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibo_items" ADD CONSTRAINT "recibo_items_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "recibos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_movimientoCajaId_fkey" FOREIGN KEY ("movimientoCajaId") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_propiedades" ADD CONSTRAINT "liquidacion_propiedades_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_propiedades" ADD CONSTRAINT "liquidacion_propiedades_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_liquidacionPropiedadId_fkey" FOREIGN KEY ("liquidacionPropiedadId") REFERENCES "liquidacion_propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_movimientoCajaSenaId_fkey" FOREIGN KEY ("movimientoCajaSenaId") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_movimientoCajaComisionId_fkey" FOREIGN KEY ("movimientoCajaComisionId") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interesados_venta" ADD CONSTRAINT "interesados_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interesados_venta" ADD CONSTRAINT "interesados_venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carteles" ADD CONSTRAINT "carteles_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_movimientoCajaId_fkey" FOREIGN KEY ("movimientoCajaId") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor_incidencias" ADD CONSTRAINT "pagos_proveedor_incidencias_pagoProveedorId_fkey" FOREIGN KEY ("pagoProveedorId") REFERENCES "pagos_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor_incidencias" ADD CONSTRAINT "pagos_proveedor_incidencias_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_delegadoId_fkey" FOREIGN KEY ("delegadoId") REFERENCES "integrantes_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
