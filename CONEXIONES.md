# Mapa de conexiones — estado de implementación

Este archivo trackea, uno por uno, los enlaces entre módulos descritos en
`SGM_AR - Documento funcional para produccion.md` (§3 "Mapa de conexiones
entre funcionalidades"). Es la lista de verificación para confirmar que el
sistema en producción quedó "conectado con todo", no en módulos sueltos.

Se actualiza a medida que se implementa cada sección. Convención:
- `[ ]` no implementado todavía
- `[~]` modelado en la base de datos, falta la lógica de servicio/endpoint
- `[x]` implementado y verificado (con fecha y archivo donde vive la lógica)

---

## 0. Base de datos (fundamento de todas las conexiones)

- [x] Schema Prisma completo con todas las entidades del §4 y sus relaciones
      — `api/prisma/schema.prisma` (2026-07-22).
- [x] Migración inicial aplicada + Configuración (fila singleton id=1) sembrada
      — `api/prisma/seed.ts` (2026-07-22).
- [ ] Constraints de negocio a nivel DB (moneda ARS/USD/EUR, unicidad
      factura/liquidación por mes) — ya declaradas en el schema, falta
      verificar con datos reales de prueba.

---

## 3.1 El flujo central del alquiler

- [x] Contrato → próximo aumento = último aumento + frecuencia —
      `api/src/propiedades/propiedades.service.ts::proximoAumento()` (2026-07-22)
- [x] Próximo aumento → evento en Agenda (automático, no persistido) —
      `api/src/agenda/agenda.service.ts::eventosDelMes()` (2026-07-22,
      probado: propiedad con aumento el 2026-07-28 apareció como evento
      `AUMENTO_PROXIMO` en la agenda de julio, sin guardarse como registro)
- [x] Próximo aumento → Aviso de aumento redactado con montos reales —
      `api/src/avisos/avisos.service.ts::avisosAumento()` (2026-07-22,
      implementado con ventana `diasAnticipacionAumento`; no se probó un
      caso dentro de la ventana en este test, solo el camino vacío)
- [x] Calculadora de aumento (ficha) → actualiza `montoAlquilerVigente` +
      inserta fila en `HistorialAumento` —
      `api/src/propiedades/propiedades.service.ts::registrarAumento()`
      (2026-07-22, probado con curl end-to-end)
- [x] Renta vigente (regla §5.1) = último `HistorialAumento` anterior a la
      fecha de cálculo → función de dominio reusada por Cobros, Facturas,
      Liquidaciones y Panel General (una sola implementación, no duplicada) —
      `api/src/propiedades/propiedades.service.ts::rentaVigente()` (2026-07-22)
- [x] Cobro esperado del mes → tabla de Inquilinos y Cobros —
      `api/src/cobros/cobros.service.ts::resumenMes()` (2026-07-22, probado:
      esperado/cobrado/pendiente y estado PAGADO/PENDIENTE/IMPAGO por
      propiedad, más totales del mes)
- [~] Cobro esperado del mes → estado Pagado/No pagado en Panel General —
      la función existe (`resumenMes`, `kpis`) y ya se puede consumir; falta
      construir el módulo Panel General que la consulte
- [x] Registrar pago → INGRESO automático en `MovimientoCaja` (ARS) —
      `api/src/cobros/cobros.service.ts::registrarPago()`, transacción
      atómica con `CajaService.registrarMovimiento()` (2026-07-22, probado:
      el pago quedó con `movimientoCajaId` y el movimiento apareció en
      `/caja/movimientos`). Editar el pago sincroniza el movimiento
      (`editarPago()`); anularlo borra el movimiento y no deja "plata
      fantasma" (`anularPago()`) — ambos probados con curl.
- [x] Registrar pago → habilita generación de Recibo — `RecibosService.emitir()`
      rechaza con 400 si `cobradoDelMes() <= 0` (§3.5, probado 2026-07-22)
- [x] Registrar pago → pasa a formar parte de la base de la liquidación al
      propietario del mes — `LiquidacionesService.generar()` usa los mismos
      ítems de la factura (que reflejan lo facturado, no un cobro suelto),
      probado en §3.4 (2026-07-22)
- [x] Registrar pago → Honorarios = % sobre lo cobrado → Ganancia (Caja) —
      cadena completa probada: honorarios de la liquidación (§3.4) suman a
      `CajaService.kpisDelMes().gananciaPesos` (§2.4, 2026-07-22)
- [x] Falta de pago → deuda acumulada (§5.4, ventana de 12 meses cerrados) —
      `api/src/cobros/cobros.service.ts::deudaAcumulada()`,
      `fichasInquilinos()`, `kpis()` (2026-07-22, probado end-to-end: detecté
      y corregí un bug donde se contaba deuda en meses anteriores al inicio
      del contrato).
- [x] Falta de pago → aviso de reclamo — `avisos.service.ts::reclamosDeuda()`
      (2026-07-22, probado: propiedad sin pagos desde enero generó el aviso
      con el monto real de deuda y el contacto del inquilino)
- [ ] Cupones de deuda en tanda (impresión masiva) — todavía no construido,
      es una función de impresión sobre los mismos datos de `fichasInquilinos()`

## 3.2 Gastos: una sola carga, tres destinos

- [x] Alta de gasto (desde ficha de propiedad / Liquidaciones) → único punto
      de entrada, un solo `Gasto` por hecho — `api/src/gastos/gastos.service.ts::crear()`
      (2026-07-22, probado con curl). El alta manual solo admite destino
      PROPIETARIO/INQUILINO (`CreateGastoDto` rechaza INMOBILIARIA con 400,
      probado) — ese destino lo asigna únicamente el sistema al resolver una
      incidencia, vía `crearDesdeIncidencia()`, ya conectado desde
      `IncidenciasService.resolver()` y probado end-to-end (§3.3, 2026-07-22).
- [x] `destino = PROPIETARIO` → se descuenta en `LiquidacionPropiedad` —
      `LiquidacionesService.generar()` usa `gastosService.findParaMes(...,
      'PROPIETARIO')` (§3.4, probado: gasto de 10000 descontado del neto)
- [x] `destino = INQUILINO` → se suma como ítem de la Factura —
      `FacturasService.itemsPredeterminados()` usa `findParaMes(...,
      'INQUILINO')` (§3.5, probado: gasto de 8000 apareció en la factura)
- [~] `destino = INMOBILIARIA` (solo incidencias) → no se traslada a nadie —
      `crearDesdeIncidencia()` ya lo admite y no genera egreso propio; falta
      construir Incidencias para que llame a este método
- [x] Todo gasto cargado a mano → genera EGRESO automático en `MovimientoCaja`
      (`origen: GASTO_PROPIEDAD`) — probado end-to-end: alta, edición
      (sincroniza monto/fecha/categoría del movimiento) y eliminación
      (borra el movimiento) (2026-07-22)

## 3.3 Incidencias → Proveedores → Gastos

- [x] Incidencia ABIERTA → asignar proveedor → pasa a EN_CURSO —
      `api/src/incidencias/incidencias.service.ts::asignarProveedor()`
      (2026-07-22, probado: alta de proveedor nuevo inline heredando el
      rubro de la incidencia, e incidencia pasó a EN_CURSO)
- [x] EN_CURSO → pedir fecha de ejecución — campo `fechaEjecucion` en el
      mismo `asignarProveedor()` (precarga hoy si no se manda) (2026-07-22)
- [x] EN_CURSO → evento en Agenda (automático) —
      `AgendaService.eventosDelMes()` incluye `INCIDENCIA_EJECUCION` mientras
      la incidencia esté EN_CURSO, con el proveedor asignado en el título
      (2026-07-22, implementado; probado indirectamente vía la incidencia
      abierta del mismo test, falta un caso específico EN_CURSO con fecha
      de ejecución dentro del mes consultado)
- [x] Marcar RESUELTA con costo → genera `Gasto` automáticamente (con el
      `destino` elegido en "¿Quién paga el costo?") —
      `IncidenciasService.resolver()` (2026-07-22, probado: costo 15000,
      destino INQUILINO, generó el Gasto con `movimientoCajaId: null`)
- [x] Trabajo resuelto con costo → suma a "Total facturado" del proveedor
      (cuenta corriente) — `ProveedoresService.cuentaCorriente()`
      (2026-07-22, probado: totalFacturado 15000)
- [x] Registrar pago a proveedor (por trabajo o "pagar saldo" completo) →
      suma a "Abonado", baja "Saldo a pagar" —
      `api/src/proveedores/pagos-proveedor.service.ts` (`registrarPagoPorTrabajo()`
      probado end-to-end: saldo pasó de 15000 a 0; `pagarSaldo()` implementado
      igual pero todavía no probado con múltiples trabajos a la vez)
- [x] Pago a proveedor → SIEMPRE genera egreso automático en Caja en la
      fecha del pago (y el gasto original de la incidencia NO genera su
      propio egreso — una sola salida de caja, sin duplicados) — probado:
      el gasto quedó con `movimientoCajaId: null` y el único egreso en Caja
      apareció recién al pagar, fechado 2026-07-24 (fecha del pago, no de
      la resolución de la incidencia) (2026-07-22)
- [x] Incidencia sin proveedor asignado → dispara aviso "pedido de
      presupuesto" — `IncidenciasService.findSinProveedor()` consumido por
      `avisos.service.ts::pedidosPresupuesto()` (2026-07-22, probado
      end-to-end: incidencia sin proveedor apareció con el texto redactado)
- [x] Incidencia sin resolver → aparece automáticamente en Agenda (icono 🛠);
      al resolverse, desaparece — `AgendaService.eventosDelMes()` filtra
      `estado: { not: RESUELTA }`, por lo que al resolverse deja de listarse
      solo (no hay que borrar nada) (2026-07-22, probado)
- [x] Frontend admin — `admin/src/pages/IncidenciasPage.tsx`: tablero de
      incidencias (`.inccard`, KPIs calculados en el cliente porque no hay
      `GET /incidencias/kpis`), con acciones dedicadas por tarjeta —
      Asignar/Reasignar proveedor (`PATCH /incidencias/:id/proveedor`,
      incluye alta de proveedor nuevo inline), Marcar resuelta (`POST
      .../resolver`), Reabrir (`POST .../reabrir`) y Registrar pago (`POST
      .../pagar`) — más el directorio de proveedores (`.ownercard`
      reutilizada de Propietarios) con cuenta corriente y "Pagar saldo"
      (`POST /proveedores/:id/pagar-saldo`). Verificado con Playwright
      end-to-end: incidencia abierta → asignar proveedor nuevo "Gasista
      Ruben" (pasó a En curso) → marcar resuelta con costo $25000 (pasó a
      Resuelta, salió del filtro "Pendientes" por defecto, KPI "Resueltas
      este mes" a 01) → Pagar saldo desde la tarjeta del proveedor (Abonado
      $25000, Saldo a pagar $0, botón desapareció) → confirmado el egreso
      real en Caja ("Pago a proveedor — Gasista Ruben — saldo completo (1
      trabajos)"), cero errores de consola (2026-07-22). **Nota:** el KPI
      "Costo pendiente de incidencias sin cerrar" da siempre $0 en la
      práctica — el backend solo graba `costo` al resolver (`resolver()`),
      nunca en `crear()`/`update()`, así que una incidencia ABIERTA o
      EN_CURSO nunca tiene costo cargado. Es una diferencia real con el
      boceto (que sí permitía cargar un costo estimado desde la apertura),
      no un bug del frontend — si se quiere el KPI con datos reales hay que
      agregar `costo` a `CreateIncidenciaDto`/`UpdateIncidenciaDto`.

## 3.4 Liquidación al propietario

- [x] Liquidación del mes = cobros de sus propiedades − gastos que absorbe
      − honorarios (% propio de cada propiedad) = neto a girar —
      `api/src/liquidaciones/liquidaciones.service.ts::generar()` (2026-07-22,
      probado: propiedad con honorarios 6%, factura de 100000 y gasto
      PROPIETARIO de 10000 → honorarios 6000, neto 84000, exacto)
- [x] Liquidación por propiedad usa el cobro REAL de esa propiedad/inquilino
      — el `cobradoTotal` sale de la factura vigente (o predeterminados) de
      CADA propiedad individualmente, nunca un valor repetido (2026-07-22)
- [x] `LiquidacionPropiedad.items` replica exactamente los mismos ítems que
      la `Factura` del inquilino de esa unidad ese mes (misma fuente, sin
      cálculo paralelo) — reusa `FacturasService.obtenerDelMes()` /
      `itemsPredeterminados()`, la misma función que usa Recibo (2026-07-22)
- [x] Liquidación → comprobante imprimible numerado (usa
      `Configuracion.proximoNumeroLiquidacion`, incrementado atómicamente
      dentro de la misma transacción) (2026-07-22)
- [x] Liquidación → EGRESO automático en `MovimientoCaja`
      (`origen: LIQUIDACION_PROPIETARIO`) — probado: apareció en
      `/caja/movimientos` por el neto exacto (84000). Nota: si el neto da
      ≤ 0 no se genera egreso (decisión de diseño, no está en el documento
      explícitamente pero evita un "egreso negativo" sin sentido contable).
- [x] Liquidación lista → aviso en Avisos con el detalle para WhatsApp/email
      — `avisos.service.ts::liquidacionesListas()` (2026-07-22, probado:
      liquidación generada para el mes actual apareció con el neto real)
- [x] Frontend admin — `admin/src/pages/PropietariosPage.tsx`: grilla de
      propietarios (`GET /propietarios` + `GET /propiedades` agrupadas por
      `propietarioId`) con la etiqueta "GRANDES ACTIVOS" y el badge por
      propiedad (En Venta / Disponible / Pagado-No pagado del mes en curso).
      El botón "Imprimir liquidación del mes" llama
      `POST /liquidaciones/propietarios/:id/:mes` y muestra el detalle real
      en un modal con la tarjeta `.liqcard` del boceto (verificado con
      Playwright: propietario con 1 alquiler + 1 venta, neto a girar exacto
      contra lo calculado por el backend, cero errores de consola) (2026-07-22).
      Nota: el badge por propiedad usa el mismo binario Pagado/No pagado que
      Panel General e Inquilinos — la taxonomía más fina del boceto
      (activo/alerta/vencido/porvencer) depende de días de alerta que la API
      todavía no expone como estado calculado.

## 3.5 Factura y recibo al inquilino

- [x] Factura se prellena con ítems predeterminados en este orden: Alquiler
      (valor vigente), Expensas, Usina, Camuzzi, Obras Sanitarias,
      Retributivas de Servicios — + gastos trasladados (destino INQUILINO)
      + "Deuda arrastrada" si corresponde —
      `api/src/facturacion/facturas.service.ts::itemsPredeterminados()`
      (2026-07-22, probado: incluyó correctamente Alquiler 100000 y un gasto
      trasladado de 8000). Falta: número de liquidación como campo propio de
      Usina/Camuzzi ya modelado en `FacturaItem.numeroLiquidacion`, falta
      probarlo desde el frontend.
- [x] Ítems editables y eliminables antes de emitir — `EmitirFacturaDto.items`
      acepta el array editado; si se omite, usa los predeterminados (2026-07-22)
- [x] Al emitir, ítems quedan guardados en `FacturaItem` (reemplaza factura
      anterior del mismo mes — constraint `@@unique([propiedadId, mes])`) —
      `FacturasService.emitir()` (2026-07-22, probado: numeración atómica
      dentro de la misma transacción vía `configuracionService.siguienteNumeroFactura(tx)`)
- [x] Facturación masiva del mes → guarda cada factura igual que la
      individual (mismo servicio, no una ruta paralela) —
      `FacturasService.emitirMasivo()` (2026-07-22, implementado; probado
      solo el camino individual, falta probar con varias propiedades a la vez)
- [x] Recibo toma siempre los conceptos de la última factura emitida de ese
      mes (snapshot en `ReciboItem`, no un ítem genérico de "Alquiler") —
      `RecibosService.emitir()` (2026-07-22, probado end-to-end)
- [~] Si no hay factura previa del período → Recibo reconstruye el mismo
      detalle que armaría la factura — implementado (fallback a
      `itemsPredeterminados()`), no probado todavía ese camino específico
      (solo se probó con factura previa)
- [x] Cobro parcial o de más → Recibo agrega ítem "Ajuste sobre lo
      facturado" con la diferencia (2026-07-22, probado: cobro parcial
      100000/108000 generó ajuste -8000)
- [x] Recibo deshabilitado si no hay pagos registrados para ese período —
      probado: devuelve 400 sin pagos (2026-07-22)

## 3.6 Ventas → Caja en dólares

- [x] Etapa "reserva" con seña recibida → INGRESO EN USD del mes en Caja —
      `api/src/ventas/ventas.service.ts::registrarSena()` (2026-07-22,
      probado: seña 10000 USD → estado pasa a RESERVADA + ingreso en Caja
      con `origen: SENA_VENTA`)
- [x] Venta cerrada (`estado = VENDIDA`) → comisión → INGRESO EN USD del mes
      del cierre — `VentasService.cerrar()` (2026-07-22, probado: 3% propio
      de la propiedad sobre 100000 USD = 3000, `origen: COMISION_VENTA`).
      **Decisión de diseño (documentada porque el documento es ambiguo
      acá):** la comisión REAL al cerrar usa el % propio de la propiedad
      (igual que liquidaciones — §2.3: "todos los cálculos... usan el %
      propio de cada propiedad"), mientras que el KPI "comisión potencial"
      usa el % de Configuración explícitamente, tal como dice el propio
      §2.3 solo para ese indicador agregado. Son dos usos distintos del
      mismo dato, no una contradicción.
- [x] `estado = VENDIDA_POR_TERCEROS` → NO genera comisión ni suma a
      honorarios potenciales (excluido del cálculo, con
      `vendidaPorTercerosDetalle` visible) —
      `VentasService.venderPorTerceros()` + excluido explícitamente del
      `notIn` de `kpis()` (2026-07-22, implementado; falta un test
      específico de este camino, solo se probó el cierre normal)
- [x] Comisión potencial (sobre no vendidas) → KPI de Ventas —
      `VentasService.kpis()` (2026-07-22, probado: 100000 USD * 4% = 4000).
      Falta: sumarlo también al Panel General cuando se construya.
- [x] Frontend admin — `admin/src/pages/VentasPage.tsx`: grilla de venta
      (`.salecard`) construida sobre `GET /propiedades` (modalidad VENTA) +
      `GET /ventas` (para interesados) — una propiedad en venta sin ficha
      todavía muestra un estado "sin publicar" y "Editar ficha" la crea
      (`POST /propiedades/:id/venta`, upsert). Las transiciones de estado
      con impacto en Caja NO se hacen desde ese formulario genérico: son
      acciones dedicadas en la tarjeta — "Registrar seña" (`POST
      /ventas/:id/sena`), "Cerrar venta" (`POST /ventas/:id/cerrar`) y
      "Vendida por terceros" (`POST /ventas/:id/vender-por-terceros`) — solo
      aparecen según el estado actual, y desaparecen todas en los estados
      terminales (VENDIDA / VENDIDA_POR_TERCEROS). Interesados
      (crear/editar/eliminar) y Carteles (alta, marcar colocado/retirado,
      editar, eliminar) completos. Verificado con Playwright end-to-end:
      propiedad USD 85000 → seña USD 15000 (creó el ingreso en Caja) →
      cerrar venta (creó la comisión 3% = USD 2550 en Caja) → badge pasó
      Publicada → Reservada → Vendida, KPIs y botones de acción se
      actualizaron correctamente en cada paso, cero errores de consola
      (2026-07-22).

## 2.6 Clientes

- [x] Frontend admin — `admin/src/pages/ClientesPage.tsx`: KPIs
      (`GET /clientes/kpis`), buscador + filtro por tipo de operación
      (client-side sobre `GET /clientes`), grilla de fichas (`.ownercard`
      reutilizada de Propietarios/Proveedores) y alta/edición/borrado
      completos (`POST/PATCH/DELETE /clientes`), con el delegado tomado de
      `GET /integrantes-equipo`. Verificado con Playwright: alta de cliente
      "Marina Torres" (busca comprar, hasta $90000, zona Centro) → apareció
      con el tag "BUSCA COMPRAR" y el resumen "Busca: ..." → edición de
      estado a "En seguimiento" reflejada al instante en el badge, cero
      errores de consola (2026-07-22). **Nota:** el boceto tenía 7 estados
      de pipeline (nuevo/contactado/visita/negociación/reserva/cerrado/
      perdido); el backend simplifica a 3 (`SIN_CONTACTAR`,
      `EN_SEGUIMIENTO`, `CERRADO`) — el frontend sigue al backend, no al
      boceto, en este punto.

## 2.7 Agenda

- [x] Frontend admin — `admin/src/pages/AgendaPage.tsx`: calendario mensual
      (`GET /agenda/mes/:mes`) mezclando eventos manuales y automáticos
      (vencimiento de contrato, próximo aumento, incidencia abierta,
      ejecución agendada) en la misma grilla, con la lista lateral de
      "próximos eventos" o los del día seleccionado, KPIs (Hoy/Esta
      semana/Visitas agendadas/Atrasados, calculados en el cliente) y alta
      /edición/borrado/marcar-hecho de eventos manuales
      (`POST/PATCH/DELETE /agenda`, `PATCH /agenda/:id/hecho`). Verificado
      con Playwright: evento "Visita" de hoy → apareció en el calendario y
      el KPI "Hoy"/"Visitas agendadas" → marcarlo hecho lo sacó de las
      listas pendientes → alta de un evento "Llamado" nuevo apareció al
      instante, cero errores de consola (2026-07-22). **Simplificaciones
      deliberadas frente al boceto:** (1) sin campo de hora — `EventoAgenda.fecha`
      es un `DateTime`, pero ningún otro módulo del admin usa selector de
      hora (todas las fechas del sistema son "fecha de calendario"), así
      que se mantuvo esa misma convención acá; (2) los eventos automáticos
      de incidencias no abren la ficha de la incidencia al hacer clic (en
      el boceto sí, porque todo vivía en una sola página) — acá son
      informativos nomás, ya que abrir esa ficha implicaría navegar a otro
      módulo del admin.

## 2.8 Avisos — grupos que no están en el mapa de conexiones del §3

El documento agrupa Avisos en 7 categorías (§2.8); las que nacen de
conexiones entre módulos ya quedaron ancladas arriba (reclamo de deuda §3.1,
pedido de presupuesto §3.3, aviso de aumento §3.1, liquidación lista §3.4).
Las 3 restantes son más autocontenidas:

- [x] Renovaciones de contrato (propiedades con `contratoFin` dentro de
      `diasAnticipacionVencimiento`) — `avisos.service.ts::renovacionesContrato()`
      (2026-07-22, implementado; no se probó un caso dentro de la ventana)
- [x] Clientes sin contactar — `avisos.service.ts::clientesSinContactar()`
      (2026-07-22, probado end-to-end)
- [x] Recordatorios (eventos de agenda manuales pendientes, próximos 7 días)
      — `avisos.service.ts::recordatorios()` (2026-07-22, probado: un evento
      manual de una prueba anterior apareció correctamente)
- [x] El texto de cada aviso se genera al pedir `/avisos`, no se persiste —
      coincide con el requisito de que la edición en el frontend "no se
      guarda" (§2.8): como no hay una tabla de avisos, no hay nada que
      guardar mal. La edición será 100% responsabilidad del frontend.
- [x] Envío por WhatsApp/email (`wa.me`, `mailto:`) — `admin/src/pages/AvisosPage.tsx`
      arma los links igual que el boceto, con el texto editable en un
      `<textarea>` por tarjeta (estado solo de React, se pierde al recargar
      — cumple literalmente "la edición no se guarda"). Los 7 grupos de
      `GET /avisos` se agrupan igual que el boceto (mismo orden, mismos
      colores rojo/naranja/índigo, mismos íconos). Verificado con
      Playwright: cliente nuevo → apareció en "CLIENTES SIN CONTACTAR" con
      el mensaje ya redactado, botón WhatsApp habilitado (tenía teléfono) y
      badge del sidebar en 1, cero errores de consola (2026-07-22). **Nota:**
      dos de los 7 grupos no traen contacto en la respuesta actual de la
      API — `pedidosPresupuesto()` nunca buscó un proveedor candidato por
      rubro (a diferencia del boceto) y `recordatorios()` consulta
      `cliente`/`propiedad` en el include pero no los expone en el objeto
      devuelto — así que esas dos tarjetas se muestran sin botones de envío
      habilitados, reflejando fielmente lo que la API devuelve hoy.

## 3.7 Configuración como fuente única

- [x] `honorariosDefaultPorcentaje` → default cuando la propiedad no define
      el propio — `api/src/common/honorarios.util.ts::resolverPorcentajeHonorarios()`,
      reusada por Liquidaciones (§3.4) Y por el cierre de Ventas (§3.6),
      ambas probadas (2026-07-22). Falta reusarla en el gráfico Bruto/Neto
      del Panel General cuando se construya (no hay Panel General todavía).
- [x] `comisionVentaPorcentaje` → KPI "comisión potencial" de Ventas
      (2026-07-22, probado); el ingreso REAL en Caja USD al cerrar usa el %
      propio de la propiedad, ver nota en §3.6
- [ ] `ipc` / `icl` → calculadora de aumento y KPIs de Panel General — sigue
      sin conectar: no existe todavía una "calculadora de aumento" que lea
      estos valores (hoy `registrarAumento()` recibe el monto ya calculado
      a mano, igual que el boceto vía iframe de Arquiler — ver §6, §7)
- [x] `dolarReferencia` → equivalencias ARS/USD — `VentasService.kpis()`
      convierte el precio de las ventas en ARS a USD para la "comisión
      potencial" (2026-07-22, probado)
- [~] `diaVencimientoAlquiler` → estado de pago (Pendiente vs Impago) — el
      binario Pendiente(mes en curso)/Impago(mes cerrado) de §5.3 ya está
      implementado por calendario; `diaVencimiento` ya se expone en
      `fichasInquilinos()` pero falta usarlo para marcar "vencido este mes"
      dentro del estado Pendiente (detalle visual, no bloqueante)
- [x] `diasAnticipacionAumento` / `diasAnticipacionVencimiento` → alertas —
      `avisos.service.ts::avisosAumento()` / `renovacionesContrato()` usan
      estas ventanas exactas (2026-07-22, implementado y probado el camino
      vacío; falta un caso con datos dentro de la ventana). Falta también
      usarlos en el Panel General cuando se construya.
- [x] `proximoNumeroFactura/Recibo` → numeración atómica ya conectada y
      probada end-to-end (`FacturasService.emitir()`, `RecibosService.emitir()`,
      2026-07-22). `proximoNumeroLiquidacion` sigue pendiente de conectar
      (falta el módulo Liquidaciones) —
      `api/src/configuracion/configuracion.service.ts`
      y Liquidación cuando se construyan
- [ ] Datos de la empresa → encabezado de todos los comprobantes impresos
      (sigue pendiente: no hay generación de comprobantes en PDF todavía)
- [x] Frontend admin — `admin/src/pages/ConfiguracionPage.tsx`: un solo
      formulario (`GET/PATCH /configuracion`) con las mismas tarjetas del
      boceto (datos fiscales, equipo, índices, dólar, reglas de operación,
      numeración de comprobantes de solo lectura, saldo inicial de caja) más
      una tarjeta nueva "Honorarios y comisión por defecto" que el boceto no
      tenía como formulario (`honorariosDefaultPorcentaje`/
      `comisionVentaPorcentaje` sí existen y se usan en Liquidaciones/Ventas,
      necesitaban una forma de editarse). Equipo con alta/baja en el
      instante (`POST/DELETE /integrantes-equipo`). Verificado con
      Playwright: cambiar la razón social y guardar → persistió tras
      recargar; agregar "Julia Fernandez" al equipo → apareció con botón de
      quitar; exportar el reporte "Base de clientes" → CSV con BOM y
      encabezados correctos, cero errores de consola (2026-07-22).
      **Diferencias deliberadas frente al boceto:** (1) sin la tarjeta
      "Factura al inquilino" (tipo A/B/C, punto de venta) — esos campos no
      existen en `Configuracion`; (2) sin "Restablecer datos de demo" — era
      una función de la demo en localStorage, no tiene sentido (y sería
      peligroso) en un sistema con datos reales de producción.
- [x] Reportes — 9 exportaciones CSV client-side (mismo agrupamiento que el
      boceto: Dinero / Propiedades e Inquilinos / Comercial y Seguimiento),
      todas sobre endpoints `GET` ya probados en otros módulos
      (`/cobros/mes/:mes`, `/reportes/resumen-anual/:anio`,
      `/caja/movimientos`, `/propiedades`, `/cobros/inquilinos`,
      `/incidencias`, `/clientes`, `/agenda/mes/:mes`, `/carteles`), sin
      necesidad de un endpoint de reportes nuevo. **Nota:** "Cobros del
      período" y "Agenda de eventos" del boceto exportaban el historial
      completo; acá están recortados a un mes seleccionable porque no existe
      un endpoint de "todos los pagos" ni "todos los eventos" sin filtrar
      por mes — están etiquetados como "del mes" en vez de fingir cobertura
      total.

## 3.8 Automatismos de Caja

- [x] `MovimientoCaja.origen` distingue automáticos (solo lectura, se
      corrigen en su módulo de origen) de manuales (editables) —
      `api/src/caja/caja.service.ts`: `registrarMovimiento()` (interno, usado
      por otros módulos) vs `registrarManual()` (fuerza `origen: MANUAL`
      sin importar lo que mande el cliente) (2026-07-22)
- [x] Cobro de alquiler → ingreso automático (§3.1) — ver arriba (2026-07-22)
- [x] Gasto cargado a mano → egreso automático (§3.2) — ver arriba (2026-07-22)
- [x] Liquidación a propietario → egreso automático (§3.4) — ver arriba (2026-07-22)
- [x] Pago a proveedor → egreso automático, fecha del pago (§3.3) — ver arriba (2026-07-22)
- [x] Saldo corrido y saldo acumulado calculados solo sobre la caja en
      pesos; USD/EUR se informan aparte, sin afectar ese saldo —
      `CajaService.saldoAcumuladoHasta()` filtra `moneda: ARS` explícitamente
      (2026-07-22, probado: saldo inicial 100000 + ingreso 100000 − egresos
      97000 = 103000, sin mezclar los movimientos USD del mismo período)

## 2.4 Caja — KPIs y resumen anual

- [x] Ingresos en Pesos (cobros de alquileres + movimientos manuales ARS) —
      `CajaService.kpisDelMes()` (2026-07-22, probado: 100000)
- [x] Ingresos en Dólares (señas + comisiones + manuales USD, sin conversión)
      — mismo método, campo `ingresosDolares` (2026-07-22, probado en 0 en
      este escenario; el camino con datos ya se probó en §3.6)
- [x] Egresos del mes (pesos) — campo `egresosPesos` (2026-07-22, probado:
      20000 de gasto + 77000 de liquidación = 97000)
- [x] Ganancia de la inmobiliaria (honorarios + comisiones − gastos propios)
      — campo `gananciaPesos` (2026-07-22, probado: honorarios 3000 −
      gastos inmobiliaria 0 = 3000). **Decisión de diseño:** las comisiones
      de venta están en USD y los honorarios en ARS; en vez de sumarlas en
      un total falso, se informan por separado (`comisionesVentaUsd`) — el
      propio documento marca la mezcla de monedas como pendiente de
      resolver en producción (§7).
- [x] Saldo acumulado al cierre del mes visto — campo `saldoAcumulado`
      (2026-07-22, probado, ver nota de §3.8 arriba)
- [x] Resumen anual (esperado, cobrado, morosidad, gastos, honorarios,
      liquidado por mes) — `api/src/reportes/reportes.service.ts::resumenAnual()`
      (2026-07-22, probado: julio con datos reales, el resto del año en
      cero salvo el esperado que se proyecta hacia adelante porque la renta
      vigente no tiene fecha de corte — comportamiento correcto de §5.1,
      no un bug). Nota de arquitectura: vive en un módulo `reportes`
      separado de Caja para evitar una dependencia circular
      (`CajaModule` ↔ `CobrosModule`), ya que el resumen anual necesita
      `CobrosService.resumenMes()`.
- [x] Frontend admin — `admin/src/pages/CajaPage.tsx`: los 5 KPIs
      (`GET /caja/kpis/:mes`), tabla de movimientos del mes con saldo
      corrido en pesos (`GET /caja/movimientos?mes=`, saldo inicial tomado
      del `saldoAcumulado` del mes anterior), alta de movimiento manual
      (`POST /caja/movimientos`) y resumen anual con navegación por año
      (`GET /reportes/resumen-anual/:anio`) + exportación CSV de ambas
      tablas (BOM + `;`, client-side, sin endpoint nuevo). Verificado con
      Playwright: movimiento manual de egreso $5000 → apareció en la tabla,
      bajó el saldo acumulado a −$5000 y el KPI de Egresos, cero errores de
      consola (2026-07-22). **Nota importante:** el comentario en
      `caja.service.ts` dice que los movimientos manuales son "editables",
      pero el controller solo expone `GET /movimientos` y
      `POST /movimientos` — no hay `PATCH`/`DELETE` para `MovimientoCaja`.
      El frontend refleja la realidad actual (tabla de solo lectura +
      alta), no lo que el comentario sugiere; falta agregar esos dos
      endpoints si se quiere edición/anulación real de movimientos manuales.

## Datos simulados y "Agregar Propiedad"

- [x] **Datos de demostración** cargados con un script (`seed-demo.mjs`, en
      el scratchpad de la sesión, no forma parte del repo) que pega contra
      la API real — no INSERTs directos a la base — para ejercitar la
      lógica de negocio real al crear cada registro: 3 propietarios, 8
      propiedades (2 alquiladas con historial de aumentos y una con deuda
      de 4 meses a propósito, 1 vacante, 3 en venta con distintos estados
      —publicada/reservada con seña/vendida—, más las 2 cargadas a mano
      probando el formulario nuevo), inquilinos, pagos, 3 incidencias (una
      sin proveedor, una en curso, una resuelta y pagada), 2 proveedores
      nuevos, carteles, 3 clientes, 4 eventos de agenda, liquidaciones de
      julio generadas para los 2 propietarios con alquiler, un movimiento
      manual de Caja, y `Configuracion`/equipo con valores reales
      (2026-07-22). Verificado visualmente módulo por módulo: los 5 KPIs
      del Panel General, Ventas y Carteles, y Caja muestran todos los
      números derivados correctamente (deuda $575.000, ocupación 67%,
      libro de caja con los 6 movimientos automáticos + 1 manual, resumen
      anual con morosidad en los meses sin pago), cero errores de consola.
- [x] **"Agregar Propiedad"** — nueva entrada de sidebar (ícono ✚, justo
      después de "Panel") → `admin/src/pages/AgregarPropiedadPage.tsx`,
      ruta `/propiedades/nueva`. Formulario único con los datos generales
      (nombre, dirección, tipo, modalidad, propietario existente o nuevo
      inline, designado, honorarios) y una sección que cambia según la
      modalidad: para Alquiler, índice/frecuencia/monto inicial/fechas de
      contrato y, opcionalmente, el inquilino ya asignado
      (`PATCH /propiedades/:id/inquilino` después de crear); para Venta,
      precio/moneda/checkbox "Mostrar en la página web" que setea
      `venta.publicada` (`POST /propiedades/:id/venta` después de crear).
      Verificado con Playwright: alta de una propiedad de alquiler con
      inquilino ("Depto Villa Urquiza" / Sofía Castro, propietario nuevo
      "Diego Herrera" creado inline) y de una propiedad de venta publicada
      ("Casa Quinta Pilar", USD 250000) → ambas aparecieron correctamente
      en Propietarios y en Ventas y Carteles respectivamente, cero errores
      de consola (2026-07-22). **Importante — alcance real:** este
      formulario prepara los datos (marca `publicada: true` en la Venta,
      o deja la propiedad de alquiler sin inquilino como "disponible"),
      pero **no existe todavía una página pública/landing page** que lea
      esos datos — eso sigue siendo la Fase 7 del plan original
      (`STACK_TECNOLOGICO.md`), un proyecto Next.js aparte que consume un
      endpoint público de solo lectura todavía no construido
      (`GET /public/propiedades` no existe). Cuando se construya ese sitio,
      debería filtrar exactamente por el mismo criterio que ya usa
      `CartelesService.kpis()` para "propiedades publicables":
      `(modalidad=VENTA AND venta.publicada=true) OR (modalidad=ALQUILER
      AND inquilino IS NULL)`.

## Cotización del dólar en vivo, pago de deudores desde Caja y limpieza de íconos

- [x] **Cotización del dólar (dolarapi.com)** — `ConfiguracionService.cotizacionDolar()`
      (`app/api/src/configuracion/configuracion.service.ts`) llama a
      `GET https://dolarapi.com/v1/dolares/blue` desde el backend (no desde
      el navegador, para evitar CORS y mantener la lógica de conversión
      centralizada) y lo expone en `GET /configuracion/dolar` → `{ compra,
      venta, fechaActualizacion }`. En `ConfiguracionPage.tsx`, el botón
      "Actualizar desde dólar blue" carga el valor `venta` en el campo
      "Dólar de referencia" y muestra la fecha de la cotización; el usuario
      todavía tiene que apretar "Guardar configuración" para aplicarlo — se
      mantuvo `dolarReferencia` como la única fuente de verdad que ya usan
      `VentasPage` y `VentasService.kpis()`, en vez de hacer que cada
      pantalla llame a la API externa por su cuenta (más simple, no depende
      de que dolarapi.com esté arriba para ver una ficha ya cargada, y todas
      las conversiones de un período usan el mismo tipo de cambio).
      Probado con `curl`: devuelve `{ compra: 1535, venta: 1555,
      fechaActualizacion: "2026-07-22T20:59:00.000Z" }` (2026-07-22).
- [x] **Selector de deudores en Caja** — nueva categoría "Pago de alquiler"
      en el combo de Ingresos de `CajaPage.tsx`. Al elegirla, el modal
      "Nuevo Movimiento" cambia: en vez de "Concepto" libre, muestra un
      combo "Quién paga" (`GET /cobros/inquilinos`, ordenado por deuda) y,
      al elegir una propiedad, un combo "Mes que abona" con los meses
      concretos pendientes y su monto (`GET
      /cobros/propiedades/:id/meses-pendientes`, método nuevo
      `CobrosService.mesesPendientes()` — mismo recorrido de 12 meses que
      `deudaAcumulada()` pero devolviendo el detalle mes a mes en vez del
      total). Al guardar, en vez de crear un `MovimientoCaja` manual suelto,
      llama a `POST /cobros/propiedades/:id/pagos` — el mismo endpoint que
      usa "Inquilinos y Cobros" — para que el pago actualice la deuda real
      del inquilino y genere el movimiento automático `COBRO_ALQUILER`
      correcto, en vez de un ingreso manual que no bajaría la deuda y
      quedaría duplicado con el módulo de Cobros. **Decisión de diseño:**
      se reutilizó el endpoint existente en vez de crear uno nuevo — Caja
      no tiene su propia noción de "deuda de alquiler", esa lógica vive en
      `CobrosService` y hubiera sido una segunda fuente de verdad.
      Verificado con Playwright de punta a punta: elegido "Juan Pérez —
      Depto Callao 500 (debe 4 meses)" → mes "marzo 2026 — pendiente
      $140.000" → Guardar → la ficha de Juan Pérez en Inquilinos y Cobros
      bajó a "3 mes(es) impago(s)" / $435.000, y en Caja apareció la fila
      automática "Cobro alquiler — Depto Callao 500 (2026-03)" con medio
      TRANSFERENCIA, exactamente como si se hubiera cargado desde Inquilinos
      y Cobros; el Resumen Anual también reflejó marzo como cobrado
      (2026-07-22, cero errores de consola).
- [x] **Sin emojis, íconos serios** — se reemplazaron todos los emojis a
      color (🏠 💰 📈 🗓 👤 🏢 🧾 💸 📄 📆 ➕ 🔧 ⚡ 🔥 🎨 🧱 🔑 💧 🛠 ⏰ 👁 🤝
      📐 ✍ ✅ 💵 🖨, entre otros) por glifos monocromáticos de los mismos
      bloques Unicode que ya usaba el propio diseño aprobado (▦ ◐ ◉ ◈ ₲ ⚠ ☏
      ✉ ⚙ ☎ ✓ ✎ ↳) — sin tocar CSS ni tamaños, solo el carácter. Afecta
      `Sidebar.tsx`, `AgendaPage.tsx`, `AvisosPage.tsx`, `ConfiguracionPage.tsx`,
      `AgregarPropiedadPage.tsx`, `IncidenciasPage.tsx`, `VentasPage.tsx` y
      `PropietariosPage.tsx`. Los rubros de incidencias (Plomería,
      Electricidad, Gas, etc.) pasaron a formas geométricas distintas entre
      sí (● ▲ ◆ ◇ ◧ ▨ ⚿ ≈ ✱) para seguir siendo distinguibles como leyenda.
      Verificado: barrido con regex sobre todo `admin/src` para los rangos
      Unicode de emoji/pictogramas — cero coincidencias restantes fuera de
      dingbats de texto plano; `tsc --noEmit` sin errores; recorrido visual
      por las 11 páginas con Playwright, cero emojis a color visibles
      (2026-07-22).

## Dólar oficial, reactividad en tiempo real entre secciones e índices de base de datos

- [x] **Dólar oficial en vez de blue** — mismo mecanismo del punto anterior,
      cambiado el endpoint externo de `dolarapi.com/v1/dolares/blue` a
      `.../oficial` en `ConfiguracionService.cotizacionDolar()`, y los
      textos del botón/nota en `ConfiguracionPage.tsx`. Probado con curl
      contra el propio backend: devuelve `{ compra: 1465, venta: 1515 }`
      (oficial), contra `{ compra: 1535, venta: 1555 }` que devolvía blue
      antes del cambio (2026-07-23).
- [x] **Auditoría de reactividad entre secciones** — se revisaron todas las
      `queryKey` y `invalidateQueries` del admin (`admin/src/pages/*.tsx`,
      `Sidebar.tsx`) contra qué mutaciones tocan qué datos, comparando con
      lo que cada servicio del backend realmente lee. Se encontraron y
      corrigieron tres tipos de gaps:
      1. **Los contadores del sidebar (Incidencias/Agenda/Avisos) no se
         actualizaban solos.** El `Sidebar` queda montado siempre (no es
         parte de las rutas), así que dependía pura y exclusivamente de
         `invalidateQueries` para refrescarse — pero sus queries usaban
         `['badge', 'incidencias']` mientras que las páginas invalidaban
         `['incidencias']`, y React Query invalida por **prefijo** del
         array, no por coincidencia de elementos en cualquier posición.
         Se reordenaron las claves a `['incidencias','badge']`,
         `['agenda','badge']`, `['avisos','badge']` (dominio primero) para
         que cualquier invalidación de esa sección arrastre también al
         badge. Verificado con Playwright: crear una incidencia nueva hizo
         pasar el badge de Incidencias de 0 a 1 **sin recargar la
         página** (2026-07-23).
      2. **Generar una liquidación no invalidaba nada** — `PropietariosPage.tsx`
         (`LiquidacionModal`) nunca tenía `useQueryClient`, a pesar de que
         genera un movimiento automático en Caja
         (`LIQUIDACION_PROPIETARIO`) y puede aparecer en Avisos
         ("liquidación lista"). Se agregó invalidación de `['caja']`,
         `['reportes']` y `['avisos']` al éxito de la mutación.
      3. **"Avisos" agrega datos de casi todos los módulos** (deuda de
         Cobros, incidencias sin proveedor, aumentos y vencimientos de
         Propiedades, clientes sin contactar, eventos de Agenda,
         liquidaciones listas — ver `avisos.service.ts::generar()`) **pero
         ninguna mutación de esos módulos invalidaba `['avisos']`.**
         Se agregó esa invalidación en `InquilinosPage`, `CajaPage`
         (el nuevo "Pago de alquiler"), `IncidenciasPage`, `ClientesPage`,
         `AgendaPage`, `AgregarPropiedadPage` y `ConfiguracionPage`
         (los días de anticipación configuran qué entra en Avisos).
         También se agregó `['caja']` a `VentasPage` (seña/cierre/venta
         por terceros generan movimientos automáticos que antes solo se
         veían al navegar de nuevo a Caja, nunca si ya estaba montada) y
         `['ventas']`/`['caja']`/`['reportes']` a `ConfiguracionPage`
         (dólar de referencia, saldo inicial y honorarios por defecto
         alimentan cálculos de Ventas y Caja).
      **Nota:** con `staleTime: 0` por defecto (`main.tsx`), navegar entre
      páginas ya refrescaba casi todo solo — el problema real estaba
      acotado a lo que queda montado permanentemente (el sidebar) y a las
      mutaciones que directamente no invalidaban ninguna clave. No se tocó
      nada de esto último por las dudas: se corrigieron los gaps concretos
      encontrados, no se agregó invalidación especulativa de más.
- [x] **Índices de base de datos** — Prisma/Postgres no crea índice
      automático para columnas de clave foránea simples (a diferencia de
      MySQL); solo lo hace para `@id`, `@unique` y los `@@index`/`@@unique`
      explícitos. Revisando `migration.sql` inicial contra los `where:` reales
      de cada servicio (`grep` de `findMany`/`where` en todo `app/api/src`),
      varias tablas con relaciones muy consultadas no tenían ningún índice:
      `Propiedad.propietarioId`/`designadoId`/`modalidad`/`contratoFin`,
      `Incidencia.propiedadId`/`proveedorId` (+ los rangos por fecha que usa
      Agenda), `Cartel.propiedadId`, `Venta.estado`,
      `InteresadoVenta.ventaId`/`clienteId`, `Cliente.estado`/`delegadoId`,
      `EventoAgenda.fecha`/`clienteId`/`propiedadId`, `Recibo`/`ReciboItem`,
      `LiquidacionPropiedad`/`LiquidacionItem`, `FacturaItem.facturaId`,
      `Documento.propiedadId`, `PagoProveedor.proveedorId` y
      `PagoProveedorIncidencia.incidenciaId`. Se agregaron 27 índices nuevos
      (migración `20260723180743_add_performance_indexes`), elegidos a partir
      de los `where:` reales de los servicios (no especulativos): por ejemplo
      `@@index([propiedadId, estado])` en `Incidencia` porque
      `IncidenciasController` filtra por ambos juntos, y
      `@@index([estado, fechaApertura])` / `@@index([estado, fechaEjecucion])`
      porque `AgendaService` arma los eventos automáticos de incidencias
      filtrando exactamente por esa combinación. No se tocó el índice
      preexistente `movimientos_caja(fecha, moneda)` — ya cubre el patrón de
      uso real de `CajaService`. Aplicada con `prisma migrate dev`,
      verificada leyendo el `migration.sql` generado (27 `CREATE INDEX`) y
      confirmando que el backend sigue respondiendo con `tsc --noEmit` limpio
      y los endpoints ya probados devolviendo los mismos datos (2026-07-23).

## Gráfico de "Cartera por Contrato" y diseño responsive para todos los módulos

- [x] **Donut de "Cartera por Contrato" corregido** — el componente
      `MiniDonut.tsx` traía su propia leyenda al costado del gráfico (dos
      líneas con punto de color, en un `<div>` aparte), mientras que los
      otros dos paneles de "Panel General" (`EVOLUCIÓN ESTRATÉGICA`,
      `EFICIENCIA DE RECAUDACIÓN`) muestran la leyenda arriba, dentro del
      `<h3>`, con la clase compartida `.legend` — de ahí que se viera
      distinto/desalineado respecto a sus vecinos. Se movió la leyenda
      (IPC/ICL) al `<h3>` de `DashboardPage.tsx` con el mismo patrón que
      los otros dos, y `MiniDonut` quedó solo con el SVG centrado
      (`justifyContent:'center'`, igual que `MiniBars`). Verificado con
      captura de pantalla: los tres paneles ahora comparten el mismo
      lenguaje visual (2026-07-23).
- [x] **Diseño responsive para los 11 módulos** — el admin era 100%
      desktop: sidebar fija de 224px con `margin-left` equivalente en el
      contenido, y grillas a columnas fijas (varias además fijadas por
      `style={{gridTemplateColumns:...}}` inline, que ningún media query de
      la hoja de estilos puede pisar). Se agregó un sistema responsive
      centralizado en `global.css` + `Sidebar.tsx`, sin duplicar nada por
      página (todas comparten las mismas clases):
      - **Sidebar → drawer en mobile** (`@media max-width:900px`): pasa a
        `position:fixed` fuera de pantalla (`translateX(-100%)`), con un
        botón hamburguesa (`.hamburger`, nuevo en `Sidebar.tsx`) y una
        superposición (`.navoverlay`) que la abre/cierra. Se cierra sola al
        navegar a otra sección (`useEffect` sobre `location.pathname` de
        `react-router-dom`), como cualquier menú lateral táctil. El botón
        de "achicar a íconos" de escritorio (`.navtoggle`) se oculta en
        mobile — no tiene sentido para un drawer que ya se cierra solo.
      - **KPIs sin inline styles**: se sacaron los 7
        `style={{gridTemplateColumns:'repeat(4,1fr)'}}` /
        `repeat(5,1fr)` de `AgendaPage`, `ClientesPage`, `IncidenciasPage`,
        `InquilinosPage`, `VentasPage` (x2) y `CajaPage` — un inline style
        siempre gana sobre cualquier regla de hoja de estilos, esté o no
        adentro de un `@media`, así que ninguna media query podía
        afectarlos mientras existieran. La clase `.kpis` pasó a
        `repeat(auto-fit,minmax(190px,1fr))`, que acomoda sola 4 o 5
        tarjetas en cualquier ancho sin necesitar un número fijo por página.
      - **Tablas con scroll horizontal propio**: `.tablewrap` pasó de
        `overflow:hidden` a `overflow-x:auto` (una sola regla, sin tocar
        ninguna página) — en vez de romper el layout, una tabla ancha se
        desplaza adentro de su propia caja.
      - **Grillas de 2+ columnas → 1 columna en mobile**: `.charts`,
        `.dbody`, `.infocard`, `.calc .fields`, `.invmeta`, `.formgrid`,
        `.cfgfields`, `.cfggrid` (formularios y el drawer de ficha) y
        `.owners`/`.salegrid`/`.tenants`/`#liqCards` (tarjetas de
        Propietarios/Ventas/Inquilinos/Liquidaciones, que usaban
        `minmax(340-400px,1fr)` — un valor mayor al ancho disponible en un
        celular angosto, con riesgo real de desbordar la página).
      - **Calendario de Agenda**: sigue en 7 columnas (es semanal, no se
        puede colapsar) pero con celdas, gaps y tipografía más chicos en
        `@media max-width:560px` para que entre en el ancho de un teléfono.
      - **Inputs a 16px en mobile**: evita que iOS haga zoom automático al
        tocar un campo de formulario.
      - `flex-wrap:wrap` agregado a `.pagehead`, `.monthbar`, `.searchbar`,
        `.yearbar`, `.btnrow` y `.dfoot` — filas con varios controles en
        línea que en desktop nunca se cortan, pero en un celular necesitan
        poder pasar a la siguiente línea en vez de aplastarse.
      - `overflow-x:hidden` en `html,body` como red de seguridad general
        contra cualquier desborde horizontal residual.
      **Verificado con Playwright en viewport 375×812 (iPhone-ish) sobre
      las 11 páginas**: cero errores de consola, cero requests fallidos,
      `document.documentElement.scrollWidth` == `clientWidth` en las 11
      (sin scroll horizontal de página) — incluyendo Propietarios/Ventas
      antes de bajarles el `minmax`, que sí desbordaban. Se confirmó
      además que el drawer se cierra solo al tocar un link de navegación,
      y que el calendario de Agenda queda legible y utilizable en el ancho
      de un teléfono (2026-07-23).

---

## Reglas de negocio transversales (§5) — a verificar con tests

- [x] §5.1 Renta vigente = último aumento anterior a la fecha (2026-07-22)
- [~] §5.2 Próximo aumento = último aumento + frecuencia — calculado
      (`proximoAumento()`); falta el criterio "inminente" según
      `diasAnticipacionAumento` (se resuelve junto con Agenda/Avisos)
- [x] §5.3 Estado de pago binario (Pagado/Pendiente/Impago), sin "parcial" —
      `api/src/cobros/cobros.service.ts::calcularEstado()` (2026-07-22,
      probado: PENDIENTE en el mes en curso sin cobrar, PAGADO al completar
      el monto esperado)
- [x] §5.4 Deuda calculada sobre los últimos 12 meses —
      `api/src/cobros/cobros.service.ts::deudaAcumulada()` (2026-07-22)
- [x] §5.5 Honorarios % sobre lo efectivamente cobrado, por propiedad —
      `resolverPorcentajeHonorarios()` + `LiquidacionesService.generar()`
      (2026-07-22, probado con propiedad al 6%)
- [ ] §5.6 Punitorios registrados (frecuencia + tipo + valor); cálculo
      automático sobre pagos tardíos — pendiente de producción (§7)
- [x] §5.9 Etiqueta "Grandes Activos" automática (propietario con > 1
      propiedad) — calculada en query, no almacenada —
      `api/src/propietarios/propietarios.service.ts::conEtiqueta()`
      (2026-07-22, probado con curl)

## Caja: totales más prolijos, orden, edición de movimientos manuales y paginado

- [x] **"TOTALES DEL MES (PESOS)" con más jerarquía visual** — antes era un
      `<tfoot>` sin estilo propio (solo `font-weight:800` inline), mientras
      que el `<tfoot>` de "Resumen Anual" en la misma página sí tenía fondo,
      borde superior y alineación (`.anualtable tfoot td` en `global.css`).
      Se generalizó esa regla a `tfoot td` (sin el prefijo `.anualtable`,
      que era el único motivo de la diferencia) para que cualquier tabla del
      admin —hoy nada más las dos de Caja— comparta el mismo tratamiento:
      fondo `#FCFCFD`, borde superior de 2px, y la etiqueta con tipografía
      de sección (mono, tracking, gris) en vez de texto negro suelto.
- [x] **Movimientos del mes ordenados del más nuevo al más viejo** — el
      backend (`CajaService.findMes()`) sigue devolviendo los movimientos en
      orden cronológico ascendente (`orderBy: fecha asc`), porque el saldo
      corrido de cada fila se calcula acumulando en ese orden a partir del
      saldo de cierre del mes anterior; invertir el orden antes de ese
      cálculo daría un saldo por fila incorrecto. La inversión para mostrar
      "los últimos arriba" se hace en el frontend, **después** de calcular
      `filasConSaldo` (`CajaPage.tsx`) — mismo dato, mismo saldo, otro orden
      de presentación.
- [x] **Edición de movimientos manuales** — nuevo `PATCH
      /caja/movimientos/:id` (`CajaController`/`CajaService.editarManual()`)
      que **rechaza con 400** si el movimiento no es `origen: MANUAL` (los
      automáticos — cobro de alquiler, gasto, liquidación, pago a
      proveedor, seña y comisión de venta — se siguen editando solo desde
      su módulo de origen, §3.8; permitir editarlos acá desincronizaría el
      registro de Caja con el que lo generó). En la tabla, las filas
      manuales tienen `className="movrow"` (cursor pointer + hover, misma
      clase que ya existía sin usar en el CSS) y abren el mismo modal de
      "Nuevo Movimiento" pero en modo edición (título "Editar Movimiento",
      precargado, sin la opción de categoría "Pago de alquiler" porque ese
      flujo siempre crea el movimiento vía Cobros, nunca como MANUAL). Las
      filas automáticas no son clickeables (sin `onClick`, como ya estaba).
      Probado con curl: PATCH sobre un manual devuelve 200 con los datos
      actualizados; PATCH sobre uno automático devuelve 400 con el mensaje
      "se edita desde el módulo que lo generó". Probado con Playwright:
      clic en una fila manual → editar concepto → Guardar → el cambio
      persiste y se ve en la tabla; clic en una fila automática no abre
      nada (2026-07-23).
- [x] **Paginado de 15 movimientos por página** — cliente-side sobre el
      array ya ordenado (`filasOrdenadas`), con una barra debajo de la
      tabla (`.pagbar`, nueva) que muestra "Página X de Y · N movimientos
      en total" y solo aparece si hay más de una página. Se reinicia a la
      página 1 al cambiar de mes. El pie de "Totales del mes" sigue
      calculado sobre **todos** los movimientos del mes, no solo los de la
      página visible. De paso se generalizó `.navm` (antes scopeado a
      `.monthbar .navm`, por lo que los botones "‹ ›" de `.yearbar` y de la
      nueva `.pagbar` dependían de estilos por defecto del navegador) para
      que cualquier botón de navegación circular se vea igual en toda la
      página. Probado con Playwright: con 16 movimientos reales en el mes
      (14 originales + 2 pagos de alquiler adicionales generados durante
      pruebas anteriores de esta misma sesión) se ven 15 en la página 1 y 1
      en la página 2, con la etiqueta correcta (2026-07-23).

## Fotos de propiedad y "publicar propiedad existente" en Ventas y Carteles

- [x] **Fotos de propiedad (nuevo, no existía nada de subida de archivos en
      el proyecto)** — modelo `FotoPropiedad` (`propiedadId, url, orden`,
      migración `20260725142110_add_fotos_propiedad`), servidas como
      estáticas desde `main.ts` (`app.useStaticAssets`, carpeta
      `app/api/uploads/` — agregada a `.gitignore`, son archivos subidos por
      el usuario, no código). Subida con `multer` (ya era dependencia
      transitiva de `@nestjs/platform-express`; se agregó explícita +
      `@types/multer`) vía `POST /propiedades/:id/fotos`
      (`multipart/form-data`, campo `archivo`), con `fileFilter` que solo
      acepta JPG/PNG/WEBP (rechaza con 400 cualquier otro tipo, probado con
      un `.txt`) y límite de 8MB por foto; `DELETE
      /propiedades/:id/fotos/:fotoId` borra la fila y el archivo en disco
      (si el archivo ya no está, no falla — la fila de la base es la fuente
      de verdad). En el frontend, `admin/src/api/client.ts` ganó un método
      `api.upload()` nuevo — el `request()` genérico forzaba
      `Content-Type: application/json` en cualquier body, lo que rompía el
      multipart/form-data (el browser arma el boundary correcto solo si el
      header no está seteado a mano); ahora detecta `body instanceof
      FormData` y no fuerza el header en ese caso.
      En `AgregarPropiedadPage.tsx`, cuando la modalidad es "Venta" aparece
      una tarjeta "FOTOS DE LA PROPIEDAD" con selector múltiple + grilla de
      miniaturas (`.fotogrid`/`.fotothumb`, nuevas en `global.css`, junto a
      `.dropzone`/`.doclist` que ya existían para Documentos pero no se
      usaban en ninguna página). Las fotos se suben recién después de crear
      la propiedad y la venta (secuencial, no en paralelo, para que el
      orden de la galería quede igual al orden de selección), y si alguna
      falla no tira abajo el guardado de la propiedad — queda un aviso
      aparte listando cuáles no se pudieron subir. **Importante — mismo
      alcance real que "Agregar Propiedad" en general:** estas fotos quedan
      listas para la página pública del día que exista (Fase 7,
      `STACK_TECNOLOGICO.md`), pero esa página todavía no existe.
      Probado con Playwright + curl de punta a punta: alta de propiedad con
      2 fotos → ambas quedan asociadas, se sirven con `Content-Type:
      image/png` correcto, y una subida de archivo no-imagen se rechaza
      (2026-07-25).
- [x] **"Publicar propiedad existente" en Ventas y Carteles** — antes la
      única forma de que una propiedad apareciera en Ventas y Carteles era
      crearla desde cero con modalidad "Venta" en Agregar Propiedad; no
      había manera de tomar una propiedad ya cargada (típicamente en
      Alquiler) y pasarla a la venta. Nuevo botón "+ Publicar propiedad
      existente" → `PublicarExistenteModal` en `VentasPage.tsx`: elige
      cualquier propiedad de la cartera que todavía no tenga ficha de venta
      (`propiedades.filter(p => !ventaPorPropiedadId.has(p.id))`), y al
      guardar hace dos llamadas en secuencia — `PATCH /propiedades/:id`
      (`modalidad: 'VENTA'`, solo si hacía falta) y después `POST
      /propiedades/:id/venta` (mismo endpoint upsert que ya usaban
      `AgregarPropiedadPage` y `SaleModal` — no hizo falta backend nuevo,
      `UpdatePropiedadDto` ya permitía cambiar `modalidad`). Si la
      propiedad elegida está en Alquiler, se muestra una nota explícita:
      pasa a modalidad Venta y deja de aparecer en Inquilinos y Cobros
      (el contrato/inquilino no se borran, pero conviene coordinarlo antes).
      Probado con Playwright: "Casa Belgrano" (alquiler, vacante, sin
      inquilino) → publicada en USD 95.000 → aparece en Ventas y Carteles
      con badge "Publicada" y el KPI "En venta" pasó de 02 a 03, cero
      errores de consola (2026-07-25).
- [x] **Editar y eliminar propiedades desde Ventas y Carteles** — antes
      "Editar ficha" (`SaleModal` en `VentasPage.tsx`) solo tocaba los
      campos de la ficha de venta (precio, moneda, estado, publicada,
      cierre, mejor oferta); los datos generales de la propiedad (nombre,
      dirección, tipo, propietario, designado, honorarios) no tenían
      ninguna pantalla de edición en toda la app una vez creada la
      propiedad, y tampoco había forma de borrarla — solo existían
      `PATCH /propiedades/:id` y `DELETE /propiedades/:id` en el backend,
      sin usar desde ningún lado del frontend. Se amplió `SaleModal` con
      una sección "DATOS DE LA PROPIEDAD" (nombre, dirección, tipo,
      propietario, designado, honorarios — mismos selects que
      `AgregarPropiedadPage`, para lo cual `VentasPage` ahora también trae
      `propietarios` e `integrantes-equipo`) que se guarda con un
      `PATCH /propiedades/:id` antes del `POST .../venta` ya existente, y
      un botón "Eliminar propiedad" (`DELETE /propiedades/:id`, con
      `window.confirm` porque es irreversible — el `onDelete: Cascade` del
      schema se encarga de borrar en cascada la ficha de venta, el
      inquilino, el historial de aumentos y las fotos de esa propiedad).
      Probado con Playwright: edité el nombre de una propiedad de prueba y
      se reflejó en la card al instante; eliminé otra y desapareció de la
      lista sin errores de consola ni pedidos fallidos (2026-07-25).
- [x] **"Alquilar propiedad existente"** (Ventas y Carteles) y **"Agregar
      inquilino"** (Inquilinos y Cobros) — mismo problema estructural que
      "Publicar propiedad existente" pero al revés: no había forma de
      tomar una propiedad de la cartera (típicamente una publicada en
      venta, o una de alquiler vacante) e instrumentarle un alquiler nuevo
      con inquilino. Como es exactamente la misma operación vista desde
      dos módulos distintos, se armó un componente compartido nuevo,
      `admin/src/components/AlquilarPropiedadModal.tsx`, usado desde un
      botón en cada página. Al guardar hace tres llamadas en secuencia:
      `PATCH /propiedades/:id` (`modalidad: 'ALQUILER'` + índice,
      frecuencia de aumento y fechas de contrato, todo ya soportado por
      `UpdatePropiedadDto`), `POST /propiedades/:id/aumentos` (carga el
      alquiler inicial como primer `HistorialAumento` — es el único camino
      para fijar un monto inicial en una propiedad que ya existe, porque
      `montoAlquilerInicial` en el DTO de creación solo aplica al alta) y
      `PATCH /propiedades/:id/inquilino` (upsert del inquilino, mismo
      endpoint que ya usaba `AgregarPropiedadPage`). No hizo falta backend
      nuevo. Una propiedad recién alquilada aparece automáticamente en
      Inquilinos y Cobros porque esa lista ya filtraba por
      `modalidad: 'ALQUILER'` + `inquilino: { isNot: null }`
      (`cobros.service.ts::propiedadesAlquiladas()`) — no hubo que tocar
      esa consulta. Si la propiedad estaba publicada en venta, se muestra
      una nota explícita (misma lógica espejada que la de "Publicar
      propiedad existente"): pasa a modalidad Alquiler y deja de listarse
      como publicada en Ventas y Carteles, pero la ficha de venta no se
      borra. Probado con Playwright desde ambos botones: una propiedad
      alquilada desde Ventas y Carteles quedó visible en Inquilinos y
      Cobros con su ficha completa, y otra alquilada directamente desde
      "+ Agregar inquilino" en Inquilinos y Cobros también — cero errores
      de consola, cero pedidos fallidos (2026-07-25).
- [x] **Caja: filtros de categoría separados para ingresos y egresos** —
      la edición de movimientos manuales (`✎` en la fila → mismo
      `NuevoMovimientoModal` en modo edición) ya funcionaba de antes
      (`PATCH /caja/movimientos/:id`, restringido a `origen: MANUAL` —
      los automáticos se siguen corrigiendo desde su módulo de origen,
      §3.8); lo que faltaba eran los dos filtros de categoría pedidos. Se
      agregaron dos `<select>` independientes ("Categoría de ingresos" /
      "Categoría de egresos") arriba de la tabla de movimientos en
      `CajaPage.tsx`, con las opciones armadas dinámicamente a partir de
      las categorías que realmente aparecen ese mes (`Array.from(new
      Set(...))`), no de una lista fija — así el filtro siempre tiene
      sentido incluso con las categorías que generan otros módulos
      (`Alquiler`, `Ventas`, `Liquidación`, `Proveedores`, etc.), no solo
      las manuales. Los dos filtros son independientes entre sí: elegir
      una categoría de ingresos no oculta los egresos y viceversa, cada
      uno filtra solo su propio `tipo`. El saldo corrido (columna SALDO)
      se sigue calculando sobre **todos** los movimientos del mes en
      orden cronológico y recién después se filtra la lista a mostrar —
      si se filtrara antes, el saldo de cada fila visible quedaría mal
      calculado. Probado con Playwright: con el filtro "Alquiler" en
      ingresos activo, las filas de ingreso se redujeron a esa categoría
      mientras las de egreso (Liquidación, Proveedores, Servicios)
      siguieron mostrándose sin cambios (2026-07-25).
- [x] **Fix de layout: inputs/selects se salían del modal** — al agregar la
      sección "DATOS DE LA PROPIEDAD" a `SaleModal` (con el select de
      "Honorarios profesionales", cuya opción por defecto es el texto largo
      "Usar el % por defecto de Configuración") apareció un bug de CSS Grid
      real: los items de un grid tienen `min-width:auto` por default, que
      para un `<select>` se calcula en base al ancho de su opción más larga
      — eso fuerza a la columna del grid a crecer más allá del ancho
      disponible, y como `.formgrid{grid-template-columns:1fr 1fr}` no
      tenía ningún `minmax(0,...)` ni `min-width:0` que lo evitara, la
      columna entera (compartida por "Propietario" y "Honorarios
      profesionales") se salía del modal (~1006px de contenido en una
      tarjeta de 520px). No era un bug solo de este modal: el mismo patrón
      (`.cfgfields` en `AgregarPropiedadPage`) tiene el mismo riesgo, solo
      que ahí no se nota porque las tarjetas son mucho más anchas. Fix en
      `global.css`: `min-width:0` en `.fg` (el grid item) y en
      `.fg input,.fg select` — así el navegador puede angostar el control
      por debajo de su ancho de contenido en vez de forzar el grid a
      crecer (el texto largo de una opción no seleccionada simplemente se
      recorta visualmente, comportamiento nativo y esperado de un
      `<select>` angosto). Confirmado con Playwright leyendo
      `boundingBox()` de cada input antes/después: antes, "Nombre" medía
      512px dentro de una card de 452px de contenido (overflow); después,
      452px exacto, cero overflow en ningún campo (2026-07-25).
- [x] **Ventas y Carteles: editar y quitar una seña / editar y deshacer un
      cierre** — antes de esto, "Registrar seña" solo aparecía en estado
      Publicada/Pausada (o sea, antes de que existiera la seña) y "Cerrar
      venta" solo en Reservada — una vez que una seña o un cierre ya
      estaban cargados, no había ningún botón para corregirlos si el monto
      o la fecha se habían tipeado mal. `VentasService.registrarSena()` ya
      reemplazaba el movimiento de Caja anterior si se volvía a llamar
      (buen patrón, pero sin botón que lo disparara en ese estado); en
      cambio `cerrar()` **no** lo hacía — llamarlo dos veces habría creado
      una comisión duplicada en Caja. Se corrigió `cerrar()` para que borre
      `movimientoCajaComisionId` anterior antes de crear el nuevo (mismo
      patrón que `registrarSena`), y se agregaron dos operaciones nuevas,
      simétricas a las existentes: `eliminarSena()` (`DELETE
      /ventas/:id/sena` — borra el ingreso en Caja y vuelve la venta a
      Publicada) y `deshacerCierre()` (`DELETE /ventas/:id/cerrar` — borra
      la comisión en Caja y vuelve la venta a Reservada). En el frontend,
      `VentasPage.tsx` ahora muestra "✎ Editar seña" + "✕ Quitar seña"
      junto a "✓ Cerrar venta" cuando el estado es Reservada, y "✎ Editar
      cierre" + "↺ Deshacer venta" cuando está Vendida — reusan
      `SenaModal`/`CerrarModal` (que ahora aceptan un valor inicial para
      precargar el monto/fecha existente en vez de arrancar en blanco).
      Probado con Playwright de punta a punta sobre "Casa Quinta Pilar":
      editar cierre sin duplicar la comisión (se verificó por API que
      quedó un solo movimiento `COMISION_VENTA` para esa propiedad),
      deshacer venta → Reservada, editar seña (125.000 → 130.000
      precargado correctamente), quitar seña → Publicada, y volver a
      cargar seña + cerrar para dejar la demo en su estado original —
      cero errores de consola, cero pedidos fallidos (2026-07-25).
- [x] **Caja: eliminar movimientos manuales** — la edición de movimientos
      manuales ya existía (`PATCH /caja/movimientos/:id`); faltaba poder
      borrarlos directamente (p. ej. un movimiento cargado por error, sin
      querer editarlo a otra cosa). Nuevo `CajaService.eliminarManual()` +
      `DELETE /caja/movimientos/:id`, con la misma restricción que
      `editarManual` (solo `origen: MANUAL` — los automáticos se anulan o
      deshacen desde su módulo de origen: `anularPago` en Cobros, o
      "Quitar seña"/"Deshacer venta" en Ventas, recién agregados arriba).
      En el frontend, el modal de edición de un movimiento manual
      (`NuevoMovimientoModal` en modo edición, dentro de `CajaPage.tsx`)
      ahora tiene un botón "Eliminar movimiento" con `window.confirm`.
      Probado con Playwright: se creó un movimiento de prueba, se abrió en
      modo edición, se eliminó, y desapareció de la tabla sin errores de
      consola (2026-07-25).
- [x] **Fix: `DELETE /propiedades/:id` crasheaba con 500 si la propiedad
      tenía liquidaciones** — bug real reportado en producción (log de
      Nest): al usar el botón "Eliminar propiedad" (agregado en el punto
      anterior) sobre "PH San Telmo" — una propiedad que se había pasado a
      Venta con "Publicar propiedad existente" pero que **sigue** teniendo
      inquilino y liquidaciones emitidas de cuando era Alquiler — Prisma
      tiraba `Foreign key constraint violated:
      liquidacion_propiedades_propiedadId_fkey` sin capturar, y Nest lo
      devolvía como 500 genérico (además de loguear el stack completo).
      Causa: a diferencia de TODAS las demás relaciones hacia `Propiedad`
      (venta, inquilino, historial, fotos, gastos, pagos, facturas,
      carteles, incidencias — todas `onDelete: Cascade`),
      `LiquidacionPropiedad.propiedad` es a propósito `onDelete: Restrict`
      (§3.4): una liquidación ya emitida es un comprobante histórico hacia
      el propietario, no tiene que poder perderse en cascada solo porque la
      propiedad se borra del catálogo — esa restricción está bien puesta,
      lo que faltaba era manejarla en el service en vez de dejar que
      explote. Fix en `PropiedadesService.remove()`
      (`propiedades.service.ts`): captura
      `Prisma.PrismaClientKnownRequestError` con `code === 'P2003'` y la
      convierte en un `BadRequestException` con mensaje explicando qué
      pasó y qué hacer en su lugar (usar "Editar ficha" en vez de borrar).
      Nada de esto toca el resto de la app — no hay un filtro global de
      excepciones de Prisma, este fix es específico a este caso ya que es
      el único punto donde hoy se expone un `delete()` de `Propiedad` al
      usuario. Confirmado con curl (400 con el mensaje, en vez de 500) y
      con Playwright sobre el caso real ("PH San Telmo"): el modal muestra
      el error y queda abierto (no crashea, no se cierra solo), la
      propiedad sigue intacta en la base después del intento fallido
      (2026-07-25).
- [x] **Ficha de Propiedad — drawer con un clic desde Panel General** — el
      boceto (`openDrawer()`) tiene esto documentado como funcionalidad de
      producción, no solo de prototipo (`SGM_AR - Documento funcional para
      produccion.md` §2.1: *"Clic en una fila → abre la ficha de la
      propiedad"*), y hasta ahora el sistema real no lo tenía. Al investigar
      qué hacía falta encontré que **la mayor parte del backend ya existía
      sin usarse desde ningún lado del frontend**: Facturación completa
      (`app/api/src/facturacion/` — emitir factura con ítems predeterminados
      automáticos §3.5, emitir recibo) tenía cero referencias en
      `admin/src`; Incidencias ya filtraba por `propiedadId`; Gastos
      (`GET/POST /gastos`) no tenía ninguna pantalla (ni la tiene en el
      boceto — se cargan solo desde la ficha de cada propiedad); y
      `POST /propiedades/:id/aumentos` ya existía pero sin ningún botón que
      lo disparara fuera del alta inicial. Lo único que faltaba de cero era
      **adjuntar documentos reales** (el modelo `Documento` existía en el
      schema sin controller/service, igual que pasaba con las fotos antes
      de esta sesión — el propio documento funcional lo marca como
      pendiente bloqueante, §7.4) y un **historial de pagos por
      propiedad** (Cobros no exponía una lista, solo deuda/pendientes/
      resumen-del-mes). Backend nuevo:
      `PropiedadesService.agregarDocumento()`/`eliminarDocumento()` +
      `POST/DELETE /propiedades/:id/documentos[/:docId]` (mismo patrón que
      `agregarFoto`/`eliminarFoto`, PDF únicamente, 15MB) y
      `CobrosService.historialPagos()` + `GET
      /cobros/propiedades/:id/pagos`. Todo lo demás se conecta contra los
      endpoints que ya estaban.

      **La CSS del drawer ya existía en `global.css` sin usarse**
      (`.drawer`, `.dhead`, `.dbody`, `.dsec`, `.infocard`, `.calc`,
      `.calcframe`, `.contactline`, `.hist`) — se había heredado del boceto
      en la Fase 0 y quedó esperando esta pantalla, igual que pasó con
      `.dropzone`/`.doclist` para las fotos.

      Nuevo componente compartido `admin/src/components/
      PropiedadFichaDrawer.tsx`, enganchado con un clic en cada fila de la
      tabla de alquileres de `DashboardPage.tsx` (Panel General). Incluye:
      información del contrato, inquilino/propietario con botones **Emitir
      factura**/**Emitir recibo** (reusan `FacturasService`/`RecibosService`
      tal cual, con un modal que genera al abrir e imprime con
      `window.print()` — mismo patrón que `LiquidacionModal` en
      `PropietariosPage.tsx`), historial de aumentos, últimos cobros,
      gastos imputados + alta rápida de un gasto, **calculadora de aumento
      con el iframe real de Arquiler** (`https://arquiler.com/mini`, a
      pedido explícito del usuario tras ver el boceto — con el monto
      sugerido según el índice IPC/ICL de Configuración mostrado como
      referencia al lado, ya que ese cálculo es gratis con datos que el
      sistema ya tiene), ficha de venta resumida si la propiedad está en
      venta (con link a Ventas y Carteles, sin duplicar el editor),
      documentación (subir/ver/eliminar PDFs) e incidencias de la propiedad
      en solo lectura (con link a Incidencias y Proveedores — no duplica el
      alta con proveedor que ya existe ahí). Pie: eliminar propiedad (reusa
      el manejo de error de liquidaciones asociadas ya agregado arriba).
      *Fuera de alcance:* "Editar datos generales" todavía no tiene UI para
      propiedades en Alquiler (solo para Venta, vía `SaleModal`) — queda
      pendiente aparte.

      **Dos bugs reales encontrados y corregidos al probar esto de punta a
      punta:**
      1. Al crear una propiedad sin especificar "Vigente desde", el alta
         guardaba el primer `HistorialAumento` con `new Date()` (fecha +
         hora exacta), mientras que todo el resto del sistema carga
         `HistorialAumento.fecha` a partir de un `@IsDateString()`
         (medianoche UTC). Un aumento aplicado el mismo día terminaba con
         una fecha "menor" que la de alta (medianoche < la hora en que se
         creó la propiedad) y quedaba mal ordenado — `rentaVigente()` podía
         devolver el monto viejo. Corregido truncando ese default a
         medianoche (`propiedades.service.ts::create()`), y sumado
         `createdAt` como desempate en las tres consultas que ordenan
         `HistorialAumento` por `fecha` (`rentaVigente`, `proximoAumento`,
         el include de la ficha) para el caso — ahora posible y esperado —
         de que dos aumentos compartan exactamente la misma fecha.
      2. Al eliminar una propiedad desde el pie del drawer, invalidar
         `['propiedades']` (sin `exact`) alcanzaba por prefijo a la propia
         query de esa ficha (`['propiedades', id]`) y a `['renta-vigente',
         id]` — como el drawer todavía estaba montado en ese instante,
         React Query las volvía a pedir de inmediato contra una propiedad
         que ya no existe (`findUniqueOrThrow` → 500). Se sacaron esas dos
         keys de la invalidación (no se tocan ni se invalidan ni se
         remueven) y la lista se invalida con `exact: true` — el
         desmontaje del drawer al cerrar alcanza solo para dejar de
         observarlas.

      Probado con Playwright de punta a punta: clic en una fila abre el
      drawer con los datos correctos; calculadora con el iframe real
      (verificado que aparece/desaparece con Iniciar/Cancelar) + aplicar
      aumento actualiza el historial en el orden correcto; factura emitida
      con el alquiler vigente correcto cuando la fecha de vigencia coincide
      con el 1° del mes (y en $0 si no, comportamiento esperado — la
      factura es "el alquiler vigente al 1° del mes", no al día de hoy);
      recibo sin pagos muestra el error de forma prolija sin romper nada;
      subir un PDF funciona, un `.txt` se rechaza, eliminar el documento
      funciona; eliminar la propiedad cierra el drawer sin errores de
      consola. Smoke test de las 10 páginas sin errores (2026-07-26).

- [x] **Emitir factura editable + comprobantes limpios al imprimir** — a
      pedido del usuario, "Emitir factura" (en la Ficha de Propiedad) dejó de
      emitir directo con los ítems predeterminados: ahora los trae como
      punto de partida editable (`GET /facturacion/propiedades/:id/
      items-predeterminados`, endpoint que ya existía sin usarse) y deja
      agregar/quitar líneas y editar cada descripción/monto antes de
      confirmar. Al confirmar, se manda ese detalle tal cual
      (`POST .../facturas` ya aceptaba un array `items` opcional —
      `EmitirFacturaDto`/`FacturaItemInputDto` — pero nadie en el frontend lo
      usaba; sin backend nuevo). Recibo y Liquidación no se tocaron en este
      punto: sus ítems salen de datos reales (pagos/honorarios cobrados), no
      tiene sentido editarlos a mano.

      Además, en las tres pantallas que arman un comprobante para imprimir
      (`FacturaModal`/`ReciboModal` en `PropiedadFichaDrawer.tsx` y
      `LiquidacionModal` en `PropietariosPage.tsx`) los botones de acción
      ("Cerrar"/"Cancelar"/"▤ Imprimir") quedaban dentro de `.modalcard`, que
      es justo lo único que la regla `@media print` (`global.css`) deja
      visible — entonces salían en el papel junto con el comprobante. Se
      agregó una clase `.noprint` a esos `.btnrow` y una regla
      `.noprint{display:none!important}` dentro de `@media print`: en
      pantalla los botones se ven igual, en la vista de impresión solo queda
      el detalle facturado.

      Probado con Playwright: al abrir "Emitir factura" aparecen los 6
      ítems predeterminados en filas editables (no una factura ya emitida);
      agregar un ítem nuevo, quitar uno existente y editar el monto de otro
      recalculan el total en pantalla en vivo; al confirmar, la factura
      emitida trae exactamente esos ítems y ese total; con
      `page.emulateMedia({media:'print'})`, `.btnrow.noprint` da
      `display:none` mientras `.liqcard` (los datos) se mantiene visible
      (2026-07-26).

- [x] **Ventas y Carteles: propiedades alquiladas siguen visibles + filtro
      por etapa de interesados** — el usuario probó "+ Alquilar propiedad
      existente" sobre una propiedad que estaba en venta y notó que
      desaparecía de Ventas y Carteles. Tenía razón: `propiedadesVenta` en
      `VentasPage.tsx` filtraba estrictamente `p.modalidad === 'VENTA'`, y
      alquilar una propiedad le cambia la `modalidad` a ALQUILER (el propio
      `AlquilarPropiedadModal` ya avisa de esto: *"al alquilarla pasa a
      modalidad Alquiler y deja de listarse en Ventas y Carteles... si tiene
      ficha de venta con interesados, no se borra"*) — la ficha de venta y
      sus interesados quedaban intactos en la base, simplemente ya no se
      mostraban en ningún lado. Se cambió el filtro a `p.modalidad ===
      'VENTA' || p.venta != null`: cualquier propiedad con una ficha de
      venta asociada se sigue listando, tenga hoy la modalidad que tenga.
      Cuando la propiedad ya está alquilada se le agrega un badge
      "Alquilada" al lado del estado de venta y una nota aclaratoria en el
      cuerpo de la tarjeta; ninguna acción se restringió (backend nunca
      validó la modalidad en `VentasService`, así que seguir permitiendo
      "Editar ficha"/"Registrar seña"/etc. sobre estos casos no rompe nada,
      solo puede ser útil para corregir datos históricos).

      Se agregó también un segundo filtro, **etapa de interesados**
      (Consulta/Visita/Negociación/Reserva/Descartado, el mismo enum
      `EtapaInteresado` que ya se usaba por tarjeta), al lado del filtro por
      tipo de propiedad — una propiedad se muestra si al menos uno de sus
      interesados está en la etapa elegida.

      Probado con Playwright: propiedad en venta con un interesado en
      "Negociación" — visible con el filtro en "Negociación", no visible
      con "Reserva"; tras alquilarla desde "+ Alquilar propiedad existente",
      la tarjeta sigue apareciendo con el badge "Alquilada" y la nota, y el
      filtro por etapa la sigue encontrando (2026-07-26).

- [x] **Fotos también en "Agregar Propiedad" para modalidad Alquiler** — la
      sección "FOTOS DE LA PROPIEDAD" del alta solo se mostraba con
      `modalidad === 'VENTA'`, aunque la mutación que sube las fotos
      (`crear` en `AgregarPropiedadPage.tsx`) ya las subía sin mirar la
      modalidad, y el backend (`agregarFoto`/`eliminarFoto`,
      `PropiedadesService`) nunca restringió esto por tipo de propiedad —
      era puramente una card oculta en el formulario. El usuario las
      necesita para Alquiler porque van a ser las que se conecten a la
      landing page junto con los datos del alquiler (mismo criterio que ya
      se aplica del lado de Venta). Se sacó la condición: la card de fotos
      ahora aparece siempre, sin importar la modalidad elegida.

      Probado con Playwright: con modalidad Alquiler (la que viene por
      default), la card de fotos está visible, se puede elegir una imagen
      y queda en la miniatura antes de guardar; al guardar la propiedad no
      aparece el error de "no se pudieron subir" y, confirmado por consulta
      directa a la base, la propiedad quedó con 1 fila en `FotoPropiedad`
      (2026-07-26).

- [x] **Avisos: filtro por categoría + eliminar un aviso puntual** — los
      avisos (`AvisosService.generar()`, §2.8) no son filas en una tabla:
      se recalculan siempre desde datos reales (deudas, incidencias,
      contratos, clientes, eventos, liquidaciones), así que no había nada
      que "borrar" en el sentido tradicional. Se agregó un modelo nuevo,
      `AvisoDescartado` (`grupo` + `clave`, `@@unique([grupo, clave])`), y
      cada ítem generado ahora trae una `clave`: para la mayoría es
      directamente el id de la entidad (`incidenciaId`, `clienteId`,
      `eventoId`, `liquidacionId`), pero para reclamos de deuda, avisos de
      aumento y renovaciones de contrato la `clave` incluye también el
      valor que generó el aviso (`propiedadId:deuda`,
      `propiedadId:fechaAumento`, `propiedadId:fechaVencimiento`) — así, si
      ese valor cambia (la deuda subió, se aplicó el aumento, se renovó el
      contrato), es un aviso "distinto" con una clave distinta y vuelve a
      aparecer aunque el anterior ya se haya descartado; para liquidaciones
      el `id` ya es seguro porque regenerar una liquidación del mismo mes
      borra la fila anterior y crea una nueva
      (`LiquidacionesService.generar()`). `generar()` ahora carga
      `avisoDescartado.findMany()` una vez y filtra las 7 listas contra
      ese set antes de devolverlas. Nuevo endpoint `POST /avisos/descartar`
      (`{ grupo, clave }`, upsert — descartar dos veces no rompe nada).

      En el frontend (`AvisosPage.tsx`), cada `AvisoItem` ahora lleva
      `grupo`/`clave`, cada tarjeta tiene un botón "✕ Eliminar" que llama
      al endpoint nuevo e invalida `['avisos']`, y arriba de la lista hay
      una fila de chips (uno por categoría con avisos, con el conteo) para
      mostrar/ocultar cada grupo sin tocar el servidor — es un filtro solo
      de vista, estado local del componente.

      Probado con Playwright: con un cliente de prueba en estado "Sin
      contactar" (aviso real generado por el sistema), el chip
      "CLIENTES SIN CONTACTAR" lo oculta y lo vuelve a mostrar; "✕
      Eliminar" lo saca de la vista y, confirmado tras recargar la página
      (persistido en `avisos_descartados`, no es un estado de React que se
      pierde), sigue sin aparecer (2026-07-26).

## Landing page pública + split de rutas `/` (landing) vs `/admin` (panel)

- [x] **Nuevo proyecto `app/` — landing pública en Vite + React + TS** — el
      admin (`admin/`) pasó a vivir bajo `/admin`, liberando la raíz `/`
      para una landing nueva que adapta el diseño aprobado en
      `Facundo Paris Propiedades carrusel (1).html` (un bundle exportado de
      una herramienta de prototipado, sin código fuente mantenible) al
      stack real del proyecto — conectada a datos reales del backend en
      vez de las 7 propiedades de ejemplo hardcodeadas del boceto. Se
      construyó como proyecto nuevo con raíz en `app/` (hermano de
      `app/api/`), reusando el `app/fonts/` y `app/src/logos/` que ya
      existían ahí sin ningún frontend scaffolded todavía.

      **Split `/admin`**: `admin/vite.config.ts` ahora tiene
      `base: '/admin/'` (puerto de dev pasó de 5173 a 5174),
      `admin/src/main.tsx` tiene `basename="/admin"` en el
      `<BrowserRouter>`. Grep confirmado sobre todo `admin/src`: el único
      lugar con anchors crudos (no-router, rompían al vivir bajo `/admin`)
      eran 4 líneas en `DashboardPage.tsx` (KPIs "Actualizaciones IPC/ICL",
      "Deuda de Inquilinos", "Cobranza del Mes") — se cambiaron de
      `<a href="/...">` a `<Link to="/...">`; el resto de la app ya usaba
      `<Link>`/`<NavLink>`/`<Navigate>`, que heredan el `basename` solos.

      **Proxy de desarrollo**: la landing (puerto 5173, la "raíz del
      dominio" en dev) tiene en su `vite.config.ts` un
      `server.proxy: { '/admin': { target: 'http://localhost:5174',
      changeOrigin: true, ws: true } }` — visitar
      `http://localhost:5173/admin/` reenvía transparentemente al dev
      server del admin, incluida la websocket de HMR. Como el admin ya
      emite todo con `base: '/admin/'`, el proxy no necesita reescribir
      nada: es la misma config que hace falta para el build de producción.

      **Backend — `PublicModule` nuevo** (`app/api/src/public/`,
      `@Controller('public')` **sin `@UseGuards`** — la única superficie
      sin autenticación de todo el sistema):
      - `GET /public/propiedades?modalidad=&tipo=&page=&limit=` — select
        explícito de solo campos públicos (nunca propietario, honorarios,
        contrato, punitorios). Alquiler "disponible para publicar" = mismo
        criterio ya usado en `AgregarPropiedadPage`/`CartelesService`
        (`inquilino: null`); venta publicable = `venta.publicada: true`
        **y** `venta.estado: 'PUBLICADA'` — hace falta el estado además
        del booleano porque `publicada` nunca se pone en `false` sola al
        cerrar una venta (`VentasService.cerrar()`/`venderPorTerceros()`
        no la tocan).
      - `GET /public/propiedades/stats-por-tipo` — cuenta el mismo set
        público, mapeado a 4 buckets (Casas/Departamentos/Locales/Lotes).
      - `POST /public/contacto` — reusa `ClientesService.create()` tal
        cual ya existía (`origen: 'Landing web'`, `estado` default
        `SIN_CONTACTAR`) — un lead del formulario público aparece solo en
        Avisos → "Clientes sin contactar" sin ningún trabajo extra,
        protegido con `@nestjs/throttler` (5 req/min/IP, la única
        escritura sin auth del sistema).
      - `GET /public/contacto-info` — `ConfiguracionService.getContactoPublico()`
        nuevo, select acotado a 6 campos nuevos y dedicados en
        `Configuracion` (`publicoWhatsapp/publicoTelefono/publicoEmail/
        publicoInstagramUrl/publicoDireccion/publicoMatricula`, migración
        aditiva) — deliberadamente separados de
        `empresaNombre/empresaCuit/empresaDireccion/empresaContacto` que
        ya existían (esos son para encabezar comprobantes fiscales, un
        concepto distinto). Editables desde una card nueva
        "DATOS PÚBLICOS (LANDING PAGE)" en `ConfiguracionPage.tsx`.

      **Migración aditiva en `Propiedad`**: `ambientes Int?`,
      `banos Int?`, `superficieM2 Decimal?` — el HTML de referencia
      muestra "Amb./Baños/Sup." por propiedad y el modelo no tenía nada de
      eso. Opcionales, sin backfill; la tarjeta pública omite la fila de
      specs si los 3 son `null`. Nuevos inputs en
      `AgregarPropiedadPage.tsx` (sección "Datos generales"); fluyen solos
      a través de `CreatePropiedadDto`/`UpdatePropiedadDto` y del spread
      `...datos` que ya usa `PropiedadesService`, sin tocar el service.

      **Frontend de la landing** (`app/src/`): `Header`/`Footer` con el
      logo real (`LOGO PNG.-02.png`), paleta de colores del HTML de
      referencia como variables CSS, kit de fuentes real del usuario en
      vez de las Google Fonts (Inter/Spectral) del boceto — de las
      provistas en `app/fonts/`, solo Montserrat tenía match directo;
      Gotham-Bold/GothamMedium/GothamBook se usan para títulos y cuerpo
      (decisión de diseño, no requisito técnico). Secciones en el mismo
      orden que el HTML de referencia: Hero (con buscador que navega a
      `/propiedades?modalidad=&tipo=`), carrusel de propiedades (autoplay,
      3/2/1 por breakpoint, filtro por tipo, "Ver todas" → `/propiedades`),
      banda "Explorá por tipo", "Cómo trabajamos", "Nosotros" (stats
      animados con `IntersectionObserver`), "Consejos", formulario de
      contacto real (ya no es decorativo como en el boceto), footer. Sin
      fotos reales para hero/retrato (no había asset — quedan como
      bloques placeholder); las fotos de propiedad sí son reales
      (`FotoPropiedad`, ya conectadas desde una sesión anterior pensando
      en esto). `robots.txt` bloquea `/admin`, incluye `sitemap.xml`.

      Probado con Playwright de punta a punta: propiedades sembradas
      directo en la base (una venta publicada+`PUBLICADA`, un alquiler
      vacante, una venta no-publicada y un alquiler con inquilino) — el
      endpoint público devuelve exactamente las 2 primeras, nunca las
      otras dos; los filtros por tipo y modalidad (carrusel y
      `/propiedades`) funcionan; el formulario de contacto crea un
      `Cliente` real que aparece de inmediato en Avisos y en el listado de
      Clientes con `origen: 'Landing web'`; entrando al admin **a través
      del proxy** (`localhost:5173/admin/`), login y navegación funcionan,
      y los 4 links que antes eran `<a>` crudos ahora navegan client-side
      sin recargar; `GET /propiedades` (autenticado) sigue devolviendo 401
      sin token, confirmando que el guard de los demás controllers no se
      aflojó. Smoke test de las 2 rutas de la landing + las 11 rutas del
      admin sin errores de consola ni requests fallidos. `tsc --noEmit`
      limpio en los 3 proyectos (`admin`, `app`, `app/api`) (2026-07-27).

- [x] **Ventas y Carteles: un solo "Publicar propiedad existente" con
      modalidad Venta/Alquiler** — antes había dos botones/modales
      separados para la misma operación de fondo (activar una propiedad de
      la cartera): "+ Alquilar propiedad existente" (contrato, inquilino)
      y "+ Publicar propiedad existente" (siempre forzaba modalidad Venta,
      con precio). A pedido del usuario se unificaron en un solo botón:
      `PublicarExistenteModal` (`VentasPage.tsx`) ahora tiene un selector
      de **Modalidad** arriba de todo (Venta/Alquiler) y muestra el juego
      de campos correspondiente — precio/moneda/publicada/cierre estimado
      para venta (como antes), o índice/frecuencia/monto inicial/contrato/
      inquilino para alquiler (la misma lógica que tenía
      `AlquilarPropiedadModal`, inlineada acá). La lista de propiedades
      disponibles en el `<select>` también depende de la modalidad elegida
      (venta: sin ficha de venta todavía; alquiler: sin inquilino
      asignado) para no pisar una operación ya activa.

      `AlquilarPropiedadModal` (el componente compartido) no se tocó ni se
      borró — sigue siendo el que usa Inquilinos y Cobros ("+ Agregar
      inquilino") — solo se dejó de usar desde Ventas y Carteles, que
      ahora resuelve el caso alquiler con su propia copia de esos campos
      dentro del modal unificado.

      Probado con Playwright: solo aparece un botón en la barra de Ventas
      y Carteles; el selector de Modalidad cambia los campos visibles en
      vivo (Precio desaparece al pasar a Alquiler, aparece Monto de
      alquiler inicial); publicar una propiedad de prueba como Venta la
      deja visible como tarjeta en Ventas y Carteles; publicar otra como
      Alquiler la deja visible en Inquilinos y Cobros con el inquilino
      cargado — sin errores de consola ni requests fallidos (2026-07-27).

- [x] **Landing pública: las propiedades de alquiler ocupadas también se
      muestran, marcadas como "Alquilada"** — `PublicPropiedadesService`
      filtraba ALQUILER solo a las vacantes (`inquilino: null`); las
      ocupadas quedaban completamente afuera de `/public/propiedades`. A
      pedido del usuario, ahora se listan **todas** las propiedades de
      alquiler, tengan o no inquilino — el filtro `condicionListable()`
      para ALQUILER pasó a ser solo `{ modalidad: ALQUILER }`. El
      `SELECT_PUBLICO` suma `inquilino: { select: { id: true } }` (solo
      para saber si existe, nunca se expone nombre/contacto del inquilino
      en la web pública) y `mapear()` calcula
      `disponible: p.inquilino == null`, expuesto en la respuesta.

      En el frontend, `PropertyCard.tsx` arma el badge de la tarjeta según
      ese flag: vacante → "Alquiler" (badge navy, como antes), ocupada →
      "Alquilada" (badge gris apagado, clase `.ocupada` nueva en
      `global.css`) — nada cambia para VENTA ("En venta" sigue igual). El
      resto de la tarjeta (precio/alquiler vigente, specs, foto, CTA de
      WhatsApp) se muestra igual en ambos casos; la única diferencia es la
      etiqueta.

      Probado con Playwright: una propiedad de alquiler vacante muestra
      badge "Alquiler", una con inquilino muestra "Alquilada" con la clase
      `.ocupada`, y confirmado también sobre una propiedad real ya
      cargada en el sistema ("depto 1", con inquilino) — aparece
      correctamente como "Alquilada" en `/propiedades?modalidad=ALQUILER`
      sin errores de consola (2026-07-27).

- [x] **Reversión: alquiladas vuelven a ocultarse de la landing + control
      real de "vacante" y "publicada en la web" desde el admin** — el
      punto anterior (mostrar las alquiladas marcadas como "Alquilada")
      se revirtió a pedido del usuario: una propiedad de alquiler con
      inquilino **no aparece más** en `/public/propiedades`, sea cual sea
      cualquier otro flag. `PublicPropiedadesService.condicionListable()`
      volvió a exigir `inquilino: null` para ALQUILER, y se sacaron el
      campo `disponible` (`mapear()`) y el badge "Alquilada" del lado del
      frontend (`PropertyCard.tsx`, `PropiedadPublica` en
      `app/src/api/propiedades.ts`) — quedaron exactamente como estaban
      antes de esa sesión.

      A cambio, se agregó lo que sí hacía falta: **control real de
      publicación para una propiedad de alquiler vacante**, análogo a
      `Venta.publicada` pero como campo propio en `Propiedad`
      (`alquilerPublicado Boolean @default(true)`, migración aditiva —
      alquiler no tiene una ficha satélite como venta). El filtro público
      de ALQUILER ahora es `inquilino: null && alquilerPublicado: true`:
      una vacante con el flag en `false` queda pausada, no se muestra en
      la web aunque esté libre.

      Nuevo en `AgregarPropiedadPage.tsx`: checkbox "Mostrar en la página
      web" en "DATOS DE ALQUILER" (solo visible si no se tildó "Ya tiene
      inquilino asignado" — no tiene sentido para una propiedad que nace
      ocupada), default tildado.

      Nuevo en `PropiedadFichaDrawer.tsx` (la ficha que se abre con un
      clic desde Panel General): checkbox "Publicada en la web" con guardado
      inmediato al tildar/destildar (sin botón "Guardar" aparte — primer
      caso de este patrón en el codebase, justificado porque es un único
      campo booleano de bajo riesgo, no un formulario con varios campos) y
      un botón nuevo "✕ Marcar como vacante" que quita el inquilino
      asignado (`DELETE /propiedades/:id/inquilino` — el endpoint ya
      existía en el backend, `removeInquilino()`, pero no se llamaba desde
      ningún lado del frontend hasta ahora) sin borrar su historial de
      pagos/facturas.

      **Bug descubierto al probar esto (y corregido, luego revertido a
      pedido del usuario — ver más abajo)**: la ficha de una propiedad de
      alquiler solo se puede abrir haciendo clic en una fila de la tabla de
      Panel General (`DashboardPage.tsx`) — y esa tabla **solo mostraba
      propiedades con inquilino asignado** (`alquiladas`, usado también
      para los KPIs de cobranza/ocupación). Una propiedad vacante no
      aparecía en ningún lado. La corrección original agregaba un segundo
      grupo de filas (`vacantes = ALQUILER sin inquilino`) a esa misma
      tabla — ver el punto siguiente para por qué se sacó de nuevo.

      Probado con Playwright de punta a punta: propiedad vacante nueva
      aparece en la landing (flag default `true`); destildar "Publicada en
      la web" en su ficha la saca de la landing al instante, volver a
      tildar la trae de vuelta; asignarle un inquilino (vía "Publicar
      propiedad existente") la saca de la landing sin importar el flag;
      "Marcar como vacante" la libera y, al seguir con el flag en `true`,
      vuelve a aparecer sola. Sin errores de consola ni requests fallidos
      en ningún paso (2026-07-27).

- [x] **Ajuste: sacar las "vacantes" de Panel General, mover la elección
      inquilino sí/no a "Publicar propiedad existente"** — a pedido del
      usuario, se revirtió el punto anterior en `DashboardPage.tsx`: la
      tabla de Panel General volvió a mostrar solo `alquiladas` (con
      inquilino), sin el segundo grupo de filas para vacantes. La lógica
      de "publicada en la web" y de asignar/no asignar inquilino en el
      momento de publicar se movió al lugar donde el usuario sí la quiere:
      el modal `PublicarExistenteModal` de "Ventas y Carteles"
      (`VentasPage.tsx`).

      Ese modal, en su rama "Alquiler", exigía siempre nombre de inquilino
      (`inqNombre` obligatorio) — con lo cual toda propiedad publicada por
      ahí quedaba de inmediato ocupada y oculta de la landing. Ahora tiene
      el mismo patrón que "DATOS DE ALQUILER" en `AgregarPropiedadPage.tsx`:
      un checkbox "Ya tiene inquilino asignado" (destildado por defecto).
      Si queda destildado, se muestra en su lugar el checkbox "Mostrar en
      la página web (landing page)" (tildado por defecto) y no se pide
      nombre/teléfono/email; al guardar, el `PATCH /propiedades/:id`
      incluye `alquilerPublicado` y **no** se llama a
      `PATCH /propiedades/:id/inquilino`, dejando la propiedad vacante y
      publicable. Si se tilda, se piden los datos del inquilino como
      antes y el flag de publicación queda sin efecto (la propiedad ocupada
      no se muestra igual, sea cual sea su valor).

      Probado con Playwright de punta a punta: publicar una propiedad como
      ALQUILER sin tildar "Ya tiene inquilino" la deja vacante y aparece de
      inmediato en `/public/propiedades`; volver a publicar la misma
      propiedad tildando "Ya tiene inquilino" y cargando un nombre la saca
      de la landing; Panel General ya no muestra ninguna fila "Vacante".
      Sin errores de consola ni requests fallidos (2026-07-27).

- [x] **Editar y deshacer un pago a proveedor** — hasta ahora, a diferencia
      de Cobros (anular pago), Gastos (editar/eliminar) y Ventas (deshacer
      seña/cierre), un pago a proveedor (`PagoProveedor`, botones "Registrar
      pago" y "Pagar saldo" en Incidencias y Proveedores) no se podía
      corregir ni deshacer una vez registrado — un error de monto o fecha
      quedaba pegado para siempre, sin forma de arreglarlo desde la UI.

      `PagosProveedorService` (`app/api/src/proveedores/pagos-proveedor.service.ts`)
      suma dos métodos nuevos:
      - `editarPago(pagoId, dto)` — corrige `monto`/`fecha` del pago y, en
        la misma transacción, del `movimientoCaja` que generó (mismo
        criterio que `editarPago` de Cobros y `editar` de Gastos: el
        automático se corrige desde su módulo de origen, no desde Caja).
      - `anularPago(pagoId)` — borra el pago (cascada sobre la tabla puente
        `PagoProveedorIncidencia`) y su egreso en Caja, y vuelve a poner
        `abonadaFecha: null` en todas las incidencias que ese pago saldaba
        — si venía de "Pagar saldo" y cubría varias a la vez, deshacerlo
        las libera a todas juntas (un solo movimiento de Caja no se puede
        deshacer parcialmente). Las incidencias liberadas vuelven a
        mostrar "Registrar pago".

      Rutas nuevas en `proveedores.controller.ts`:
      `PATCH /proveedores/pagos/:pagoId` y `DELETE /proveedores/pagos/:pagoId`.

      `IncidenciasService.findAll/findOne` ahora incluyen
      `pagosProveedor: { pagoProveedor: { ..., _count: { incidencias } } }`
      para que el frontend sepa qué pago saldó cada incidencia (necesario
      para poder editarlo/deshacerlo) y si ese pago cubrió otras
      incidencias a la vez (para advertir antes de deshacerlo).

      `IncidenciasPage.tsx`: junto a "✓ abonado el `<fecha>`" ahora hay
      botones "Editar pago" (abre `EditarPagoModal`, monto y fecha) y
      "Deshacer" (con confirmación — el mensaje avisa si el pago cubría
      más de una incidencia).

      **Bug real encontrado y corregido durante la verificación**: la
      primera versión de `anularPago()` no devolvía nada (la transacción
      terminaba en `await tx.pagoProveedor.delete(...)` sin `return`) — el
      `DELETE` respondía 200 con el body vacío, y `api.delete` del
      frontend (que siempre intenta `res.json()` salvo status 204) tiraba
      una excepción de parseo silenciosa: la petición se veía "exitosa" en
      la red (200), pero `onSuccess` nunca corría, así que Caja/Incidencias
      no se invalidaban y la tarjeta se quedaba mostrando "abonado" para
      siempre aunque el backend ya lo hubiera deshecho correctamente. Un
      script de verificación en crudo (fetch + solo chequear `r.ok`, sin
      parsear el body) no lo detectó — recién apareció al probarlo con
      Playwright contra la UI real, que usa el mismo cliente `api.delete`
      que el resto de la app. Se corrigió agregando `return` antes del
      `delete` final, siguiendo el mismo patrón que ya usan todos los
      demás endpoints de baja del proyecto (Gastos, Ventas, Proveedores):
      nunca devolver `undefined` desde un handler de `@Delete`.

      Probado con Playwright de punta a punta contra la UI real (no solo
      la API): registrar un pago, editarle el monto (se refleja en Caja al
      instante), deshacerlo (desaparece de Caja, la incidencia vuelve a
      ofrecer "Registrar pago", se puede volver a pagar) — y por separado,
      un "Pagar saldo" de dos incidencias juntas se deshace liberando a
      ambas a la vez. Sin errores de consola ni requests fallidos
      (2026-07-29).

- [x] **Editar y eliminar un Gasto desde la ficha de propiedad** — el
      usuario reportó que en Caja no había ningún botón para corregir un
      monto. La causa real: el backend de Gastos (`PATCH /gastos/:id`,
      `DELETE /gastos/:id`) ya existía desde antes, pero **la lista "GASTOS
      IMPUTADOS" de `PropiedadFichaDrawer.tsx` no tenía ningún botón de
      editar/eliminar** — y Caja, correctamente, se niega a editar
      movimientos automáticos y remite a "su módulo de origen". Con Gastos
      sin UI de edición, un `GASTO_PROPIEDAD` mal cargado no se podía
      corregir desde ningún lado.

      Se agregaron botones "✎" (editar) y "✕" (eliminar) a cada fila de
      gasto en esa lista. Solo aparecen en gastos manuales
      (`incidenciaId == null`) — los gastos generados automáticamente al
      resolver una incidencia con costo (§3.3) muestran en su lugar el
      texto "desde Incidencias", porque el backend rechaza (400) editarlos
      o eliminarlos ahí — se corrigen reabriendo/editando la incidencia,
      igual que antes. `NuevoGastoModal` ahora acepta un `gasto` opcional
      para reutilizarse como modal de edición (con su propio botón
      "Eliminar" además del "✕" directo en la fila).

      Cobros (pagos de alquiler) y Ventas (señas/comisiones) ya tenían esta
      misma capacidad de editar/deshacer desde su propio módulo — Gastos
      era el único de los cinco orígenes automáticos de Caja que se había
      quedado sin ella.

      Probado con Playwright de punta a punta: un gasto manual muestra
      ambos botones y ninguno aparece en el gasto de una incidencia;
      editar el monto se refleja al instante en Caja; eliminarlo con el
      botón rápido de la fila borra también su egreso en Caja. Sin errores
      de consola ni requests fallidos (2026-07-29).

- [x] **Editar cualquier ingreso/egreso directamente desde Caja** — pedido
      explícito del usuario: quería poder corregir un monto sin salir de
      Caja, sea cual sea su origen. Antes, clickear una fila automática no
      hacía nada — solo mostraba el texto "se edita en su módulo de
      origen". Ahora **todas las filas son clickeables** y abren un modal
      de edición específico según `origen`, que llama al mismo endpoint
      que usa su módulo de origen (así el registro fuente y el movimiento
      de Caja quedan sincronizados en la misma operación, no hay una
      segunda fuente de verdad):

      - `COBRO_ALQUILER` → `EditarCobroModal` (monto/fecha/medio vía
        `PATCH /cobros/pagos/:id`, + "Anular cobro").
      - `GASTO_PROPIEDAD` → `EditarGastoModal` (trae el detalle completo
        con el `GET /gastos/:id` nuevo — antes no existía, Caja solo
        conocía el `gastoId` por la relación inversa, no la descripción ni
        el destino — y edita con `PATCH /gastos/:id`, + "Eliminar").
      - `PAGO_PROVEEDOR` → `EditarPagoProveedorModal` (monto/fecha vía
        `PATCH /proveedores/pagos/:id`, + "Deshacer pago").
      - `SENA_VENTA` → `EditarSenaModal` (monto/fecha vía
        `POST /ventas/:id/sena`, + "Quitar seña").
      - `COMISION_VENTA` → `EditarComisionModal`. Acá hizo falta un cambio
        de backend: la comisión nunca fue un campo propio de `Venta`, se
        recalculaba siempre como `precio × porcentaje` dentro de
        `cerrar()` — no había forma de "poner este número a mano" sin
        tocar el precio de venta real. Se agregó `comisionManual?` opcional
        a `CerrarVentaDto`/`ventas.service.ts::cerrar()`: si se manda,
        reemplaza el cálculo automático para esa venta. + "Deshacer venta".
      - `LIQUIDACION_PROPIETARIO` → `RegenerarLiquidacionModal`. Este es el
        único que **no** tiene un campo de monto editable a mano: el neto
        girado es un cálculo agregado (cobros − gastos − honorarios de
        varias propiedades ese mes), no un número suelto. El modal explica
        esto y ofrece "Recalcular liquidación" (vuelve a llamar
        `POST /liquidaciones/propietarios/:id/:mes`, que ya reemplazaba la
        liquidación anterior — mismo mecanismo que usa Propietarios y
        Liquidaciones al reabrir el modal).

      `CajaService.findMes()` ahora incluye la relación inversa de cada
      movimiento (`pago`, `gasto`, `liquidacion`, `pagoProveedor`,
      `ventaSena`, `ventaComision`, cada uno solo con los ids que hacen
      falta) para que el frontend sepa a qué registro pegarle sin una
      consulta aparte. `invalidarCaja()` en `CajaPage.tsx` se amplió para
      invalidar los cinco módulos de origen a la vez (antes solo cobros y
      avisos), ya que ahora cualquier edición desde acá puede tocar
      cualquiera de ellos.

      Probado de punta a punta (backend con 14 aserciones + Playwright
      contra la UI real): editar un cobro y un gasto desde Caja actualiza
      tanto el movimiento como el registro original (`Pago`/`Gasto` en la
      base); lo mismo confirmado a nivel API para pago a proveedor, seña,
      `comisionManual` (queda en el valor forzado, no en el calculado) y
      regenerar liquidación (el neto cambia al corregir un gasto y volver a
      generar). Sin errores de consola ni requests fallidos (2026-07-29).

- [x] **Imágenes reales del Hero/Nosotros + carrusel de fotos en la landing
      + editar fotos/dimensiones de una propiedad desde el admin** —
      pedido del usuario, con las imágenes reales ya puestas en
      `app/src/images/FOTO1.png` y `app/src/images/FotoNosotros.jpeg`.

      **Landing**: `Hero.tsx` y `Nosotros.tsx` importan esas dos imágenes
      como módulos ES (mismo patrón que el logo en `Header.tsx`/`Footer.tsx`)
      y reemplazan el placeholder `[ imagen — ... ]`; `global.css` les
      agrega `overflow:hidden` + `img{object-fit:cover}` a `.hero-image` y
      `.nosotros-photo` para que la imagen respete el `border-radius` y el
      recorte que antes tenía el bloque de gradiente.

      `PropertyCard.tsx` ahora es un carrusel (`PropertyPhotoCarousel`,
      componente interno con `useState` para el índice actual): si la
      propiedad tiene 0 fotos, se ve el gradiente placeholder de siempre;
      con 1 foto, se ve esa sola sin controles; con 2+, aparecen flechas
      ‹/› (con opacity:0 → 1 solo al hacer hover, `.property-photo-nav` en
      `global.css`) y dots de posición siempre visibles (para touch, que no
      tiene hover) — todo maneja `stopPropagation`/`preventDefault` porque
      la card entera es cliqueable hacia la ficha en el futuro. No hace
      falta ningún cambio de backend: `/public/propiedades` ya devolvía el
      array completo de `fotos` ordenado, `PropertyCard.tsx` solo usaba
      `fotos[0]`.

      **Admin**: hasta ahora, agregar/quitar fotos y cargar
      ambientes/baños/superficie **solo se podía hacer al crear** la
      propiedad (`AgregarPropiedadPage.tsx`) — no había forma de
      corregirlo después si hubo un error de carga o de interpretación al
      publicar. El backend ya soportaba todo esto sin cambios
      (`POST/DELETE /propiedades/:id/fotos[/:fotoId]`,
      `ambientes/banos/superficieM2` ya en `UpdatePropiedadDto`) — lo que
      faltaba era la UI para las propiedades ya cargadas.

      Se creó `admin/src/components/FotosPropiedad.tsx`, un componente
      chico y compartido (grilla de fotos con botón "✕" por foto +
      dropzone de carga múltiple, mismas clases CSS `.dropzone`/
      `.fotogrid`/`.fotothumb` que ya usaba el alta) que se conecta en dos
      lugares:
      - `PropiedadFichaDrawer.tsx` (ficha de alquiler, se abre desde Panel
        General): botón nuevo "✎ Editar datos" (nombre, dirección, tipo,
        ambientes, baños, superficie — `EditarDatosGeneralesModal`) y botón
        "🖼 Fotos (N)" que abre un modal con `FotosPropiedad`.
      - `VentasPage.tsx` → `SaleModal` (ficha de venta, "✎ Editar ficha" en
        Ventas y Carteles): se agregaron los mismos 3 campos de dimensiones
        a la sección "DATOS DE LA PROPIEDAD" que ya editaba
        nombre/dirección/tipo/honorarios, y una sección "FOTOS" nueva con
        el mismo componente compartido, justo antes de "FICHA DE VENTA".
        Ojo con un detalle de esta pantalla: `fichaDe` es una foto fija del
        momento en que se abrió el modal, así que se pasa
        `propiedad={(propiedades.data ?? []).find(p => p.id === fichaDe.id) ?? fichaDe}`
        (mismo criterio que ya usaba `venta={ventaPorPropiedadId.get(...) ?? fichaDe.venta}`)
        para que, al subir/borrar una foto y refetchear `['propiedades']`,
        el modal muestre la grilla actualizada sin cerrarse.

      Probado con Playwright de punta a punta: Hero y Nosotros muestran
      `<img>` real; una propiedad con 3 fotos muestra flechas y 3 dots en
      su card pública, y clickear "siguiente" cambia la foto mostrada;
      desde el admin, tanto la ficha de alquiler como la de venta permiten
      cargar ambientes/baños/superficie (persisten en la base) y
      subir/eliminar una foto (aparece/desaparece de la base en el mismo
      acto). Sin errores de consola ni requests fallidos (2026-07-29).

- [x] **Fix de visibilidad: "Publicar propiedad existente" parecía no
      hacer nada al hacer clic** — reporte del usuario. Auditado a fondo
      (Playwright automatizando Venta, Alquiler con inquilino, Alquiler
      vacante y "todos los campos llenos"): en **todos** los casos el guardado
      funcionaba bien de punta a punta (quedaba en la base y aparecía en
      Ventas y Carteles), sin errores de consola ni requests fallidos —
      no había ningún bug de guardado.

      La causa real es de visibilidad, no de lógica: `PublicarExistenteModal`
      (`VentasPage.tsx`) es un formulario largo (más aún en la rama
      Alquiler) dentro de un modal que scrollea (`.modal{overflow-y:auto}`),
      y tanto el mensaje de error como el motivo por el que el botón
      "Publicar" queda deshabilitado se mostraban **solo arriba del todo**,
      lejos de donde queda el botón cuando el formulario no entra en una
      pantalla chica. Con el usuario ya scrolleado hasta el botón, "clic y
      no pasa nada visible" era literal: sí pasaba algo (un error real del
      backend, o simplemente que faltaba un campo), pero quedaba fuera de
      vista. Se confirmó con Playwright forzando un error real
      (`frecuenciaAumentoMeses: 0`, viola `@Min(1)`) en un viewport chico:
      antes del fix el error no era visible sin scrollear.

      Fix: se agregó (a) un cálculo de `faltantes` (qué campo falta
      completar) mostrado justo arriba del botón cuando está deshabilitado
      ("Falta completar: elegir una propiedad, el monto de alquiler
      inicial."), y (b) el mensaje de error de la mutación duplicado ahí
      mismo, además de arriba del todo — así el motivo siempre es visible
      sin importar el scroll del modal en el momento del clic. Al no
      encontrarse ningún property específico ni escenario reproducible del
      lado del guardado, no se tocó ninguna lógica de negocio — solo la
      visibilidad del feedback.

      Nota aparte, encontrada al auditar los datos reales durante esta
      investigación (no era la causa del reporte, pero puede confundir a
      futuro): una propiedad que ya tiene ficha de venta **y** inquilino a
      la vez (por ejemplo, se publicó primero en venta y después se alquiló
      desde este mismo modal, o viceversa — comportamiento intencional,
      con aviso en pantalla) deja de aparecer en el combo "Propiedad" de
      "Publicar propiedad existente" en **ambos** modos, porque ya no
      corresponde a un alta nueva — se edita desde "Editar ficha" (Ventas y
      Carteles) o desde su fila en Panel General, no desde este modal.

- [x] **Bug real: una propiedad publicada como Alquiler vacante (sin
      inquilino) quedaba invisible en todo el admin** — el usuario aclaró
      el reporte anterior: el problema no era de visibilidad del error,
      sino que publicar con modalidad "Alquiler" (dejando destildado "Ya
      tiene inquilino asignado") **no se veía en ningún lado** del admin,
      mientras que publicar en "Venta" sí se veía de inmediato en Ventas y
      Carteles.

      Diagnóstico confirmado con los datos reales del usuario: existía una
      propiedad ("depto suiza", ALQUILER, `montoAlquilerVigente: 600000`,
      sin inquilino) que efectivamente se había guardado bien en la base
      y hasta aparecía en `/public/propiedades` (la landing) — pero **no
      figuraba en ninguna pantalla del admin**:
      - Ventas y Carteles la excluye a propósito (`modalidad==='VENTA' ||
        venta != null` — es alquiler sin ficha de venta, no corresponde).
      - Panel General ya no muestra vacantes (se sacaron a pedido del
        usuario en una conversación anterior).
      - Inquilinos y Cobros (`/cobros/mes/:mes`, `/cobros/inquilinos`)
        solo muestra propiedades **con inquilino asignado** — una vacante
        no genera cobro esperado, así que nunca aparecía ahí tampoco.

      Resultado: una vez publicada como alquiler vacante, la única forma de
      volver a verla era reabrir "Publicar propiedad existente" y
      encontrarla de nuevo en el combo — no había ninguna pantalla para
      administrarla (pausarla/publicarla en la web, editar fotos o
      dimensiones, asignarle inquilino más adelante).

      Fix: `InquilinosPage.tsx` (Inquilinos y Cobros) suma una sección
      nueva "PROPIEDADES VACANTES" — deliberadamente separada de "COBROS
      DEL MES" y "FICHAS DE INQUILINOS" (que siguen siendo solo para
      propiedades ocupadas, sin tocar sus cálculos), con una fila
      clickeable por cada `ALQUILER` sin inquilino que muestra el alquiler
      vigente y si está "Publicada en la web" o "Pausada". El clic abre el
      mismo `PropiedadFichaDrawer` que ya se usa desde Panel General — ahí
      ya están todos los controles (✎ Editar datos, 🖼 Fotos, el checkbox
      de "Publicada en la web", "Marcar como vacante"), así que no hizo
      falta construir nada nuevo, solo hacerla alcanzable desde un lugar
      que tenga sentido. Se eligió Inquilinos y Cobros (no Panel General)
      porque el usuario había pedido explícitamente sacar las vacantes de
      ahí — esta es la sección que sí trata específicamente de alquiler.

      Probado con Playwright de punta a punta: publicar una propiedad como
      Alquiler sin inquilino desde Ventas y Carteles → no aparece ahí
      (correcto) → aparece de inmediato en Inquilinos y Cobros →
      "Propiedades Vacantes" con el monto correcto y "Publicada en la web:
      Sí" → el clic abre la ficha con todos los controles esperados. Sin
      errores de consola ni requests fallidos (2026-07-29).

- [x] **Corrección al fix anterior: la propiedad Alquiler-vacante también
      tiene que verse en la propia grilla de Ventas y Carteles, no solo en
      Inquilinos y Cobros** — el usuario dio un paso a paso exacto
      reproduciendo con datos reales ("depto suiza"): crea la propiedad →
      entra a Ventas y Carteles → la publica en modalidad Alquiler → **la
      espera ver ahí mismo, junto a las demás publicadas o pausadas** — no
      en otra pantalla. El fix anterior (sección "Propiedades Vacantes" en
      Inquilinos y Cobros) era válido pero insuficiente: resolvía que la
      propiedad fuera *encontrable en algún lugar*, no que apareciera en la
      pantalla donde el usuario efectivamente la publica y la busca primero.

      Causa raíz exacta: `VentasPage.tsx` arma la grilla ("salegrid") con
      `propiedadesVenta = propiedades.filter(p => p.modalidad === 'VENTA' ||
      p.venta != null)`. Publicar como Alquiler-vacante (a diferencia de
      Venta) **no crea ningún registro `Venta`** — es un flujo enteramente
      distinto (`PATCH /propiedades/:id` + `POST /propiedades/:id/aumentos`).
      Entonces la propiedad no cumple ninguna de las dos condiciones del
      filtro y queda afuera de la grilla, aunque se haya guardado
      perfectamente bien — exactamente el síntoma reportado ("no aparece la
      propiedad con las otras propiedades publicadas o pausadas que se
      muestran ahí").

      Fix: `VentasPage.tsx` — el filtro de la grilla ahora también incluye
      `p.modalidad === 'ALQUILER' && !p.inquilino` (alquiler vacante, con o
      sin "Publicada en la web" tildado, igual que una ficha de venta se
      lista sin importar su flag `publicada`). Como esta propiedad no tiene
      ficha de venta, se renderiza con una tarjeta simplificada propia
      (mismas clases `.salecard`/`.badge` que las demás, para que se vea
      consistente): badge "Alquiler" + "Publicada"/"Pausada", el monto de
      alquiler vigente en vez de precio, propietario, y un único botón
      "✎ Editar ficha" que abre el `PropiedadFichaDrawer` ya existente (el
      mismo que usa Inquilinos y Cobros) en vez del `SaleModal` de venta —
      editar una ficha de venta inexistente no tendría sentido para una
      propiedad que no está en venta. La sección "Propiedades Vacantes" de
      Inquilinos y Cobros del fix anterior se deja como está (sigue siendo
      útil desde esa pantalla), esto la complementa.

      Probado con Playwright reproduciendo el paso a paso literal del
      usuario con datos frescos ("TEST Depto Suiza Grid"): crear la
      propiedad → Ventas y Carteles → "+ Publicar propiedad existente" →
      modalidad Alquiler → completar monto → Publicar → la tarjeta aparece
      de inmediato en la misma grilla con "$300.000 ARS/mes" y badge
      "Publicada" → "Editar ficha" abre el drawer completo. Sin errores de
      consola ni requests fallidos (2026-07-29).

- [x] **Bug real: borrar una Incidencia dejaba un Gasto huérfano que restaba
      de la ganancia de la inmobiliaria para siempre, sin ninguna pantalla
      desde donde corregirlo** — el usuario reportó que borró "de la caja"
      las incidencias que había pagado la inmobiliaria, y la ganancia del
      mes seguía en -70000 en vez de volver a 0.

      Causa raíz: `resolver()` una incidencia con costo y
      `quienPagaCosto: 'INMOBILIARIA'` genera un `Gasto` (destino
      INMOBILIARIA) vía `crearDesdeIncidencia()` — y por diseño **ese gasto
      nunca genera su propio movimiento en Caja** (el único egreso real de
      caja es el pago al proveedor, para no duplicar el egreso). El
      `gananciaPesos` de `caja.service.ts::kpisDelMes()` resta este `Gasto`
      consultando la tabla `Gasto` directamente, sin pasar por Caja.
      `Gasto.incidenciaId` tiene `onDelete: SetNull` (`schema.prisma`), así
      que borrar la Incidencia (`incidencias.service.ts::remove()`, antes
      un `prisma.incidencia.delete()` sin más) no borraba el gasto — sólo le
      vaciaba `incidenciaId`, dejándolo huérfano: invisible en Incidencias
      (ya no existe la incidencia), invisible en Caja (nunca tuvo
      movimiento propio), y como además `destino: INMOBILIARIA` no es un
      valor elegible desde ningún formulario manual de Gastos (sólo
      `PROPIETARIO`/`INQUILINO`), tampoco había forma de encontrarlo y
      corregirlo por ahí. Confirmado con los datos reales del usuario: dos
      gastos huérfanos exactos (`$40.000` + `$30.000` = `$70.000`,
      `incidenciaId: null`, `movimientoCajaId: null`, `destino:
      INMOBILIARIA`) — el origen del -70000 reportado.

      Fix: `incidencias.service.ts::remove()` ahora borra en la misma
      transacción el `Gasto` vinculado a la incidencia (y su movimiento de
      Caja, si alguna vez lo tuviera) antes de borrar la incidencia, en vez
      de dejar que el `SetNull` de la FK lo abandone. Además se limpiaron a
      mano los dos gastos huérfanos ya existentes en la base para que la
      ganancia del usuario volviera a su valor real de inmediato.

      Probado con la API real: resolver una incidencia de prueba con costo
      $15.000 a cargo de la inmobiliaria bajó `gananciaPesos` exactamente
      $15.000 respecto de la base (`2040` → `-12960`); borrar esa incidencia
      devolvió `gananciaPesos` a `2040` exacto — sin gasto huérfano
      remanente (2026-07-29).

## Cómo actualizar este archivo

Cada vez que se implemente una conexión: marcarla `[x]`, agregar la fecha y
el archivo (service/controller) donde vive la lógica, por ejemplo:

```
- [x] Registrar pago → INGRESO automático en Caja — `api/src/cobros/cobros.service.ts::registrarPago()` (2026-07-25)
```

Si una conexión se implementa parcialmente (ej. se modela en la DB pero
falta el trigger de negocio), usar `[~]` y anotar qué falta.
