-- CreateIndex
CREATE INDEX "carteles_propiedadId_idx" ON "carteles"("propiedadId");

-- CreateIndex
CREATE INDEX "clientes_estado_idx" ON "clientes"("estado");

-- CreateIndex
CREATE INDEX "clientes_delegadoId_idx" ON "clientes"("delegadoId");

-- CreateIndex
CREATE INDEX "documentos_propiedadId_idx" ON "documentos"("propiedadId");

-- CreateIndex
CREATE INDEX "eventos_agenda_fecha_idx" ON "eventos_agenda"("fecha");

-- CreateIndex
CREATE INDEX "eventos_agenda_clienteId_idx" ON "eventos_agenda"("clienteId");

-- CreateIndex
CREATE INDEX "eventos_agenda_propiedadId_idx" ON "eventos_agenda"("propiedadId");

-- CreateIndex
CREATE INDEX "factura_items_facturaId_idx" ON "factura_items"("facturaId");

-- CreateIndex
CREATE INDEX "incidencias_propiedadId_estado_idx" ON "incidencias"("propiedadId", "estado");

-- CreateIndex
CREATE INDEX "incidencias_proveedorId_idx" ON "incidencias"("proveedorId");

-- CreateIndex
CREATE INDEX "incidencias_estado_fechaApertura_idx" ON "incidencias"("estado", "fechaApertura");

-- CreateIndex
CREATE INDEX "incidencias_estado_fechaEjecucion_idx" ON "incidencias"("estado", "fechaEjecucion");

-- CreateIndex
CREATE INDEX "interesados_venta_ventaId_idx" ON "interesados_venta"("ventaId");

-- CreateIndex
CREATE INDEX "interesados_venta_clienteId_idx" ON "interesados_venta"("clienteId");

-- CreateIndex
CREATE INDEX "liquidacion_items_liquidacionPropiedadId_idx" ON "liquidacion_items"("liquidacionPropiedadId");

-- CreateIndex
CREATE INDEX "liquidacion_propiedades_liquidacionId_idx" ON "liquidacion_propiedades"("liquidacionId");

-- CreateIndex
CREATE INDEX "liquidacion_propiedades_propiedadId_idx" ON "liquidacion_propiedades"("propiedadId");

-- CreateIndex
CREATE INDEX "pagos_proveedor_proveedorId_idx" ON "pagos_proveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "pagos_proveedor_incidencias_incidenciaId_idx" ON "pagos_proveedor_incidencias"("incidenciaId");

-- CreateIndex
CREATE INDEX "propiedades_modalidad_idx" ON "propiedades"("modalidad");

-- CreateIndex
CREATE INDEX "propiedades_propietarioId_modalidad_idx" ON "propiedades"("propietarioId", "modalidad");

-- CreateIndex
CREATE INDEX "propiedades_designadoId_idx" ON "propiedades"("designadoId");

-- CreateIndex
CREATE INDEX "propiedades_contratoFin_idx" ON "propiedades"("contratoFin");

-- CreateIndex
CREATE INDEX "recibo_items_reciboId_idx" ON "recibo_items"("reciboId");

-- CreateIndex
CREATE INDEX "recibos_propiedadId_idx" ON "recibos"("propiedadId");

-- CreateIndex
CREATE INDEX "recibos_facturaId_idx" ON "recibos"("facturaId");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");
