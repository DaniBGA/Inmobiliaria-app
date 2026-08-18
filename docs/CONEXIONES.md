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

- [x] Contrato → próximo aumento = día 1 del mes en que corresponde el
      próximo aumento, contando solo meses **completos** al precio vigente —
      `api/src/propiedades/propiedades.service.ts::proximoAumento()`
      (2026-07-22; **corregido dos veces el 2026-07-30**:
      1) la versión original hacía `ultimo.fecha.setMonth(+frecuencia)`,
      que conservaba el día-de-mes original en vez de normalizar a "01" y
      además sufría overflow en meses cortos (31-ene + 1 mes daba 3-mar).
      2) la primera corrección (`Date.UTC(año, mesUltimo + frecuencia, 1)`)
      seguía mal si el contrato/último aumento no arrancaba el día 1: un
      contrato desde el 27/07 con frecuencia trimestral daba 01/10, pero
      julio es un mes *parcial* (solo del 27 al 31) y no cuenta como uno
      de los 3 meses completos al precio viejo — los 3 meses completos son
      ago-sep-oct, y el aumento recién entra en vigencia el 01/11. Caso
      real reportado por el usuario desde la ficha de un alquiler.
      Fórmula final: si `ultimo.fecha` no cae el día 1, se suma un mes
      extra antes de tomar el día 1 (`mesesAAgregar = frecuencia + (dia===1
      ? 0 : 1)`). Verificado con 4 casos vía API: 27-jul trimestral →
      01-nov (caso real del usuario), 01-ene trimestral (día 1 exacto) →
      01-abr, 31-ene cuatrimestral → 01-jun, 15-jul mensual → 01-sep.
      Avisos y Agenda reusan esta misma función, así que heredan la
      corrección sin cambios propios. **Regla reemplazada 2026-08-18, ver
      más abajo (§3.6, antes de "Ventas") — el usuario pidió lo contrario:
      que el mes de inicio SIEMPRE cuente como completo, sin importar el
      día.** El ejemplo "27-jul trimestral → 01-nov" de este párrafo ya NO
      es el comportamiento actual (ahora da 01-oct); se deja el texto
      original acá para que quede el historial de la decisión previa.)
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
- [x] "Nueva incidencia" con proveedor ya asignado desde el alta → también
      pide la fecha de visita ahí mismo (antes solo se podía cargar al
      asignar/reasignar proveedor por separado, vía `AsignarProveedorModal`)
      — `CreateIncidenciaDto.fechaEjecucion` (opcional, `@IsDateString`),
      `IncidenciasService.crear()` usa `dto.fechaEjecucion ?? hoy` en vez de
      siempre hoy cuando `proveedorId` está presente; en
      `IncidenciasPage.tsx`, el campo "Fecha de visita / ejecución" del
      modal de alta aparece condicionalmente en cuanto se elige un proveedor
      (existente o nuevo), igual que en `AsignarProveedorModal`. Como
      `AgendaService.eventosDelMes()` ya leía `fechaEjecucion` de cualquier
      incidencia EN_CURSO para el evento automático "Ejecución agendada",
      esta fecha cargada en el alta aparece sola en Agenda sin tocar nada
      del lado de Agenda (2026-07-30).

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

- [x] **2026-07-30, pedido del usuario: liquidación editable antes de emitir
      + "gastos absorbidos" itemizado por incidencia.** Antes, `generar()`
      calculaba y persistía todo en un solo paso (auto-disparado al abrir el
      modal, sin ningún ítem tocable), y "gastos absorbidos" era un único
      Decimal sin desglose — la ficha nunca decía CUÁL incidencia se había
      absorbido, solo un monto suelto.
      - **Editable**: `LiquidacionesService` se separó en
        `calcularDetalle()` (privado, computa todo — cobrado de la factura
        del mes o predeterminados, gastos, honorarios — acepta un
        `overridePorPropiedad` opcional), `previsualizar()` (lo llama sin
        override, no persiste nada — nuevo `GET
        /liquidaciones/propietarios/:id/:mes/preview`, mismo rol que
        `itemsPredeterminados()` para Facturas) y `generar()` (acepta
        `detalle?: { propiedadId, items }[]` opcional en el body — si se
        manda, esos ítems reemplazan a los de la factura/predeterminados
        solo para el cálculo de `cobradoTotal` y de la base de honorarios;
        si no se manda, el comportamiento es idéntico al de antes).
        `PropietariosPage.tsx::LiquidacionModal` ahora hace GET al
        `/preview` al abrir (sin persistir), muestra el lado "Cobrado" de
        cada propiedad como lista editable (`+ Agregar item`, cambiar
        descripción/monto, input "Liq" numérico igual al de Facturas —
        mismo campo `numeroLiquidacion`, mismo filtro `.replace(/\D/g,
        '')`) y recalcula honorarios/neto en vivo con la misma fórmula que
        el backend (`porcentajeHonorarios` resuelto viaja en la respuesta
        del preview solo para esto, no se persiste). Al tocar "Emitir
        liquidación" recién ahí se llama `POST .../:mes` con el `detalle`
        editado. **A propósito no se hizo editable**: "Gastos absorbidos"
        y los honorarios en sí — siguen saliendo siempre de
        Incidencias/Gastos reales y del % configurado en la propiedad
        (decisión explícita del usuario al elegir el alcance, para no
        desincronizar la liquidación de esos módulos).
      - **Itemizado por incidencia**: se agregó el modelo `LiquidacionGasto`
        (mismo patrón que `LiquidacionItem`, migración puramente aditiva
        `20260730082321_liquidacion_gastos_detalle`) que guarda cada gasto
        con destino PROPIETARIO de ese mes con su propia `descripcion` (que
        ya es el título de la incidencia que lo originó —
        `incidencias.service.ts::resolver()` crea el Gasto con
        `descripcion: incidencia.titulo`) y `monto`, en vez de solo la suma.
        `PropietariosPage.tsx` reemplazó la línea genérica "↳ Gastos
        absorbidos" por una línea por cada gasto real (`↳ {descripcion}`),
        tanto en la vista previa editable como en la liquidación ya
        emitida.
      - Migración de schema previa relacionada: se hizo con
        `Cartel.tipoCartel` primero (bugfix anterior de esta misma sesión,
        no relacionado a esta entrada) — mencionado acá solo porque ambas
        requirieron parar el backend (`start:dev`) antes de correr
        `prisma migrate dev`/`generate` (el motor de Prisma en Windows
        bloquea su propio `.dll` mientras el proceso está corriendo).
      Probado con Playwright de punta a punta con datos de prueba (`TEST
      Propietario Liq` / `TEST Depto Liquidacion`, una incidencia real
      resuelta con costo a cargo del propietario): la vista previa muestra
      "TEST Reparación de bomba de agua" en vez de "Gastos absorbidos"
      genérico; editar Alquiler a 350000 y agregar un ítem manual de 5000
      con Liq N° 99 actualiza el total en vivo a $289.000 (350000 + 5000 −
      45000 de gasto − 21000 de honorarios = 289000, verificado);
      "Emitir liquidación" persiste exactamente esos valores y los
      muestra en la vista final. `tsc --noEmit` limpio en `app/api/` y
      `admin/`. Datos de prueba limpiados al terminar.

## 3.5 Factura y recibo al inquilino

- [x] Factura se prellena con ítems predeterminados en este orden: Alquiler
      (valor vigente), Expensas, Usina, Camuzzi, Obras Sanitarias,
      Retributivas de Servicios — + gastos trasladados (destino INQUILINO)
      + "Deuda arrastrada" si corresponde —
      `api/src/facturacion/facturas.service.ts::itemsPredeterminados()`
      (2026-07-22, probado: incluyó correctamente Alquiler 100000 y un gasto
      trasladado de 8000). ~~Falta: número de liquidación como campo propio
      de Usina/Camuzzi ya modelado en `FacturaItem.numeroLiquidacion`, falta
      probarlo desde el frontend.~~ **Resuelto 2026-07-30**: pedido
      explícito del usuario — se agregó un input "Liq" (numérico, filtra
      cualquier caracter no dígito con `.replace(/\D/g, '')`) al lado del
      monto de **cada** ítem de la factura en `FacturaModal`
      (`PropiedadFichaDrawer.tsx`), no solo Usina/Camuzzi — el campo ya
      existía en el modelo para cualquier ítem, así que no tenía sentido
      limitar la UI a dos casos. Se guarda en `FacturaItem.numeroLiquidacion`
      al emitir (el DTO y `emitir()` ya lo aceptaban desde antes, solo
      faltaba la UI) y se muestra en la vista de factura ya emitida como
      "· Liq N° X" junto a la descripción. No se agregó carry-forward de
      este campo entre meses (a diferencia del monto) porque el número de
      liquidación de un servicio cambia mes a mes — cargarlo de nuevo cada
      vez es lo esperado.
      Probado con Playwright sobre una propiedad real (`asdawdawd`):
      aparecen 6 inputs "Liq", uno por ítem; escribir "AB1234cd" en el de
      Expensas queda filtrado a "1234"; al emitir, la factura muestra
      "Expensas del mes · Liq N° 1234". **Nota de higiene de datos**: este
      test emitió una factura real para el mes en curso sobre una
      propiedad que no es de prueba (nombre `asdawdawd`, no tiene prefijo
      `TEST`) — se la volvió a emitir de inmediato con los mismos montos
      pero sin el "1234" de prueba para no dejar ese residuo, pero el
      número de factura avanzó (de 32 a 33) y si había una factura previa
      real de julio para esa propiedad, sus montos no se pudieron
      recuperar (no se guardó copia antes de sobreescribirla). Avisar al
      usuario.
      **Corregido 2026-07-30**: el ítem "Alquiler" (y, por la misma causa,
      el "esperado" de Cobros/Deuda en `cobros.service.ts`) daba 0/null
      cada vez que se facturaba el MISMO mes en que arrancó el contrato con
      un día distinto al 1 (lo normal) — `rentaVigente()` comparaba
      `historialAumento.fecha <= mesStringAFecha(mes)` y `mesStringAFecha`
      siempre da el día 1, así que un contrato iniciado, p. ej., el 27
      quedaba "después" del punto de referencia del mes y no se encontraba
      ningún alquiler vigente. Se agregó `finDeMes()` en
      `api/src/common/fecha.util.ts` y se lo usa como referencia en vez del
      día 1 en `itemsPredeterminados()`, `resumenMes()`, `deudaAcumulada()`
      y `mesesPendientes()` — así un alquiler o aumento cargado cualquier
      día del mes cuenta para todo ese mes. Verificado por API: propiedad
      con contrato iniciado "hoy" (día 30) → Alquiler = 250000 (antes daba
      0) en el mes actual, y el mes siguiente arrastra correctamente los
      montos de servicios de la factura anterior.
- [x] Membrete de la inmobiliaria en la factura impresa/PDF — pedido
      explícito del usuario, que adjuntó una hoja membretada real de
      "Facundo París Propiedades" como referencia exacta a calcar. Se
      agregó markup nuevo dentro del bloque `F && (...)` (factura ya
      emitida) de `FacturaModal` (`PropiedadFichaDrawer.tsx`), visible
      **solo al imprimir** (clase `printonly`, `display:none` en pantalla,
      reabierta dentro de `@media print` en `global.css`) para no ensuciar
      la vista en pantalla del modal:
      - Encabezado (`.comp-membrete`): logo completo (`LOGO PNG.-02`,
        wordmark + isotipo) + dirección y contacto de la inmobiliaria,
        separado por una regla horizontal — igual que la hoja de
        referencia.
      - Marca de agua (`.comp-marcaagua`): el isotipo solo (`LOGO
        PNG.-10`), `opacity:.05`, tamaño grande, posicionado detrás del
        contenido (`z-index:0` vs. `z-index:1` en membrete/cuerpo/pie).
      - Matrícula: franja de texto vertical fija sobre el margen derecho
        de la hoja (`writing-mode:vertical-rl`), tomada de
        `Configuracion.publicoMatricula` (mismo campo que ya alimentaba la
        landing page, reutilizado acá — es el mismo dato real en ambos
        lados, no tenía sentido duplicarlo).
      - Pie (`.comp-pie`): logo chico + dirección centrada + contacto,
        con una regla horizontal arriba, igual disposición que la hoja de
        referencia.
      Los dos logos se copiaron de `app/src/logos/` (donde viven para la
      landing) a `admin/src/images/logo-comprobante.png` y
      `logo-marca-agua.png` — son proyectos Vite separados, sin resolución
      de módulos cruzada entre ellos.
      Los datos de encabezado/pie salen de `Configuracion.empresaNombre/
      empresaDireccion/empresaContacto` — campos que ya existían
      ("encabezan todos los comprobantes que se imprimen", comentario
      propio del schema) pero estaban vacíos en la base real; se
      completaron con los datos reales de la hoja membretada que mandó el
      usuario (dirección, los dos teléfonos + "Administraciones", email) vía
      una actualización directa en la fila singleton de `Configuracion`,
      editable después desde Configuración → "DATOS FISCALES" como
      cualquier otro dato de la empresa.
      **Nota de implementación de CSS**: `.printonly{display:none}` tiene
      que declararse ANTES del bloque `@media print` en el archivo — a
      igual especificidad, en cascada gana la regla que aparece después en
      el archivo, y `@media print{ .printonly{display:block} }` necesita
      ser esa última regla para poder reabrir el elemento al imprimir sin
      que la versión "siempre oculto" la vuelva a tapar.
      **Extendido el mismo día (2026-07-30, pedido de seguimiento)**: el
      "alcance: solo Factura" de arriba quedó corto — el usuario pidió el
      mismo membrete también para la Liquidación de Propietarios. Como ya
      había dos lugares reales usándolo, se sacó el membrete de
      `FacturaModal` a un componente compartido nuevo,
      `admin/src/components/ComprobanteImpreso.tsx` (`<ComprobanteImpreso
      cfg={...}>{contenido facturado}</ComprobanteImpreso>`, con
      encabezado/marca de agua/matrícula/pie adentro), y `LiquidacionModal`
      (`PropietariosPage.tsx`) ahora lo envuelve igual que Factura — mismo
      `useQuery(['configuracion'])` agregado ahí (antes esa página no
      consultaba Configuración para nada). Recibo sigue sin membrete, no
      pedido todavía.
      También en el mismo pedido: la marca de agua se agrandó bastante
      (`width:320px`→`600px`) y pasó de `position:absolute` (dentro del
      flujo de `.comprobante`) a `position:fixed` centrada verticalmente
      (`top:50%;transform:translateY(-50%)`) — mismo criterio que ya usaba
      la matrícula y ahora también el pie, para que quede centrada en la
      hoja sin importar cuánto contenido tenga el comprobante arriba.
- [x] Botón de WhatsApp junto a "Imprimir" en Factura y Liquidación —
      mismo pedido de seguimiento, implementado en dos pasadas:
      1. **Primera versión (corregida el mismo día)**: mandaba solo un
         mensaje de texto prearmado vía `https://wa.me/<teléfono>?text=...`
         con el detalle completo del comprobante. El usuario aclaró que
         eso no era lo que pedía — quería el **PDF real** adjunto, no un
         resumen en texto.
      2. **Corrección**: WhatsApp click-to-chat (`wa.me`) no soporta
         adjuntar archivos de ningún modo — esa es una limitación real del
         protocolo, no algo que faltara conectar. Mandar el PDF 100%
         automático requeriría dar de alta WhatsApp Business API con Meta
         (verificación de número, plantillas aprobadas, costo por
         mensaje) — un proyecto de integración aparte. Se le preguntó al
         usuario cómo prefería resolverlo con lo que hay disponible ahora
         y eligió: **generar el PDF real, descargarlo automáticamente, y
         abrir WhatsApp con el chat correcto ya abierto** para adjuntarlo
         a mano (un paso manual, pero sin cuentas ni costos nuevos).
      Implementado con `jspdf` + `html2canvas` (dependencias nuevas,
      `admin/package.json`) en `admin/src/lib/pdfComprobante.ts::
      descargarPdfComprobante(nodo, nombreArchivo)`: clona el nodo
      `.comprobante` (el mismo que arma `<ComprobanteImpreso>` para
      `@media print`) fuera de pantalla, fuerza visible SOLO en el clon el
      membrete/marca de agua/matrícula/pie (normalmente `display:none`
      fuera de impresión) y convierte sus `position:fixed` (pensados para
      pegarse al borde de la hoja física real al imprimir) a `absolute`
      relativo a `.comprobante` — tiene sentido distinto capturar un nodo
      suelto con html2canvas que imprimir una página real. Rasteriza con
      html2canvas, corta en páginas A4 con jsPDF si el contenido es largo,
      y dispara la descarga (`pdf.save(...)`). `ComprobanteImpreso` ahora
      expone su nodo raíz vía `forwardRef` para que ambos modales puedan
      agarrarlo. El botón (`onClick` async) muestra "Generando PDF…"
      mientras rasteriza, y al terminar abre `wa.me` con un texto corto
      pidiendo adjuntar el PDF ya descargado (ya no manda el desglose
      completo en texto — ahora vive en el PDF).
      El botón sigue siendo condicional — solo aparece si el inquilino
      (Factura) o el propietario (Liquidación) tienen `telefono` cargado,
      igual criterio que el botón de WhatsApp de Proveedores.
      **Dato real**: en la base de producción, ningún propietario tiene
      `telefono` cargado todavía (2 inquilinos sí: "Juan alpaca" y "luis
      tolosa") — el botón de Liquidación no le va a aparecer al usuario
      hasta que cargue teléfonos de propietarios; no es un bug.
      **Dos bugs reales encontrados y corregidos al verificar con
      Playwright (no en la primera pasada de código, en la prueba real):**
      1. El PDF pesaba **10-11 MB** cada uno — `html2canvas` a `scale:2` +
         `canvas.toDataURL('image/png')` (sin pérdida) sobre una página con
         texto y degradados no comprime bien. Se bajó a `scale:1.5` +
         `image/jpeg` calidad `.92` (fondo opaco vía
         `backgroundColor:'#ffffff'`, JPEG no soporta transparencia) →
         **~118 KB**, sin pérdida de nitidez visible en el texto.
      2. El logo del membrete y del pie (`.comp-logo`/`.comp-pielogo`) se
         renderizaban a su tamaño nativo (1088×414px), desbordando toda la
         página — su tamaño (`height:52px`/`26px`) vivía solo dentro de
         `@media print`, que nunca se aplica al clon fuera de pantalla que
         captura `html2canvas`. Se agregó el mismo ajuste explícito en
         `descargarPdfComprobante()` que ya se hacía para
         membrete/pie/marca de agua/matrícula. Verificado de nuevo tras el
         fix: logos correctamente chicos, 63-118 KB según el comprobante.
      Nota cosmética menor detectada en la última verificación: el texto
      vertical de la matrícula queda levemente pegado al borde derecho de
      la página en el PDF (no en la impresión real vía navegador) — no se
      tocó, es un detalle menor y no afecta la legibilidad del resto.
- [x] Editar Datos (ficha de propiedad) incluye los campos nuevos de
      dormitorios, cochera, superficie cubierta y descripción —
      `admin/src/components/PropiedadFichaDrawer.tsx::EditarDatosGeneralesModal`
      (2026-07-30; antes solo tenía ambientes/baños/superficie total, así
      que una propiedad cargada con estos datos nuevos en "Agregar
      Propiedad" no tenía forma de editarlos después). Probado con
      Playwright: los 4 campos aparecen y quedan precargados con los
      valores reales de la propiedad.
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
- [x] **2026-08-15, pedido del usuario: qué "datos de cuenta" se piden por
      servicio, invertido.** Antes Obras Sanitarias pedía Usuario + N° de
      cuenta y Usina (Luz) solo N° de cuenta; el usuario pidió que sea al
      revés — Luz con Usuario + N° de control, Obras Sanitarias solo N° de
      cuenta. Se agregó el campo nuevo `Propiedad.usinaUsuario` (migración
      aditiva `20260815174319_propiedad_usina_usuario`) y se dejó de usar
      `Propiedad.obrasSanitariasUsuario` en código (DTO, servicio de
      facturación, ambos formularios del admin) — la columna sigue en la
      base sin borrarse para no perder datos ya cargados en propiedades
      reales, pero no se lee ni se escribe más. `ServiciosCuentaInputs.tsx`
      (componente compartido por `PropiedadFichaDrawer.tsx` y
      `AgregarPropiedadPage.tsx`) ahora muestra "Luz — Usuario" + "Luz — N°
      de control" cuando el servicio USINA está tildado, y solo "Agua — N°
      de cuenta" para OBRAS_SANITARIAS. `FacturasService::datosCuentaSuffix()`
      (`facturas.service.ts`) refleja el mismo cambio en la descripción del
      ítem de factura. `tsc --noEmit` limpio en `app/api/` y `admin/` tras
      el cambio.
- [x] **2026-08-18, pedido del usuario: los centavos no se mostraban en
      ningún monto del admin (facturas, liquidaciones, cobros, caja...) —
      se redondeaban para arriba o para abajo.** Causa: `formatMoney()` /
      `formatUsd()` (`admin/src/lib/format.ts`), la función de formato de
      moneda compartida por prácticamente toda la UI del admin (factura y
      recibo en `PropiedadFichaDrawer.tsx`, liquidación en
      `LiquidacionComprobante.tsx`/`PropietariosPage.tsx`, Cobros, Caja,
      Ventas, Incidencias, Avisos, Dashboard, Clientes, Configuración),
      usaba `toLocaleString('es-AR', { maximumFractionDigits: 0 })` — eso
      descarta cualquier centavo al mostrarlo, redondeando al peso entero
      más cercano. Se cambió a `maximumFractionDigits: 2` sin
      `minimumFractionDigits` (no `{ minimumFractionDigits: 2,
      maximumFractionDigits: 2 }`) para que un monto redondo siga
      mostrándose limpio ("$ 500.000", sin ",00" de más) y uno con
      centavos los muestre ("$ 500.000,5", "$ 108.500,25"). Mismo fix en
      el formateador de EUR de `CajaPage.tsx` (estaba duplicado en vez de
      usar la función compartida, con el mismo `maximumFractionDigits: 0`).
      Los `<input type="number">` de montos ya tenían `step="0.01"` en
      todos los formularios relevantes (ítems de factura, aumento,
      honorarios, gasto) — el problema era pura visualización, no carga de
      datos ni cálculo; el backend ya generaba los montos en los textos de
      Avisos con centavos correctamente (`avisos.service.ts::formatMoney()`
      interno, sin tocar). Como los comprobantes en PDF
      (`pdfComprobante.ts::descargarPdfComprobante()`) rasterizan el mismo
      DOM que se ve en pantalla, el fix se propaga solo a Factura, Recibo y
      Liquidación en PDF sin tocar ese archivo. **No se tocó**
      `app/src/lib/format.ts` (formateador de moneda de la landing
      pública) — ahí sí tiene sentido redondear precios de catálogo, y el
      pedido era sobre "facturas... liquidación... en todo [el admin]", no
      sobre los precios públicos de propiedades. `tsc --noEmit` limpio en
      `admin/`.
- [x] **2026-08-18, pedido del usuario: "Editar Inquilino" (desde la ficha
      de una propiedad ya alquilada) no ofrecía el checkbox "Se encuentra
      al día", solo disponible antes al dar de alta el contrato desde
      `AlquilarPropiedadModal`.** El backend ya soportaba esto de punta a
      punta — `UpsertInquilinoDto.alDia` y
      `PropiedadesService.upsertInquilino()` (`propiedades.service.ts:212`)
      ya distinguían "`alDia` ausente → no tocar `alDiaDesde`" de
      "`alDia` presente → fijarlo a hoy o limpiarlo" — pero
      `EditarInquilinoModal` (`PropiedadFichaDrawer.tsx`) nunca lo
      exponía. Se agregó el mismo checkbox ("Se encuentra al día — ya
      alquilaba y pagaba por fuera del sistema") al formulario de edición,
      con la nota explicativa condicional igual que en el alta. Cuidado
      importante: el checkbox arranca reflejando `inquilino.alDiaDesde !=
      null` (no siempre destildado como en el alta) y **solo se manda
      `alDia` en el PATCH si el usuario lo tocó** (comparado contra ese
      valor inicial) — mandarlo siempre pisaría la fecha real ya guardada
      con la de hoy cada vez que alguien edita solo el teléfono o el
      email, sin querer tocar este campo (el propio comentario del
      backend ya advertía este riesgo). Se agregó `alDiaDesde` a la
      interfaz `Inquilino` del frontend (no estaba tipado, aunque el
      backend ya lo devolvía siempre vía `include: { inquilino: true }`).
      Probado con curl end-to-end: crear inquilino sin al-día → editar
      teléfono sin tocar el checkbox mantiene `alDiaDesde: null` → tildar
      lo fija al primer día del mes actual → editar teléfono de nuevo sin
      tocar el checkbox lo mantiene sin pisarlo → destildarlo lo vuelve a
      `null`. `tsc --noEmit` limpio en `admin/`. Dato de prueba limpiado.
- [x] **2026-08-18, bug estructural reportado por el usuario: causa raíz
      del mismo mecanismo detectado antes en "depto lukens" (más arriba,
      §3.1) — pero acá reproducible por diseño, no un accidente de carga.**
      `PropiedadesService.create()` (`propiedades.service.ts:50`), cuando
      recibía `montoAlquilerInicial` sin `fechaAlquilerInicial` ni
      `contratoInicio`, creaba igual un `HistorialAumento` con fallback a
      "hoy". `AgregarPropiedadPage.tsx` (alta de propiedad) nunca manda
      ninguna de esas dos fechas — ahí "Monto de alquiler inicial" es el
      precio de publicación de una propiedad todavía vacante, sin contrato
      real. Resultado: **toda** propiedad cargada con ese campo lleno
      quedaba con un aumento fantasma fechado el día de carga. Si después
      se le asignaba un inquilino con un contrato viejo (fecha real vía
      `AlquilarPropiedadModal`, que registra su propio aumento aparte con
      `contratoInicio`), el fantasma "de hoy" — por ser más reciente —
      ganaba como ancla de `proximoAumento()`/`rentaVigente()`
      (`propiedadesService.rentaVigente()`/`proximoAumento()` siempre
      anclan en el aumento con `fecha` más reciente) y corría mal el
      cálculo, exactamente el mismo síntoma que "depto lukens".
      **Fix**: el `HistorialAumento` inicial ahora solo se crea en
      `create()` si vino una fecha real (`fechaAlquilerInicial` o
      `contratoInicio`) — nunca con fallback a la fecha de carga. Una
      propiedad recién agregada sin contrato queda con
      `montoAlquilerVigente` seteado (para que la ficha/tarjeta muestre el
      precio de publicación) pero **sin ningún `HistorialAumento`** — el
      historial real de esa propiedad recién arranca cuando se le asigna
      el primer inquilino (`AlquilarPropiedadModal`, que ya registraba su
      propio aumento correctamente con la fecha real del contrato).
      Probado con curl reproduciendo el escenario exacto: crear propiedad
      con monto pero sin fecha → `historialAumentos: []` (antes quedaba
      con un aumento fantasma) → asignar contrato viejo (01/02/2026,
      trimestral) vía el mismo flujo que `AlquilarPropiedadModal` → queda
      un solo aumento real (01/02/2026) → `próximoAumento` da 01/05/2026
      correcto. `tsc --noEmit` limpio en `app/api/`. Dato de prueba
      limpiado.
      **Dato sucio pendiente en propiedades reales** (mismo mecanismo,
      previo a este fix): `Local1` y `depto santander` (ver §3.1 para
      `depto lukens`, ya corregida) tienen aumentos fechados el día de
      carga (29/07) en vez de sus `contratoInicio` reales (30/07 y 24/07)
      — no se tocaron todavía, el usuario prefiere revisarlas él mismo
      antes de que se borren/corrijan.
- [x] **2026-08-18, cambio de regla de negocio pedido por el usuario (con
      confirmación explícita del trade-off): el mes en que arranca un
      contrato/aumento AHORA SIEMPRE cuenta como el primero de los
      `frecuenciaAumentoMeses` completos, sin importar qué día del mes
      haya sido.** Reemplaza la regla de "mes parcial" del 2026-07-30
      (§3.1 arriba) — con la regla vieja, un contrato desde el 27/07
      trimestral daba 01/11 (julio no contaba, ago-sep-oct eran los 3
      meses); el usuario reportó que probando con 03/08 trimestral el
      sistema daba 01/12 y esperaba 01/11. Se le explicó la contradicción
      directa con el caso real del 27/07 (que había sido confirmado
      explícitamente en su momento) y se le preguntó cuál de las dos
      reglas quería — eligió "siempre cuenta como completo", aceptando
      que el caso del 27/07 pase a dar 01/10 en vez de 01/11.
      `PropiedadesService.proximoAumento()` (`propiedades.service.ts:164`)
      simplificado: se sacó el cálculo de `mesParcial` (que sumaba un mes
      extra si `anclaFecha.getUTCDate() !== 1`), ahora `mesesAAgregar` es
      directamente `frecuenciaAumentoMeses`. Sigue usando componentes
      año/mes vía `Date.UTC` (no `setMonth`) para no sufrir overflow en
      meses cortos. Avisos y Agenda heredan el cambio sin tocarlos (reusan
      la misma función). Probado con curl, 4 casos: 03-08 trimestral →
      01-11 (el caso reportado, ahora correcto), 27-07 trimestral → 01-10
      (cambio intencional respecto al comportamiento anterior), 01-08
      trimestral → 01-11 (día 1 exacto, sin cambios), 31-01 cuatrimestral
      → 01-05 (mes corto, sin overflow). `tsc --noEmit` limpio en
      `app/api/`. Datos de prueba limpiados.
      **Nota**: esto no corrige retroactivamente ninguna propiedad ya
      cargada — el cálculo se hace en el momento de consultar, así que
      toda propiedad con `frecuenciaAumentoMeses` y `contratoInicio`
      cargados ya refleja la regla nueva la próxima vez que se consulte su
      ficha, sin necesidad de tocar datos.

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

- [x] **2026-07-30, pedido del usuario: propietario nuevo → también Cliente,
      y "Origen" pasa de texto libre a gráfico de torta.**
      - **`Cliente.origen` es ahora un enum fijo `OrigenCliente`**
        (`INSTAGRAM`, `PAGINA_WEB`, `EN_PERSONA`, `FACEBOOK`, `CONTACTOS`),
        antes `String?` de texto libre — migración
        `20260730084820_cliente_origen_enum` mapea los valores libres reales
        que había en la base ("Portal web" → `PAGINA_WEB`) en vez de
        perderlos. De paso se encontró y corrigió `public.controller.ts`
        (el alta de Cliente desde el formulario de contacto de la landing
        pública) que mandaba `origen: 'Landing web'` como string suelto —
        ahora manda `OrigenCliente.PAGINA_WEB` (la landing **es** la página
        web de la inmobiliaria, mismo balde).
      - **`GET /clientes/stats-por-origen`** (reemplaza a `GET
        /clientes/kpis`, que se eliminó por completo — sin otros usos)
        devuelve las 5 categorías siempre, incluso en 0, para que el
        gráfico y su leyenda no cambien de forma según los datos
        (`ClientesService.statsPorOrigen()`, `groupBy` sobre `origen`).
      - **`ClientesPage.tsx`**: los 4 recuadros KPI (Total/Buscan
        alquilar/Buscan comprar/Sin contactar) se reemplazaron por un
        panel "ORIGEN DE LOS CLIENTES" con un gráfico de torta nuevo
        (`admin/src/components/charts/MultiDonut.tsx` — generalización de
        `MiniDonut.tsx` de 2 a N porciones, misma técnica de
        `stroke-dasharray`/`stroke-dashoffset` acumulado) + leyenda con el
        conteo real de cada categoría. El selector "Origen" del modal de
        alta/edición de cliente pasó de `<input>` libre a `<select>` con
        las 5 opciones.
      - **`AgregarPropiedadPage.tsx`**: al cargar un propietario **nuevo**
        (no uno ya existente elegido de la lista), ahora también se crea un
        `Cliente` (`tipoOperacion: VENDER` → aparece en Clientes con el
        badge "PROPIETARIO", `estado: EN_SEGUIMIENTO` — no
        `SIN_CONTACTAR`, porque ya tiene una relación activa con la
        inmobiliaria, a diferencia de un lead frío). Se agregó un select
        "Origen del propietario nuevo" (mismas 5 opciones) que solo
        aparece cuando se está tipeando un nombre nuevo, y pasó a ser
        **obligatorio** en ese caso — sin elegir origen, "Guardar
        propiedad" queda deshabilitado — para que ningún cliente nuevo
        entre sin poder clasificarse en el gráfico.
      Probado con Playwright de punta a punta: el gráfico muestra
      correctamente los 2 clientes reales existentes (migrados a "Página
      web"); crear una propiedad con propietario nuevo "TEST Propietario
      Origen E2E" + origen "Facebook" → el botón de guardar queda
      deshabilitado hasta elegir origen → al guardar, aparece un Cliente
      nuevo con `tipoOperacion: VENDER`, `estado: EN_SEGUIMIENTO`,
      `origen: FACEBOOK`, y `stats-por-origen` refleja el conteo
      actualizado de inmediato. Cero errores de consola, `tsc --noEmit`
      limpio en `app/api/` y `admin/`. Datos de prueba limpiados.
- [x] Backfill de datos reales: el propietario "Juan salomon" existía desde
      antes de que se implementara "propietario nuevo → también Cliente"
      (arriba) y por eso no tenía Cliente asociado — el usuario lo detectó
      porque no aparecía en la sección Clientes. Se insertó manualmente el
      `Cliente` faltante (`tipoOperacion: VENDER`, `estado: EN_SEGUIMIENTO`,
      `origen: EN_PERSONA` — confirmado con el usuario, no inventado) para
      que quede igual de completo que si se hubiera creado con la
      funcionalidad nueva desde el principio (2026-07-30).
- [x] **2026-08-15, pedido del usuario: modal de edición de Cliente
      simplificado cuando el tipo es "Propietario / quiere vender".** No
      existe un enum `PROPIETARIO` — es la etiqueta de UI para
      `tipoOperacion === 'VENDER'` (`TIPO_LABEL` en `ClientesPage.tsx`). En
      `ClienteModal` (`admin/src/pages/ClientesPage.tsx`), cuando
      `tipoOperacion === 'VENDER'` el formulario ahora solo muestra Nombre,
      Teléfono, Email y el selector de Tipo (para poder recategorizarlo) —
      se ocultan Estado, Origen, Tipo de propiedad que busca, Zona,
      Presupuesto desde/hasta, Delegado, Detalle, Visita con otra
      inmobiliaria y Notas (siguen teniendo sus campos internos con el
      valor que ya tenían, solo se les deja de mostrar el input; no se
      limpian al ocultarlos). `tsc --noEmit` limpio en `admin/` tras el
      cambio.
      **Extendido el mismo día (seguimiento inmediato del usuario, que
      mandó una captura de una ficha real de "Lucas" con "Busca: zona
      indiferente")**: la simplificación no alcanzaba solo al modal de
      edición — la tarjeta (`.ownercard`) de la grilla de Clientes también
      mostraba "Busca: ...", Estado, Origen y Delegado para un Propietario.
      Mismo criterio (`c.tipoOperacion !== 'VENDER'`) envuelve ahora esos
      bloques en la tarjeta: para un Propietario solo quedan visibles
      nombre, teléfono, email, el badge de tipo y los botones de acción
      (WhatsApp/Email/Editar) — igual que para el modal.
      **Segundo seguimiento el mismo día**: el gráfico de torta "ORIGEN DE
      LOS CLIENTES" (`ClientesService.statsPorOrigen()`) contaba también a
      los Propietarios (`tipoOperacion: VENDER`) — el usuario pidió que el
      gráfico refleje solo clientes reales (buscan alquilar/comprar), no
      propietarios que cargan una propiedad. Se agregó
      `tipoOperacion: { not: VENDER }` al `where` del `groupBy`. Probado
      con curl: conteo de "Página web" en 1 antes y después de crear un
      Cliente TEST con `tipoOperacion: VENDER` (no varió); dato de prueba
      borrado en forma definitiva al terminar. `tsc --noEmit` limpio en
      `app/api/`.
- [x] **2026-08-18, pedido del usuario: nueva categoría de tipo de cliente
      "Propietario/a de propiedad en alquiler", y renombrar "Propietario /
      quiere vender" a solo "Quiere vender".** Se agregó
      `PROPIETARIO_ALQUILER` a `enum TipoOperacionCliente` (migración
      aditiva `20260818150217_cliente_propietario_alquiler`,
      `ALTER TYPE ... ADD VALUE`, mismo patrón que
      `evento_tipo_otro`) — distinto de `VENDER`: un propietario cuya
      propiedad está en alquiler, no en venta. `admin/src/pages/
      ClientesPage.tsx`: nueva función `esPropietario(tipo)` (`tipo ===
      'VENDER' || tipo === 'PROPIETARIO_ALQUILER'`) reemplaza las
      comparaciones sueltas contra `'VENDER'` que ya ocultaban los campos
      de "búsqueda" (zona, presupuesto, estado, origen, etc.) en la
      tarjeta y en el modal de edición (§ver arriba, "modal de Cliente
      simplificado") — ahora ambos tipos de propietario comparten el mismo
      trato, porque ninguno de los dos es un lead buscando algo. Badge
      nuevo reusa la clase de color `propietario` (verde) ya existente.
      `ClientesService.statsPorOrigen()` extendido a excluir también
      `PROPIETARIO_ALQUILER` del gráfico de torta, mismo criterio que ya
      excluía `VENDER`. `AgregarPropiedadPage.tsx`: el alta de "propietario
      nuevo" (§2.6, entrada del 2026-07-30) elegía siempre `VENDER` sin
      importar la modalidad de la propiedad cargada — ahora usa
      `modalidad === 'ALQUILER' ? 'PROPIETARIO_ALQUILER' : 'VENDER'`, así
      que cargar una propiedad en alquiler con propietario nuevo ya lo
      clasifica bien de entrada. Probado con curl: `POST /clientes` con
      `tipoOperacion: PROPIETARIO_ALQUILER` aceptado, y `stats-por-origen`
      no varió al crearlo (igual que ya pasaba con VENDER). `tsc --noEmit`
      limpio en `app/api/` y `admin/`. Dato de prueba borrado.

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
- [x] Tipo de evento manual "Otro" — el enum `TipoEvento` (Prisma) tenía
      solo 7 valores fijos (VISITA/REUNION/FIRMA_BOLETO/FIRMA_ESCRITURA/
      TASACION/LLAMADO/TAREA) sin ninguna categoría genérica para lo que no
      encaja en esas — se agregó `OTRO` al enum (migración
      `20260730091839_evento_tipo_otro`, aditiva, sin pérdida de datos) y a
      los mapas `TIPO_MANUAL_LABEL/CLASE/ICO` de `AgendaPage.tsx` (aparece
      solo en el `<select>` porque ya itera `Object.entries(...)`). La
      descripción específica de qué es el evento sigue yendo en el campo
      "Título" (texto libre, ya existía) — no se agregó un campo de texto
      libre aparte para el tipo, siguiendo la misma convención de categoría
      fija + título libre que ya usan el resto de los tipos (2026-07-30).

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
- [x] Botón "Descargar PDF" en las tarjetas de "LIQUIDACIONES LISTAS" —
      pedido explícito del usuario, que primero preguntó si se podía hacer
      que WhatsApp mande el PDF adjunto sin subirlo a mano. Aclarado:
      **sigue sin ser posible** — los links `wa.me` (y tampoco `mailto:`,
      que ya usaba el botón "Email" de esta misma página) no soportan
      adjuntar archivos bajo ningún método; automatizarlo del todo
      requeriría WhatsApp Business API (cuenta con Meta, aprobación,
      costo) — un proyecto aparte que el usuario ya había descartado antes
      (§3.5). Se le preguntó explícitamente el alcance y eligió **solo
      agregar el botón de descarga** (no email 100% automático con SMTP,
      que hubiera requerido credenciales reales de un servicio de correo).
      Implementado en `admin/src/pages/AvisosPage.tsx`: al hacer clic,
      trae la liquidación YA EMITIDA de ese propietario/mes (`GET
      /liquidaciones/propietarios/:id/:mes`, no la vista previa) y arma un
      comprobante oculto fuera de pantalla (`position:fixed;left:-10000px`)
      con el mismo `<ComprobanteImpreso>` + membrete que ya usan Factura y
      Liquidación, para generar el PDF con `descargarPdfComprobante()` —
      mismo mecanismo, ahora disparado sin ningún modal abierto de por
      medio. El cuerpo del comprobante (encabezado + ítems + gastos
      absorbidos + honorarios + total) se sacó a un componente nuevo,
      `admin/src/components/LiquidacionComprobante.tsx::
      LiquidacionComprobanteBody`, porque ya lo necesitaban dos lugares
      reales (el modal de `PropietariosPage.tsx` y ahora Avisos) — de paso
      se sacaron de `PropietariosPage.tsx` los tipos `LiquidacionItem/
      GastoDetalle/LiquidacionDetalle/Liquidacion` que quedaban duplicados.
      El botón solo aparece en tarjetas de "Liquidación lista" (nuevo campo
      `AvisoItem.liquidacionPdf?: {propietarioId, propietarioNombre}`,
      completado solo en ese grupo) — el resto de los avisos no lo
      muestran. Verificado con Playwright sobre datos reales (liquidación
      N° 79 de "Juan salomon", julio 2026, ya existente en la base): el
      botón aparece solo en esa tarjeta, descarga un PDF válido y liviano
      (~100-150 KB, mismo rango que el resto de los comprobantes) con el
      membrete, monto y número de liquidación correctos, sin errores de
      consola.

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

- [x] **Simplificación 2026-07-30: tarjetas clickeables en "Fichas de
      Inquilinos" + "Editar ficha" removido de las tarjetas de Alquiler en
      Ventas y Carteles** — pedido explícito del usuario. Ahora que
      Inquilinos y Cobros ya tiene un lugar para cada alquiler (ocupado en
      "Fichas de Inquilinos", vacante en "Propiedades Vacantes"), los
      botones "Editar ficha" del fix anterior en Ventas y Carteles quedaban
      duplicados y confusos — esa pantalla vuelve a ser exclusivamente
      sobre Ventas.
      - `InquilinosPage.tsx`: las tarjetas `.tcard` de "Fichas de
        Inquilinos" (antes de solo lectura) ahora abren el mismo
        `PropiedadFichaDrawer` al hacer clic, reusando el `fichaId` que ya
        existía para las filas de "Propiedades Vacantes" — mismo drawer,
        mismo estado, sin duplicar lógica.
      - `VentasPage.tsx`: se eliminó el botón "✎ Editar ficha" de la
        tarjeta simplificada de Alquiler-vacante (junto con el estado
        `fichaAlquilerId` y el `PropiedadFichaDrawer` que ya no se usaban
        ahí — quedó como tarjeta de solo lectura, informativa) y también
        de la tarjeta compartida Venta/Alquiler cuando `alquilada` es
        `true` (una propiedad que ya no está en venta, mostrada solo por
        su historial — ese botón abría el `SaleModal` de edición de venta,
        que no tiene sentido para una propiedad que ya no está a la
        venta). El botón se mantiene sin cambios para propiedades
        genuinamente en modalidad Venta.
      Probado con Playwright: clic en la tarjeta de "luis tolosa" abre el
      drawer con el contrato completo; en Ventas y Carteles, cero botones
      "Editar ficha" quedan visibles en ninguna tarjeta de Alquiler
      (vacante, publicada o con historial de venta), mientras que
      "Registrar seña"/"Vendida por terceros" siguen intactos donde
      corresponde. Sin errores de consola ni requests fallidos.

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

- [x] **Rediseño visual completo de la landing pública, calcado del boceto
      "Facundo Paris Propiedades (2).html"** — el usuario pidió aplicar el
      diseño de ese archivo (paleta, tipografía, secciones, pantalla de
      carga) manteniendo intacta toda la lógica de datos real del CRM ya
      construida (propiedades públicas, contacto, stats por tipo).

      El archivo de referencia es un export de una herramienta de
      prototipado (4.7MB, HTML+CSS+JS embebidos como un string JSON dentro
      de un `<script type="__bundler/template">`) — se extrajo y decodificó
      con un script Node (`JSON.parse` de esa línea) para poder leer el
      markup/CSS/JS real, ya que el archivo crudo excede el límite de
      lectura de archivos.

      Cambios de diseño (`app/src/styles/global.css` reescrito casi por
      completo, más ajustes puntuales por componente):
      - Paleta nueva: navy `#12273A`, teal `#26BFBB`/`#0E7C79`, crema
        `#EDECEA`, off-white `#F6F5F3` — reemplaza la paleta anterior
        (`#14253b`/`#2e97ab`/`#f4f1ec`).
      - Tipografía: Montserrat como única familia (antes Gotham para
        títulos + Montserrat para labels) — usa los archivos reales del kit
        de marca en `app/fonts/` (Regular/Medium/SemiBold/Bold), no Google
        Fonts como el boceto original. `fonts.css` limpiado de los
        `@font-face` de Gotham que quedaron sin uso.
      - **Pantalla de carga** (`components/layout/Splash.tsx`, nuevo) — logo
        + barra de progreso animada (2.4s + 0.6s fade), montada en
        `App.tsx` antes que `Header`. Puramente cosmética: no bloquea ni
        depende de que los datos reales terminen de cargar (esos siguen
        con sus propios `loadstate` por sección). Respeta
        `prefers-reduced-motion`.
      - **Header**: nav oscura sticky que se achica al hacer scroll (ya
        existía esa mecánica); se reemplazó el teléfono de contacto por un
        ícono de Instagram + píldora "Consultar" de WhatsApp, ambos
        dinámicos desde `/public/contacto-info` (antes solo mostraba
        teléfono).
      - **Hero**: reescrito con foto de fondo (`FOTO1.png`) + degradé,
        badge con matrícula, tarjeta blanca de stats flotando entre el
        hero y el carrusel, y un **carrusel de propiedad destacada nuevo**
        (`HeroCarousel` dentro de `Hero.tsx`) que — a diferencia del
        boceto, que usa 5 propiedades de ejemplo hardcodeadas — consulta
        `listarPropiedades({ limit: 5 })` real y rota automáticamente cada
        5.5s; si no hay propiedades publicadas, el bloque simplemente no
        se renderiza. El buscador (tabs Comprar/Alquiler + selector de
        tipo) se conservó funcional, solo se reskineó como "search card".
      - **Sección Propiedades**: pasó a banda oscura (`section dark`) con
        tarjetas claras encima, siguiendo el boceto; se sumaron badge de
        modalidad (punto + texto) y pastilla de precio flotando sobre la
        foto, más un link centrado "Ver todo el catálogo" al pie (antes
        estaba arriba a la derecha, como en el boceto).
      - **Modal de detalle de propiedad** (nuevo, en `PropertyCard.tsx`) —
        no existía antes; el botón "Ver detalle" abre una ficha con galería
        propia, specs y botón de WhatsApp. Como el modelo `Propiedad` no
        tiene un campo de descripción libre, el modal no fabrica texto: solo
        muestra datos reales (tipo, modalidad, ambientes, baños,
        superficie).
      - **Servicios** ("Cómo trabajamos"): se mantuvo el contenido de 3
        pasos ya existente (no el de 4 categorías del boceto, que es un
        modelo de contenido distinto) pero se sumó la banda CTA
        "Desarrolladores e inversores" del boceto, con el link de WhatsApp
        real (no hardcodeado).
      - **Nosotros**: se invirtió el orden de columnas (texto a la
        izquierda, foto a la derecha, como el boceto — antes era al
        revés), se sumó la pastilla flotante "1826 · Matrícula habilitada"
        sobre la foto y las 3 badges ("Corredor matriculado", etc.). Se
        conservaron los contadores animados (`useCountUp`) ya existentes
        —el boceto no los tiene— como una mejora que no contradice el
        pedido de "aplicar el diseño".
      - **Contacto**: se sumaron las filas de contacto (Teléfono/Email/
        Oficina) con ícono, antes ausentes — reusan los mismos datos de
        `/public/contacto-info` que ya alimentaban el botón de WhatsApp.
      - **Footer** y **botón flotante de WhatsApp**: reskineados (el
        flotante pasó de pill con pulso abajo-izquierda a círculo simple
        abajo-derecha, como el boceto).
      - Se mantuvieron intactas (no están en este boceto v2, pero sí eran
        funcionalidad real ya conectada al backend) las secciones "Explorá
        por tipo" (`/public/propiedades/stats-por-tipo`) y "Consejos
        inmobiliarios" — solo se les aplicó la paleta/tipografía nueva vía
        las mismas clases CSS reescritas, para que no desentonen.
      - `useRevealOnScroll` (ya existía, se usaba solo en una sección) se
        aplicó a todas las secciones restyleadas para el fade-in al hacer
        scroll que tiene el boceto en casi todos sus bloques.

      **Bug real encontrado y corregido durante la verificación**: el modal
      de detalle se renderizaba como hijo del `<article class="property-card">`,
      que tiene `transform` en su `:hover`. Un ancestro con `transform`
      activo se convierte en el *containing block* de sus descendientes
      `position: fixed` — así que al pasar el mouse por la tarjeta para
      clickear "Ver detalle", el overlay del modal (`position:fixed;
      inset:0`) quedaba acotado al recuadro de la tarjeta en vez de cubrir
      toda la pantalla, y los clics en el resto de la página (el header, la
      siguiente sección) volvían a colarse por encima del modal. Fix:
      `PropertyDetailModal` se renderiza con `createPortal(..., document.body)`
      en vez de como hijo directo de la tarjeta — patrón estándar de React
      para modales, evita cualquier problema de *containing block* de
      ancestros. Encontrado con Playwright real (un test con solo
      `page.evaluate`/fetch no lo hubiera detectado — hizo falta un click
      real disparando el `:hover`).

      Verificado con Playwright: splash visible al cargar y se oculta sola
      después de ~3s; con 0 propiedades publicadas todas las secciones
      muestran su estado vacío correctamente sin romper layout; publicando
      una propiedad de prueba (ficha de venta con ambientes/baños/
      superficie) aparece de inmediato en la tarjeta con badge/precio/specs
      correctos, y el modal abre y cierra sin bloquear el resto de la
      página; página `/propiedades` standalone con la variante de filtros
      "on-light" se ve consistente con el resto. Responsive verificado en
      390px (menú mobile, stats en 2 columnas). Cero errores de consola,
      cero requests fallidos, `tsc --noEmit` limpio en `app/` (2026-07-30).

- [x] **Fotos reales de fondo (Hero + "Encontrá lo que buscás") y efecto
      parallax en textos/imágenes** — el usuario agregó dos fotos nuevas en
      `app/src/images/`: `fondoHero.HEIC` (foto real de la oficina, para el
      fondo del Hero) y `FondoEncontraLoQueBuscas.jpeg` (foto de manos,
      para la banda "Explorá por tipo / Encontrá lo que buscás").

      `fondoHero.HEIC` es formato Apple (HEIF) — ningún navegador lo
      decodifica en un `<img>`, así que no se podía usar tal cual. Se
      convirtió una sola vez a `fondoHero.jpg` con `ffmpeg` (`-frames:v 1
      -update 1`, ya que el HEIC traía la foto como múltiples tiles HEVC
      que ffmpeg recompone) — el `.jpg` resultante (5712×3212) es el que se
      importa desde `Hero.tsx`; el `.HEIC` original queda en la carpeta
      como fuente, sin usarse en el build.

      **Efecto colateral detectado**: al agregar estas fotos, el usuario
      borró del disco `FotoNosotros.jpeg` (la foto que usaba la sección
      Nosotros) — `Nosotros.tsx` todavía la importaba, lo que rompía el
      build (`Cannot find name 'fotoNosotros'` / import inexistente). Se
      sacó el `<img>` y el import; la sección ahora muestra un placeholder
      prolijo ("Foto próximamente") sobre el mismo fondo degradé que ya
      existía como fallback, hasta que se agregue una foto dedicada para
      Nosotros — no se reusó ninguna de las dos fotos nuevas ahí para no
      duplicar la misma imagen en dos secciones distintas de la home.

      **Parallax** (`hooks/useParallax.ts`, nuevo) — hook chico basado en
      `getBoundingClientRect()` + `requestAnimationFrame` (sin librerías)
      que traslada un elemento en `translate3d(0, y, 0)` proporcional a la
      distancia entre su centro y el centro del viewport; `speed` positivo
      lo mueve en el mismo sentido del scroll (fondos), negativo en
      sentido contrario (capas de texto, para separarlas del fondo).
      Respeta `prefers-reduced-motion` igual que `Splash.tsx`. Aplicado a:
      - Hero: foto de fondo (`speed 0.15`) + bloque de texto (`speed
        -0.08`).
      - Banda "Encontrá lo que buscás": foto de fondo nueva, al 30% de
        opacidad con un degradé oscuro encima para que el texto siga
        siendo legible (`speed 0.12`) + el título (`speed -0.06`) — esta
        banda no tenía ninguna imagen antes.
      - Nosotros: el placeholder/foto (`speed 0.1`), complementando el
        zoom Ken Burns que ya tenía.
      Las imágenes con parallax se sobredimensionan en CSS (`height:132%;
      top:-16%` dentro de un contenedor con `overflow:hidden`) para que el
      desplazamiento nunca deje ver un borde vacío.

      Verificado con Playwright: el `transform` de la foto del Hero y de la
      banda cambia al hacer scroll (confirmado leyendo el estilo inline
      antes/después de un `scrollBy`), ambas fotos se ven correctamente
      encuadradas (no rotadas ni recortadas raro, un riesgo real al
      convertir HEIC), la sección Nosotros no rompe con el placeholder, y
      `tsc --noEmit` sigue limpio (2026-07-30).

- [x] **Agregar Propiedad: dormitorios, cochera, superficie cubierta,
      descripción y servicios facturables — más fix real de honorarios y
      pre-carga de ítems en "Emitir factura"** — pedido con varias partes,
      todas tocando el mismo circuito Propiedad → Factura → Liquidación.

      **Campos nuevos en `Propiedad`** (migración aditiva, sin backfill):
      `dormitorios Int?`, `cochera Boolean @default(false)`,
      `superficieCubierta Decimal?` (la ya existente `superficieM2` pasa a
      significar "superficie total"), `descripcion String?` — esta última
      cierra un hueco real: el modal de detalle de la landing (ver sección
      anterior) no mostraba descripción porque el modelo no tenía ese
      campo; ahora existe, aunque cablearlo en el modal público queda para
      cuando haya contenido cargado.

      **`serviciosHabilitados ServicioFacturable[]`** (enum nuevo:
      `EXPENSAS|USINA|CAMUZZI|OBRAS_SANITARIAS|RETRIBUTIVAS`, default = los
      5, para no cambiar el comportamiento de las propiedades ya
      cargadas) — antes `FacturasService.itemsPredeterminados()` ofrecía
      siempre esas 5 líneas fijas al abrir una factura, tuviera o no la
      propiedad ese servicio. Ahora se eligen al cargar la propiedad
      (checkboxes "Servicios que se facturan" en Agregar Propiedad, dentro
      de DATOS DE ALQUILER) y solo esas se ofrecen.

      **Se sacaron de "DATOS DE ALQUILER" en Agregar Propiedad**: "Vigente
      desde", "Contrato — inicio", "Contrato — fin" y "Ya tiene inquilino
      asignado" (con sus campos de contacto del inquilino). No hizo falta
      tocar el backend: `propiedades.service.ts::create()` ya usaba
      `new Date()` como fallback cuando estas fechas no llegan, así que la
      propiedad se sigue creando bien, vacante — asignar inquilino y fechas
      de contrato se hace después desde Ventas y Carteles / Inquilinos y
      Cobros, como ya pasa con "Publicar propiedad existente".

      **Bug real corregido — honorarios calculados sobre el total
      facturado, no sobre el alquiler**: en
      `liquidaciones.service.ts::generar()`, `honorarios =
      cobradoTotal * pct/100`, donde `cobradoTotal` sumaba TODOS los ítems
      de la factura (alquiler + expensas + servicios trasladados + deuda
      arrastrada) — la inmobiliaria terminaba cobrándose comisión sobre
      plata que solo intermedia (paga la luz del inquilino y no le
      correspondía honorario por eso). Fix: `honorarios` ahora se calcula
      sobre el monto del ítem "Alquiler" únicamente. Confirmado con la API
      real: con `cobradoTotal=123000` (alquiler 100000 + Usina 15000 +
      Camuzzi 8000) y honorarios al 10%, antes hubiera dado `12300`; ahora
      da exactamente `10000` (10% de 100000).

      **`itemsPredeterminados()` ahora precarga con la factura anterior**:
      antes, los ítems de servicios (Expensas/Usina/Camuzzi/Obras
      Sanitarias/Retributivas) siempre arrancaban en $0 cada mes — había
      que retipear a mano montos que casi nunca cambian. Ahora busca la
      última factura anterior de la propiedad y precarga cada servicio con
      su monto de esa factura (el alquiler sigue viniendo de
      `rentaVigente()`, dinámico y correcto; "Deuda arrastrada" se sigue
      recalculando siempre, nunca se copia). Confirmado con la API real:
      factura de julio con Usina=15000/Camuzzi=8000 → los ítems
      predeterminados de agosto llegan con esos mismos montos.

      **`FacturaModal` (botón "Emitir factura" en la ficha de la
      propiedad) suma un selector de honorarios**: mismo set de opciones
      que "Editar ficha" (Usar % por defecto / Libre / 3% / 6% / Otro %),
      con una línea de vista previa "Honorarios (X% de $Y)" calculada en
      vivo sobre el monto que esté cargado en el ítem "Alquiler" del
      formulario (no sobre el total). Al confirmar "Emitir factura", si el
      % cambió respecto del que tenía la propiedad, primero hace `PATCH
      /propiedades/:id` (mismo endpoint que "Editar ficha") y recién
      después emite la factura — el % elegido queda guardado para esta y
      las próximas liquidaciones, no es un valor de un solo uso.

      Probado con Playwright real de punta a punta: propiedad de prueba con
      Usina/Camuzzi habilitados (sin Expensas/Obras Sanitarias/
      Retributivas) → el modal de factura solo ofrece esos dos ítems;
      cambiar el % a 15 y el monto de Alquiler a 200000 en vivo actualiza
      la vista previa a exactamente $30.000; agregar Usina=50000 (llevando
      el total a $250.000) **no mueve** el preview de honorarios; al
      confirmar "Emitir factura", la propiedad queda con
      `honorariosTipo=OTRO, honorariosPorcentaje=15` (verificado por API
      después de cerrar el navegador). Formulario de Agregar Propiedad
      verificado con Playwright: los 5 campos nuevos están, los 4 campos
      sacados de "DATOS DE ALQUILER" ya no están, los 5 checkboxes de
      servicios están. Cero errores de consola, `tsc --noEmit` limpio en
      `admin/` y `app/api/` (2026-07-30).

- [x] **Cartel: "Tipo de cartel" y "Estado" se fusionaron en un solo campo,
      "Medida" pasó de texto libre a Chico/Grande** — pedido explícito del
      usuario: quería que "tipo de cartel" ofreciera 3 opciones fijas
      (Colocado/Retirado/Por colocar). Como el modelo ya tenía exactamente
      ese concepto en un campo separado `estado: EstadoCartel` (antes
      mostrado como "A pedido"), mantener los dos hubiera sido
      redundante — se eliminó `estado` y `Cartel.tipoCartel` pasó de
      `String` (texto libre tipo "Cartel de obra") a `EstadoCartel`.
      Migración (`20260730075719_cartel_tipo_es_estado`) escrita a mano
      (no la que generó `prisma migrate dev --create-only` por defecto,
      que hubiera tirado todo a `A_PEDIDO`): copia el valor real de
      `estado` a la columna nueva antes de borrar ambas columnas viejas,
      así ningún cartel existente cambia de estado real por la migración
      (se descarta a propósito el texto libre viejo de `tipoCartel`, no el
      dato de estado). Actualizado en cascada: DTOs
      (`create-cartel.dto.ts`/`update-cartel.dto.ts`), `carteles.service.ts`
      (`create`/`update`/`retirar`/`kpis`, antes `create()` forzaba
      siempre `COLOCADO` sin importar el formulario — ahora se puede crear
      un cartel directamente como "Por colocar"), `VentasPage.tsx` (columna
      "ESTADO" de la tabla eliminada por duplicada, badge único bajo "TIPO
      DE CARTEL"; el modal ya no tiene un input de texto libre para tipo
      ni un select de estado aparte — un solo select con las 3 opciones,
      disponible tanto al crear como al editar) y el export CSV de
      Reportes (`ConfiguracionPage.tsx`, quitó la columna "Estado"
      duplicada). "Medida" pasó de `<input>` libre a `<select>` con
      Chico/Grande/Sin especificar (sin migración: sigue siendo
      `String?`, solo se restringen las opciones del formulario).
      Probado con Playwright: el select de "Tipo de cartel" ofrece
      exactamente `['Colocado', 'Retirado', 'Por colocar']`, el de
      "Medida" `['Sin especificar', 'Chico', 'Grande']`; crear un cartel
      como "Por colocar"/"Grande" lo muestra así en la tabla y en el KPI
      "Por colocar"; editarlo a "Colocado" lo saca de esa cuenta. `tsc
      --noEmit` limpio en `app/api/` y `admin/` (2026-07-30).

## Favicon de la landing y optimización de índices de base de datos

Pedido explícito del usuario antes del deploy a Hostinger — dos cosas
independientes:

- [x] Favicon (ícono de pestaña del navegador) de la landing pública —
      usa `LOGO PNG.-10` (el isotipo solo, mismo archivo que la marca de
      agua de los comprobantes), copiado a `app/public/favicon.png` y
      referenciado con `<link rel="icon">` en `app/index.html`. No existía
      ningún favicon antes. Verificado: `GET /favicon.png` en el dev
      server de la landing responde 200 con `image/png` (2026-07-30).
- [x] Índices nuevos en Prisma — se revisó el schema completo (ya estaba
      bastante indexado, con comentarios explicando cada `@@index`) contra
      el código real de los servicios (no se inventó nada especulativo:
      cada índice agregado corresponde a un `findMany`/`aggregate` real
      encontrado por grep). Se encontraron dos huecos genuinos, los dos
      con la misma forma: una consulta que filtra **solo por `mes`**,
      mientras el único índice existente sobre esa tabla tenía otra
      columna como líder (lo que hace que Postgres no pueda usarlo para
      ese filtro):
      1. `Liquidacion` — `AvisosService.liquidacionesListas()` (se corre
         cada vez que se abre Avisos), `CajaService.kpisDelMes()` y
         `ReportesService.resumenAnual()` (esta última **12 veces por
         reporte**, una por mes del año) hacen `liquidacion.findMany({
         where: { mes } })` sin `propietarioId` — el único índice
         existente era el `@@unique([propietarioId, mes])`, inútil para
         un filtro que no incluye `propietarioId`. Se agregó
         `@@index([mes])`.
      2. `Gasto` — los mismos dos servicios (`CajaService.kpisDelMes()`,
         `ReportesService.resumenAnual()`) hacen
         `gasto.aggregate({ where: { mes, destino: 'INMOBILIARIA' } })`
         sin `propiedadId` — el único índice existente era
         `[propiedadId, mes]`, mismo problema. Se agregó
         `@@index([mes, destino])` (cubre el filtro exacto de esas dos
         consultas, y de paso cualquier otro filtro futuro por solo mes).
      Migración `20260730210413_optimizar_indices_mes` — puramente
      aditiva (`CREATE INDEX`, dos líneas), sin ningún riesgo de pérdida
      de datos ni downtime real a este volumen de datos. Confirmado con
      `\di` en psql que ambos índices quedaron creados; `tsc --noEmit`
      limpio y backend reiniciado sin errores.
      **Deliberadamente NO se tocó nada más** — se revisaron también
      `Cartel.tipoCartel` (filtrado en `count()`/`kpis()`) e
      `InteresadoVenta.etapa` (filtrado en `kpis()`) como posibles
      candidatos, pero esas tablas son chicas (carteles/interesados de una
      sola inmobiliaria, decenas de filas) — un índice ahí no cambiaría
      nada perceptible y agregar índices sin un motivo real solo suma
      overhead de escritura, así que se dejaron como estaban, siguiendo
      el pedido explícito de "si no se puede optimizar, no intentes nada
      arriesgado" (2026-07-30).

## Email de notificación por el formulario de contacto + carrusel destacado curado

- [x] **`EmailModule` nuevo (`api/src/email/`) — notificación por SMTP al
      recibir una consulta desde el formulario público.**
      `EmailService.enviar()` usa `nodemailer`; si faltan las variables
      `SMTP_HOST/PORT/USER/PASS` el envío se salta en silencio con un
      warning en el log (nunca tira abajo el endpoint que lo llama — un
      email que no sale no debe impedir que el `Cliente` quede guardado).
      `PublicController::contacto()` llama a `emailService.enviar()`
      **sin awaitear el resultado en el flujo de respuesta** (fire-and-forget,
      ya que `EmailService` absorbe sus propios errores) después de crear
      el `Cliente` — el destinatario sale de `Configuración → Datos
      públicos` (dato de negocio editable desde el admin), no de una env
      var. Nota técnica: resuelve el host SMTP a una IPv4 a mano
      (`dns.resolve4`) antes de pasarlo a `nodemailer` — en redes sin
      salida IPv6 (frecuente en Windows/varios ISP), dejar que
      `nodemailer` eligiera al azar entre IPv4/IPv6 fallaba de forma
      intermitente con `ECONNREFUSED` (2026-07-30).
- [x] **`Propiedad.caracterEspecial`** — flag booleano tildado a mano
      desde el admin para curar manualmente qué propiedades aparecen en
      el carrusel destacado del Hero de la landing; deliberadamente no se
      deriva de nada (precio, fotos, antigüedad) — es 100% curación
      manual. `GET /public/propiedades` acepta `?especial=true` para
      filtrar por esto (2026-07-30).

## Honorarios de administración, split de tipos, borrado blando de clientes y más (correcciones 3/8)

Tanda de features independientes del mismo día, cada una con su propia
migración:

- [x] **Honorarios de administración por propiedad.** `Propiedad` gana
      `honorariosAdministracion` (boolean, checkbox opt-in) y
      `honorariosAdministracionPorcentaje` (migración
      `20260803225449_split_tipo_y_honorarios_administracion`) — a
      diferencia de los honorarios profesionales, es 100% opt-in: sin el
      checkbox tildado no se cobra nada, no hay % por defecto de
      Configuración para este cargo
      (`resolverPorcentajeHonorariosAdministracion()` en
      `api/src/common/honorarios.util.ts`).
      `LiquidacionesService::calcularDetalle()` lo descuenta también del
      neto a girar al propietario, persistido en el nuevo campo
      `LiquidacionPropiedad.honorariosAdministracion`.
      `CajaService.kpisDelMes()` y `ReportesService.resumenAnual()` lo
      suman a los honorarios del mes junto con los profesionales. UI en
      `VentasPage.tsx` (`SaleModal`) y `PropiedadFichaDrawer.tsx`.
- [x] **Tipo de propiedad "Departamento/Dúplex" separado en dos valores +
      filtro múltiple.** El enum `TipoPropiedad` deja de tener
      `DEPARTAMENTO_DUPLEX` y pasa a `DEPARTAMENTO` + `DUPLEX`
      independientes (misma migración de arriba, con
      `USING CASE WHEN` para reclasificar en bloque las filas existentes
      de `propiedades` y `clientes.busquedaTipoPropiedad` a
      `DEPARTAMENTO` por defecto). Para no romper el chip "Deptos" de la
      landing pública (que sigue mostrando ambos como un solo grupo),
      `GET /public/propiedades` pasa a aceptar `tipo` como lista separada
      por coma (`tipo: { in: [...] }` en vez de un único valor) —
      `PropertyFilterChips.tsx`/`TipoStatsBand.tsx` en la landing y los
      selectores de tipo en `VentasPage.tsx`/`ClientesPage.tsx`/
      `PropiedadFichaDrawer.tsx` en el admin se actualizan para trabajar
      con listas.
- [x] **Borrado blando de clientes + historial de eliminados.** `Cliente`
      gana `eliminadoEn` (nullable, migración
      `20260803213815_cliente_eliminado_en`, con índice).
      `ClientesService.remove()` deja de hacer `delete` y ahora solo
      marca `eliminadoEn = now()`; `findAll()` y `statsPorOrigen()`
      filtran `eliminadoEn: null` (igual que
      `AvisosService.clientesSinContactar()`). Nuevos endpoints
      `GET /clientes/eliminados` (historial), `PATCH /clientes/:id/restaurar`
      y `DELETE /clientes/:id/definitivo` (el único borrado real e
      irreversible). En el admin, `ClientesPage.tsx` suma el botón
      "Historial de eliminados" → `HistorialEliminadosModal`, con
      confirmación explícita antes del borrado definitivo.
- [x] **Foto de portada por propiedad para el carrusel destacado del
      Hero.** `FotoPropiedad` gana `esPortada` (boolean, migración
      `20260803220446_foto_portada_y_nosotros`) — a lo sumo una en `true`
      por propiedad, garantizado por
      `PropiedadesService.marcarFotoPortada()` en una transacción
      (desmarca cualquier otra antes de marcar la elegida). Solo tiene
      sentido para propiedades de "carácter especial" con más de una
      foto. `PublicPropiedadesService.mapear()` antepone la foto marcada
      al array `fotos` para que el frontend público siga usando
      `fotos[0]` sin conocer `esPortada`; sin ninguna marcada, se usa la
      primera por `orden` (comportamiento de siempre). Nuevo endpoint
      `PATCH /propiedades/:id/fotos/:fotoId/portada`.
- [x] **Recorte/recompresión server-side de fotos + foto institucional
      "Nosotros" en la landing.** Nueva dependencia `sharp`.
      `procesarFotoParaTarjeta()` (`api/src/common/imagen.util.ts`)
      recorta toda foto a 1080x1350 (`cover`, respetando orientación
      EXIF) y la recomprime a JPEG calidad 85 — evita el recorte raro que
      se veía forzando la relación de aspecto solo por CSS con fotos
      verticales de celular, y fotos sin comprimir hacían tardar la carga
      de la landing. Se aplica tanto a fotos de propiedad
      (`PropiedadesService.agregarFoto()`) como a una nueva foto
      institucional de Facundo/oficina para la sección "Nosotros":
      `Configuracion.publicoFotoNosotrosUrl` (misma migración de foto
      portada), endpoint `POST /configuracion/foto-nosotros` (solo
      ADMIN), UI en `ConfiguracionPage.tsx` y consumo en `Nosotros.tsx`
      (placeholder "Foto próximamente" sin foto cargada). Multer pasa de
      `diskStorage` a `memoryStorage` en ambos casos (el archivo crudo ya
      no se escribe a disco, solo el resultado procesado) y el límite de
      tamaño sube de 8MB a 20MB. Nuevo `MulterExceptionFilter` traduce al
      español los mensajes en inglés que Multer/Nest generan para errores
      de archivo.
- [x] **Nuevos servicios facturables: Cloacas, Gas envasado, Sistema
      biodigestor.** `ServicioFacturable` suma estos tres valores
      (migración `20260803231720_servicios_cloacas_gas_biodigestor`,
      aditiva) — se agregan al orden canónico de la factura y a los
      checkboxes de habilitación por propiedad en `VentasPage.tsx`/
      `PropiedadFichaDrawer.tsx`.
- [x] **Cierre de sesión automático en el admin ante un 401.**
      `admin/src/api/client.ts` detecta cuando una request que sí mandó
      token vuelve con 401 (token expirado o rechazado) y dispara el
      evento global `auth:sesion-expirada`; `AuthContext.tsx` lo escucha,
      limpia el usuario y `LoginPage.tsx` muestra "Tu sesión expiró —
      iniciá sesión de nuevo." en vez de mostrar el error crudo
      ("Unauthorized") en la pantalla donde agarraba al usuario. Un 401
      en el propio `/auth/login` (contraseña incorrecta) no dispara esto
      porque esa request no manda token (2026-08-03).

## Seguridad reforzada

- [x] **Rate-limit específico para `POST /auth/login`** — 5 intentos/min
      (vs. el límite genérico de 100/min/IP de toda la API), vía
      `@Throttle` a nivel de método — es el único endpoint donde alguien
      de afuera puede probar credenciales a la fuerza.
      `api/src/auth/auth.controller.ts`.
- [x] **CORS restringido en producción vía `ALLOWED_ORIGINS`** — sin la
      variable definida (dev local) se sigue reflejando cualquier origen
      (no cambia el flujo de desarrollo); en producción se define con el
      dominio real y solo ese puede leer las respuestas de la API.
      `api/src/main.ts`.
- [x] **`Strict-Transport-Security` en el Caddyfile** — header HSTS
      agregado a la config de producción (`deploy/Caddyfile`).
- [x] **Precarga diferida de fotos en `PropertyCard` (landing)** — no es
      seguridad, viajó en el mismo commit: una propiedad con varias fotos
      tardaba perceptiblemente en cambiar de foto (el `<img>` recién
      pedía la imagen al mostrarla). Ahora se precarga el resto de la
      galería de ESA propiedad recién en la primera interacción real con
      sus fotos (no todas las propiedades del listado de entrada, para no
      gastar ancho de banda en las que el usuario ni mira) — desde ahí,
      cambiar de foto es instantáneo. `app/src/components/propiedades/PropertyCard.tsx`
      (2026-08-03).

## Ventas: "Lote" sin specs de construcción + servicios para cualquier tipo/modalidad

- [x] **Un lote (terreno sin construir) ya no pide ambientes,
      dormitorios, baños, superficie cubierta ni cochera** al cargarlo en
      "Agregar Propiedad" — esos campos no tienen sentido para un
      terreno, sea alquiler o venta (`esLote = tipo === 'LOTE'` en
      `AgregarPropiedadPage.tsx`). Primera versión solo aplicaba esto del
      lado de venta y ofrecía "Servicios en la zona" como reemplazo
      exclusivo del lote; se corrigió el mismo día para que valga para
      cualquier modalidad.
- [x] **Los servicios que se facturan (luz, gas, etc.) pasaron a
      preguntarse para cualquier tipo de propiedad y modalidad**, no solo
      para alquiler — antes `serviciosHabilitados` solo se guardaba desde
      el lado de alquiler; ahora "Datos de Venta" también tiene su propio
      checklist de servicios (útil, por ejemplo, para informar qué tiene
      disponible un lote en venta) (2026-08-06).

## Eliminar propietario desde Propietarios y Liquidaciones

- [x] **Botón "Eliminar" por propietario**, con confirmación que avisa
      cuántas propiedades suyas van a quedar sin propietario asignado.
      `DELETE /propietarios/:id` → `Propietario.delete()` — por las
      relaciones del schema, esto **cascadea el borrado de todo el
      historial de liquidaciones emitidas** de ese propietario
      (`Liquidacion.propietario` es `onDelete: Cascade`) y **desasigna**
      (no borra) sus propiedades (`Propiedad.propietario` es
      `onDelete: SetNull`) — ambos efectos están explicitados en el texto
      del `window.confirm()` antes de ejecutar. `PropietariosPage.tsx`
      (2026-07-30).

## Botón de cerrar sesión en el sidebar

- [x] Antes no había forma de cerrar sesión desde la UI salvo borrar el
      token a mano. Botón fijo al final del nav del sidebar, usa
      `useAuth().logout()` (ya existía en `AuthContext`, sin ningún botón
      que lo llamara). `admin/src/components/Sidebar.tsx` (2026-08-06).

## Rol "Designado" (EQUIPO) con login propio, acotado a Ventas y Carteles + Agenda

- [x] **`IntegranteEquipo` (el roster de "designados para mostrar") puede
      vincularse a un `Usuario` real** (`IntegranteEquipo.usuarioId`,
      `@unique`, `onDelete: SetNull`) — un integrante del equipo pasa a
      poder loguearse con su propio email/contraseña, con
      `rol: RolUsuario.EQUIPO`, sin dejar de ser el mismo "designado para
      mostrar"/"delegado" que ya se usaba en Propiedades y Clientes.
      `IntegrantesEquipoService.update()` crea el `Usuario` la primera vez
      que se le da acceso a alguien y reutiliza el mismo en ediciones
      posteriores; `setAccesoActivo()` revoca/reactiva sin borrar el
      registro. `ConfiguracionPage.tsx` suma el modal
      `IntegranteAccesoModal` para asignar email/contraseña, con el
      estado de cada integrante a la vista ("· acceso activo" / "· acceso
      revocado" / "· sin acceso").
- [x] **Gating de dos capas para el rol EQUIPO**:
      - Frontend (`admin/src/App.tsx`): el sidebar y las rutas se acotan a
        `/ventas` y `/agenda` — cualquier otra ruta redirige a `/ventas`.
        Dentro de la propia Ventas y Carteles, `VentasPage.tsx` además le
        oculta a EQUIPO "Editar ficha", "+ Publicar propiedad en venta" y
        la gestión de carteles — queda limitado al pipeline de
        interesados/seña/cierre/venta por terceros.
      - Backend (defensa en profundidad — un JWT de designado robado no
        alcanza aunque se le pegue directo a la API): la mayoría de los
        controllers tienen `@Roles(RolUsuario.ADMIN)` a nivel de clase o
        método (`propietarios`, `clientes`, `caja`, `incidencias`,
        `avisos`, `gastos`, `proveedores`, `cobros`, `facturacion`,
        `liquidaciones`, `reportes`, `usuarios`, `carteles`,
        `configuracion`, `ventas`, `propiedades` — según el endpoint,
        algunos dejan pasar lectura pública/compartida, como
        `GET /propiedades`/`GET /clientes`/`GET /propietarios`/
        `GET /integrantes-equipo` que alimentan los desplegables de
        Ventas/Agenda, y bloquean solo escritura). `RolesGuard` +
        `@Roles()` (`api/src/auth/`).
- [x] **`EventoAgenda.usuarioId`** (nullable, `onDelete: SetNull`) — dueño
      del evento; `null` = evento global/automático (vencimientos de
      contrato, alertas de aumento — siguen siendo de todos).
      `AgendaService.crear()` toma el dueño siempre del JWT (nunca del
      body): un EQUIPO solo puede crearse eventos a sí mismo, un ADMIN
      crea eventos globales. `eventosDelMes()` filtra distinto según el
      rol — un `EQUIPO` ve solo sus propios eventos manuales; un `ADMIN`
      ve solo los globales (no hay, hoy, una vista que mezcle "todos los
      designados" para un ADMIN). `update()`/`marcarHecho()`/`remove()`
      verifican propiedad del evento (`assertPropietario()`) antes de
      tocar nada, incluso si el id ya se conoce de antes — protege contra
      un JWT robado usado directo contra la API.
      Migración `20260808231500_designados_login_y_agenda_por_usuario`,
      puramente aditiva.

## Mora automática, número de factura manual, "al día" desde la carga y honorarios de administración en Liquidaciones

Tanda grande de features del mismo día ("producto prácticamente
terminado"), cada punto independiente entre sí:

- [x] **Cálculo automático de mora/punitorios en la factura.**
      `FacturasService.itemsPredeterminados()` sugiere un ítem "Mora"
      cuando el contrato tiene punitorio configurado (`punitorioTipo`/
      `punitorioValor`/`punitorioFrecuencia` — ya modelados antes, sin
      lógica de cálculo) y el mes anterior se terminó pagando fuera de
      término. Se calcula sobre el último pago del mes cerrado
      inmediatamente anterior, comparando su fecha contra
      `diaVencimientoAlquiler` de Configuración; la frecuencia (día/
      semana/mes/único) determina cómo escala el monto base con los días
      de atraso. Si el mes anterior todavía tiene saldo pendiente, no
      calcula nada (se recalcula solo cuando se termine de pagar).
      Respeta `Inquilino.alDiaDesde` (ver abajo): no calcula mora para
      meses anteriores al alta del inquilino en el sistema. Es un ítem
      editable, no se fuerza — `api/src/facturacion/facturas.service.ts::calcularMora()`.
- [x] **Inquilino "al día" al cargarlo (`alDiaDesde`).** Checkbox en
      `AlquilarPropiedadModal` para cuando un inquilino ya alquilaba
      desde antes de entrar al sistema y pagaba por fuera: tildarlo
      guarda `Inquilino.alDiaDesde` (el mes actual, calculado del lado
      del servidor) y anula el cómputo de deuda/mora para los meses
      anteriores — la obligación de pago arranca recién ahí. Afecta
      `CobrosService.deudaAcumulada()`, `mesesPendientes()` y
      `FacturasService.calcularMora()`. Una edición posterior del
      inquilino (`EditarInquilinoModal`) no manda el campo, así que no
      pisa el valor ya guardado — `api/src/propiedades/propiedades.service.ts::upsertInquilino()`.
- [x] **Número de factura manual.** `EmitirFacturaDto` acepta un `numero`
      opcional; si se manda, `FacturasService.emitir()` lo usa en vez del
      correlativo automático de Configuración y el contador no avanza —
      para cuando la numeración ya la lleva la inmobiliaria por fuera del
      sistema (ej. talonario físico) y necesita que coincida. De paso,
      tanto la emisión de facturas como la generación de liquidaciones
      capturan el error de índice único (`P2002`, colisión de dos
      personas operando casi al mismo tiempo sobre la misma
      propiedad+mes) y devuelven un `ConflictException` con mensaje claro
      en vez de un 500.
- [x] **Número correlativo de inquilino.** `Inquilino.numero`
      (autoincremental, solo lectura) para identificar rápido de qué
      inquilino se trata al lado del número de factura, sin exponer el
      UUID interno.
- [x] **Ventana de gracia post-venta/alquiler en la landing pública.**
      Nueva `Configuracion.diasMostrarDespuesVentaAlquiler` (0 =
      comportamiento de siempre, desaparece al instante): una propiedad
      recién alquilada o vendida sigue listada en la web ese número de
      días, anclado en `contratoInicio` (alquiler) o `venta.cierreReal`
      (venta, cubre vendida por la inmobiliaria y por terceros).
      `PublicPropiedadesService` suma un campo `estadoPublico`
      ("DISPONIBLE"/"ALQUILADA"/"VENDIDA") para que el frontend público
      distinga una propiedad realmente disponible de una que solo sigue
      visible por la ventana de gracia. Configurable desde
      `ConfiguracionPage`.
- [x] **Honorarios profesionales 4%.** Nueva opción `CUATRO_POR_CIENTO`
      en el enum `TipoHonorarios`, junto a Libre/3%/6%/Otro.
- [x] **Rediseño del retenido en Liquidaciones.** Antes,
      `LiquidacionesService.generar()` descontaba "honorarios
      profesionales" (comisión, % por propiedad) del neto a girar al
      propietario y generaba un EGRESO en Caja por ese neto. Ahora esos
      honorarios profesionales quedan en 0 explícitamente para
      alquileres (esa comisión solo corresponde a modalidad VENTA — un
      alquiler nunca la cobra), y lo único que la inmobiliaria retiene es
      el honorario de administración (si está habilitado), que ahora
      genera un INGRESO en Caja — antes el movimiento completo era un
      egreso por el neto girado, que era plata del propietario y no
      tenía sentido registrar como movimiento propio de la inmobiliaria.
      Se agrega `DELETE /liquidaciones/:id` para deshacer una liquidación
      emitida por error: borra la liquidación (cascada sobre detalle/
      ítems/gastos) junto con el movimiento de Caja que haya generado,
      sin tocar los cobros/gastos reales usados para calcularla.
- [x] **Seña de venta deja de generar movimiento de Caja** (primera
      versión de este cambio — ver también la limpieza final del
      2026-08-13 más abajo). `VentasService.registrarSena()` ya no crea
      un INGRESO en USD al registrar la seña (etapa reserva) — de una
      venta lo único que se refleja en Caja es el honorario/comisión al
      cerrarla, la seña queda solo en la ficha de la venta. Se conserva
      la limpieza de señas cargadas antes de este cambio (que sí habían
      generado movimiento). De paso, `registrarSena`, `eliminarSena`,
      `cerrar` y `deshacerCierre` toman un lock de fila
      (`SELECT ... FOR UPDATE`) sobre la venta dentro de la transacción
      antes de leer su estado — dos acciones concurrentes sobre la misma
      venta (ej. dos "Cerrar venta" casi simultáneos) ya no pueden leer
      el mismo estado viejo y terminar duplicando un movimiento de Caja
      (`VentasService::lockVenta()`).
- [x] **Egreso en Caja para gastos de incidencias sin proveedor.**
      `GastosService.crearDesdeIncidencia()` no generaba egreso propio en
      Caja por defecto (esa salida la cubre el pago al proveedor) — pero
      cuando la incidencia no tiene proveedor asignado y la paga la
      inmobiliaria, nunca existía ningún pago que registrara esa salida
      de plata, dejando un agujero contable. Ahora, si no hay proveedor y
      `quienPagaCosto === INMOBILIARIA`, el gasto genera su propio egreso
      (guardado en `Gasto.movimientoCajaId`). `IncidenciasService.remove()`
      ahora también borra ese movimiento de Caja asociado al borrar la
      incidencia (antes solo desvinculaba el gasto, dejando el egreso
      huérfano).
- [x] **Corrección de "próximo aumento".**
      `PropiedadesService.proximoAumento()` devuelve `null` si la
      propiedad está vacante (sin inquilino), aunque conserve
      `frecuenciaAumentoMeses` o historial de una tenencia anterior. Y el
      ancla para calcular la fecha deja de ser el último
      `HistorialAumento` de la propiedad sin más filtro — pasa a ser el
      último aumento registrado *desde que arrancó el contrato vigente*
      (`fecha >= contratoInicio`), o el propio `contratoInicio` si
      todavía no hubo ninguno — así un aumento que haya quedado de un
      inquilino anterior no se cuela en el cálculo del inquilino actual.
- [x] **Throttling de login también por email, no solo por IP.** El
      tracker del `ThrottlerModule` (ver "Seguridad reforzada" arriba)
      suma el email del body a la IP, tanto para `POST /auth/login` como
      para `POST /public/contacto` — dos personas detrás de la misma red
      (ej. la oficina) ya no comparten el mismo cupo de intentos, cada
      cuenta/remitente tiene el suyo.
- [x] **Plantilla configurable del mensaje de WhatsApp al emitir
      factura.** Nueva `Configuracion.facturaWhatsappMensaje`, editable
      desde `ConfiguracionPage`, con placeholders `{nombre}` `{numero}`
      `{propiedad}` `{mes}` reemplazados al armar el botón "Enviar por
      WhatsApp".
- [x] **`VentasPage` pasa a listar estrictamente `modalidad === 'VENTA'`**
      — antes también mezclaba alquileres vacantes publicados desde ahí
      (con una tarjeta simplificada aparte) y propiedades que habían
      pasado de venta a alquiler. Los alquileres (ocupados o vacantes) se
      gestionan enteramente desde Inquilinos y Cobros;
      `AlquilarPropiedadModal` en simetría deja de listar propiedades en
      venta como opción para alquilar.
- [x] **Ítem "Retributivas de Servicios" pasó a ser fijo en toda factura
      de alquiler** (igual que "Alquiler", sin depender de
      `serviciosHabilitados`) — **revertido después, el 2026-08-12**, ver
      "Cuatro pedidos..." más abajo: pedido explícito del usuario de que
      vuelva a depender del checkbox (2026-08-08).

## Cuatro pedidos sobre contratos, facturación y paginación de impresión

Pedido explícito del usuario, cuatro partes independientes sobre la misma
sesión de trabajo:

- [x] **"Próximo aumento" no se muestra si cae después del fin de
      contrato.** `PropiedadesService.proximoAumento()` ahora también
      selecciona `contratoFin`; si la fecha calculada del próximo aumento
      es posterior al fin de contrato, devuelve `null` en vez de una
      fecha que nunca va a llegar a aplicarse (el contrato se renueva o
      termina antes) (2026-08-12).
- [x] **Sacar "Retributivas de Servicios" de la lista fija de ítems de la
      factura.** Antes era el único servicio, además de "Alquiler", que
      se agregaba siempre sin importar `serviciosHabilitados` — quedó
      igualado al resto: solo aparece si la propiedad lo tiene tildado.
      `FacturasService::itemsPredeterminados()` (2026-08-12).
- [x] **Bug de paginación al imprimir/exportar comprobantes largos —
      causa raíz real, no cosmética.** El contenido imprimible
      (`.modalcard`, dentro de `.modal`) era `position:fixed;inset:0` —
      un elemento fixed **no se fragmenta en varias hojas al imprimir**
      (limitación real del motor de impresión de cualquier navegador, no
      un bug de CSS ajustable): un comprobante largo (muchas propiedades
      en una liquidación, muchos ítems en una factura) se cortaba entero
      en la primera hoja, y lo que no entraba se perdía — no se generaba
      una segunda hoja. Un primer intento (agregar `padding-bottom` al
      `.modalcard`) resultó insuficiente: por fragmentación CSS estándar,
      el `padding-bottom` de una caja partida en varias hojas solo se
      aplica en la ÚLTIMA, no protege las anteriores.
      **Fix real, en dos partes**:
      1. `Modal.tsx` ahora portala su contenido a `document.body`
         (`createPortal`) — queda hermano de `#root` en vez de anidado en
         el layout normal de la página que lo abrió, lo que permite que
         `@media print` oculte `#root` entero y deje que `.modalcard`
         fluya como contenido NORMAL (no fixed) de la hoja impresa, capaz
         de paginar de verdad.
      2. `global.css`: `@page{size:A4;margin:26px 34px 100px}` reserva el
         margen inferior en CADA hoja física (a diferencia del padding de
         antes) para que el pie (`.comp-pie`, sigue siendo `fixed` a
         propósito — es un elemento decorativo que sí debe repetirse en
         cada hoja) nunca tape contenido. También se corrigió
         `html,body{height:auto}` dentro de `@media print` — la regla
         base `height:100%` (para el layout normal en pantalla) le
         impedía al documento crecer más allá de un viewport en modo
         impresión, aunque el contenido desbordara visualmente.
      3. Efecto colateral aprovechado: `ReciboModal` ahora también se
         envuelve en `<ComprobanteImpreso>` (antes solo Factura y
         Liquidación tenían membrete — el Recibo se imprimía sin logo ni
         pie).
      Verificado con una liquidación de prueba de 16 propiedades:
      contenido completo, sin recorte. No se pudo confirmar con una
      captura literal paginada a varias hojas por una limitación del
      entorno de pruebas (Puppeteer `page.pdf()` colgaba en esta máquina)
      — la corrección está fundamentada en el comportamiento estándar y
      documentado de CSS Paged Media, no solo en la prueba visual
      (2026-08-12/13).
      **Nota de higiene de datos**: durante las pruebas de este punto, un
      script de verificación con una búsqueda de botón sin acotar
      (`document.querySelectorAll('button')` global en vez de acotado a
      la tarjeta de la propiedad de prueba) disparó por error la emisión
      de una liquidación **real** más de una vez — el contenido quedó
      correcto en todos los casos (nunca se mezclaron datos de prueba con
      datos reales), pero el número de comprobante avanzó de más
      innecesariamente. Ver la advertencia sobre correlativos globales y
      acotar búsquedas del DOM en `CLAUDE.md`.

## Limpieza final de "seña de venta" fuera de Caja

- [x] Pedido explícito del usuario: **"de una venta lo único que se tiene
      que ver reflejado en la caja es el honorario"** — confirmando y
      terminando de limpiar el cambio del 2026-08-08 (ver arriba,
      "Seña de venta deja de generar movimiento de Caja"). Quedaba un
      movimiento de Caja real de una seña cargada ANTES de ese cambio
      (propiedad "depto 20", USD 20.000) — se eliminó a mano junto con su
      referencia en `Venta.movimientoCajaSenaId`. Se sacó también el
      campo `fecha` de `RegistrarSenaDto` (ya no tenía sentido, no genera
      movimiento) y todo el código ya muerto que quedaba colgando de la
      época en que sí generaba movimiento: `EditarSenaModal`,
      `ORIGEN_LABEL['SENA_VENTA']` en `CajaPage.tsx` y el input "Fecha"
      del modal de seña en `VentasPage.tsx` (2026-08-13).

## N° de cuenta por servicio en la factura + panel "Estado de cobros" en la ficha

Pedido explícito del usuario, dos partes:

- [x] **Agua/Gas/Luz/Retributivas: usuario y N° de cuenta fijos por
      propiedad, reflejados en la factura.** `Propiedad` ganó 5 columnas
      nullable (`obrasSanitariasUsuario`, `obrasSanitariasNumeroCuenta`,
      `camuzziNumeroCuenta`, `retributivasNumeroCuenta`,
      `usinaNumeroCuenta` — migraciones
      `20260813172514_propiedad_datos_cuenta_servicios` y
      `20260814021805_propiedad_usina_numero_cuenta`, puramente aditivas).
      Se cargan una sola vez desde "Agregar Propiedad" o "Editar Datos"
      (checkbox del servicio tildado → aparecen los inputs correspondientes
      — Obras Sanitarias lleva usuario + cuenta, el resto solo cuenta) y
      `FacturasService::itemsPredeterminados()` los agrega automáticamente
      a la descripción del ítem (`datosCuentaSuffix()`) sin tener que
      volver a tipearlos cada mes. Liquidación y Recibo heredan esto gratis
      porque reusan la misma función.
      **Bug encontrado y corregido en la misma sesión**: el "recordar el
      monto del mes anterior" (`montoAnteriorPorDescripcion`) buscaba por
      el texto *completo* de la descripción — al incluir ahora el N° de
      cuenta, el primer mes que se cargaba/cambiaba una cuenta el texto
      dejaba de coincidir y el monto volvía a $0 en silencio. Se corrigió
      buscando primero por texto exacto y, si no hay match, por la
      descripción base sin el sufijo de cuenta. Verificado con curl:
      Camuzzi en $7500 sin cuenta → se carga la cuenta → sigue en $7500 el
      mes siguiente → se cambia la cuenta a otra → sigue en $7500 (2026-08-13).
- [x] **Panel "Estado de cobros" en la ficha de cada propiedad, eliminando
      la sección "Fichas de inquilinos" de Inquilinos y Cobros** (mismos
      datos en dos pantallas). `PropiedadFichaDrawer.tsx` ahora muestra
      Alquiler vigente / Vence el / Deuda acumulada / Último pago (mismo
      diseño `.tstate`/`.tf` que tenían las tarjetas de inquilino) en el
      espacio vacío de la columna derecha, junto a Historial de Aumentos —
      reusa `GET /cobros/propiedades/:id/deuda` (ya existía) y
      `configuracion.diaVencimientoAlquiler`. `InquilinosPage.tsx` perdió
      la grilla de tarjetas duplicada; el buscador y "+ Agregar propiedad
      de alquiler" se reubicaron arriba de "Propiedades en alquiler", y el
      buscador ahora filtra esa grilla en vez de la que se sacó (2026-08-13).

Se aprovechó para deduplicar: `ServiciosCuentaInputs` (componente + tipo
`ServicioFacturable` + `SERVICIOS_OPCIONES`) vivía repetido en
`AgregarPropiedadPage.tsx` y `PropiedadFichaDrawer.tsx` — se extrajo a
`admin/src/components/ServiciosCuentaInputs.tsx`, con
`wrapperClassName`/`wrapperStyle`/`fieldStyle` opcionales para que cada
pantalla mantenga su propio layout sin cambiar el diseño visual (verificado
con capturas antes/después, pixel a pixel igual) (2026-08-13).

## Cómo actualizar este archivo

Cada vez que se implemente una conexión: marcarla `[x]`, agregar la fecha y
el archivo (service/controller) donde vive la lógica, por ejemplo:

```
- [x] Registrar pago → INGRESO automático en Caja — `api/src/cobros/cobros.service.ts::registrarPago()` (2026-07-25)
```

Si una conexión se implementa parcialmente (ej. se modela en la DB pero
falta el trigger de negocio), usar `[~]` y anotar qué falta.
