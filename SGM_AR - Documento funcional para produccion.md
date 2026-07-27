# SGM_AR — Documento Funcional para Producción

**Sistema de Gestión Inmobiliaria · Facundo Paris Propiedades**
Versión del boceto: logic v1.1.0 · Julio 2026

> **Qué es este documento:** la especificación funcional del prototipo aprobado
> (`SGM_AR - Sistema de Gestion.V.01.html`). Describe cada módulo, sus reglas de
> negocio y —lo más importante— cómo se conectan entre sí. Es la referencia para
> reconstruir el sistema en producción.
>
> **Estado del boceto:** aplicación en un único archivo HTML, datos guardados en
> el navegador (localStorage), sin backend. Todo lo descrito acá funciona y se
> puede probar en el prototipo.

---

## 1. Estructura general

- **Navegación:** barra lateral izquierda (sidebar) colapsable. Al seleccionar un
  módulo se achica sola a modo "solo íconos" (66px); botón ‹ › para expandir/achicar
  a mano. Los módulos con pendientes muestran un globito rojo con el número
  (Incidencias, Agenda, Avisos).
- **Encabezado de página:** título del módulo activo, chips de resumen (contratos
  activos / por vencer), fecha, y botón **+ Nueva Propiedad** (se oculta en los
  módulos donde no aplica).
- **Módulos (10), en este orden:** Panel General · Inquilinos y Cobros ·
  **Propietarios y Liquidaciones** · Ventas y Carteles · Caja ·
  Incidencias y Proveedores · Clientes · Agenda · Avisos · Configuración y
  Reportes.
  > **Pendiente de reordenar en el boceto:** "Propietarios y Liquidaciones"
  > debe ubicarse inmediatamente **después** de "Inquilinos y Cobros" — ambos
  > módulos son las dos caras del mismo flujo de cobro (lo que paga el
  > inquilino / lo que se le liquida al propietario) y tienen que quedar
  > contiguos en la barra lateral. Hoy en el boceto el orden real es distinto
  > (ver el HTML); este es el criterio a aplicar en producción.
- **Estética:** minimalista corporativo. Base clara (#F9FAFB), acentos en carbón
  (#111827), índigo (#6366F1) y naranja/rojo para alertas. Números y montos en
  tipografía monoespaciada. Tarjetas simétricas: los datos faltantes muestran "—"
  para no desalinear, y las tarjetas de una misma fila igualan altura.

---

## 2. Módulos y funcionalidades

### 2.1 Panel General
- **KPIs (5):**
  - *Actualizaciones IPC* y *Actualizaciones ICL*: valor vigente de cada índice.
    Clic para editarlos (también editables en Configuración).
  - *Cobranza del Mes*: % cobrado sobre lo esperado del mes en curso; en rojo si
    falta cobrar. Clic → Inquilinos y Cobros.
  - *Deuda de Inquilinos*: deuda acumulada total (todos los meses impagos) y
    cuántos inquilinos deben. Clic → Inquilinos y Cobros.
  - *Ocupación de Cartera*: % de propiedades de alquiler con inquilino
    ("5 de 6 alquiladas · 1 sin generar renta").
- **Gráficos (3):** Evolución Estratégica (área, recaudación de los últimos 7
  meses reconstruida desde el historial de aumentos), Cartera por Contrato
  (anillo IPC vs ICL), Eficiencia de Recaudación (barras Bruto vs Neto por
  modalidad; el neto descuenta el % de honorarios). Todos con tooltip al pasar
  el cursor.
- **Tabla de alquileres:** solo propiedades alquiladas (con inquilino). Estado
  binario del mes en curso: **Pagado** (verde) / **No pagado** (rojo); "—" si no
  corresponde cobro ese mes. Clic en una fila → abre la ficha de la propiedad.

### 2.2 Inquilinos y Cobros *(fusión de los antiguos módulos Cobros + Inquilinos)*
- **KPIs:** inquilinos activos, al día, con deuda, deuda total acumulada.
- **Bloque COBROS DEL MES:** navegador de mes (‹ ›), totales Esperado/Cobrado/
  Pendiente, barra de progreso y tabla por propiedad con: esperado, cobrado
  (monto, fecha y medio), estado de pago y acciones (Registrar pago / Editar /
  Facturar / Recibo).
- **Estados de pago (binario):** *Pagado* (cobrado completo), *Pendiente* (mes en
  curso sin cobrar del todo), *Impago* (mes cerrado sin cobrar del todo). No
  existe estado "parcial": un cobro incompleto deja saldo que pasa a deuda al
  cerrar el mes.
- **Registrar pago:** monto (prellenado con lo esperado), fecha, medio,
  comprobante, observaciones. Editable y anulable.
- **Bloque FICHAS DE INQUILINOS:** buscador, botón "Emitir cupones del mes"
  (todos los deudores en una tanda imprimible) y tarjetas por inquilino con:
  contacto, alquiler vigente, día de vencimiento, deuda acumulada, meses impagos,
  último pago, y botones Facturar / Recibo / Ver ficha.

### 2.3 Ventas y Carteles *(fusión)*
- **KPIs:** en venta, reservadas, interesados activos, comisión potencial
  (sobre no vendidas, al % de Configuración, con USD convertido al dólar de
  referencia solo para este indicador).
- **Filtro por tipo de propiedad:** Casa, Departamento/Dúplex, Quinta, Lote,
  Campo, Galpón, Local/Oficina, Cabañas/Hoteles/Otros, Fondo de comercio,
  Cocheras (mismas categorías que la página web pública). Filtra tarjetas y KPIs.
- **Pendiente de agregar en el boceto — segundo filtro "Estado de la
  propiedad":** junto al filtro por tipo, sumar un desplegable que filtre por
  el estado de la operación (las mismas opciones del campo Estado de la ficha
  de venta — ver el punto siguiente: Publicada, Reservada, Vendida (por
  nosotros), **Vendida por terceros**, Pausada). Mismo criterio que el filtro
  de tipo: recalcula tarjetas y KPIs visibles.
- **Tarjetas por propiedad en venta:** precio (ARS o USD; si es USD muestra
  equivalencia en pesos), estado (publicada/reservada/vendida/vendida por
  terceros/pausada), seña recibida, cierre estimado, mejor oferta, propietario,
  **honorarios profesionales** de esa propiedad, **quién la muestra** (designado),
  y **pipeline de interesados** con etapas (consulta → visita → negociación →
  reserva → descartado), oferta y notas.
- **Pendiente de agregar en el boceto — "Vendida por terceros":** el campo
  Estado de la operación (ficha de venta) tiene hoy cuatro opciones (Publicada,
  Reservada, Vendida, Pausada). Hay que sumar una quinta: **"Vendida por
  terceros"** — para cuando la propiedad se vendió, pero no la cerró la
  inmobiliaria (otra inmobiliaria, venta directa entre las partes, etc.). Al
  elegir ese estado debe aparecer un **campo de detalle adicional para
  especificar quién la vendió** (texto libre: nombre de la otra inmobiliaria o
  de quien intermedió). Este estado no debería sumar a los honorarios
  potenciales de Ventas ni a la comisión de la inmobiliaria, ya que la venta no
  la gestionó Facundo Paris Propiedades.
- **Honorarios profesionales por propiedad** (venta y alquiler): cada propiedad
  define los suyos al registrarla o al editar su ficha — opciones **Libre de
  gastos / 3% / 6% / Otros (% libre)**. No hay un % general obligatorio: el valor
  de Configuración es solo el default sugerido. Todos los cálculos (liquidación
  al propietario, honorarios potenciales de venta, caja USD, gráfico Bruto/Neto,
  resumen anual) usan el % propio de cada propiedad.
- **Designado para mostrar:** el equipo se carga en Configuración (una persona
  por línea); cada propiedad —de venta o alquiler— puede tener asignado quién la
  muestra, elegido de esa lista. Se ve en la tarjeta de venta ("La muestra") y en
  la ficha de la propiedad.
- **Bloque CARTELES EN LA CALLE** (al pie de la pestaña): KPIs (colocados, a
  pedido, retirados, propiedades publicadas sin cartel) y tabla de cartelería —
  propiedad, tipo de cartel, medida, fecha de colocación, **días en la calle**,
  estado y acciones de alta/baja. Incluye los carteles de propiedades en
  alquiler, no solo las de venta: el cartel acompaña el ciclo comercial de
  cualquier propiedad publicada.

### 2.4 Caja
- **KPIs (5):**
  - *Ingresos en Pesos*: cobros de alquileres + movimientos manuales en ARS.
  - *Ingresos en Dólares*: lo cobrado en USD — señas de ventas del mes, comisión
    de ventas cerradas en el mes y movimientos manuales en USD. **No es
    conversión**: cada moneda es una caja real separada.
  - *Egresos del mes* (pesos).
  - Los movimientos en EUR se pueden registrar y se ven en el libro con su
    moneda, pero **no tienen KPI propio** (caso excepcional, no habitual).
  - *Ganancia de la inmobiliaria*: honorarios + comisiones − gastos propios.
    No es "ingresos − egresos": el alquiler cobrado es plata del propietario que
    entra y vuelve a salir.
  - *Saldo acumulado* al cierre del mes visto.
- **Libro de movimientos:** navegador de mes, movimientos automáticos
  (ver §3) + manuales (+ Nuevo movimiento: concepto, **moneda ARS/USD/EUR**,
  categoría, medio, fecha, referencia). El saldo corrido y el saldo acumulado
  son solo de la caja en pesos: los movimientos en USD/EUR se muestran con su
  moneda y no afectan el saldo en ARS. Exportar CSV (incluye columna Moneda).
- **Resumen anual:** tabla mes a mes (esperado, cobrado, morosidad, gastos,
  honorarios, liquidado) con navegador de año y exportación.

### 2.5 Incidencias y Proveedores *(fusión)*
- **KPIs:** abiertas, en curso, resueltas este mes, costo pendiente.
- **Tablero de incidencias:** buscador + filtro por estado; alta con propiedad,
  título, descripción, rubro, prioridad, estado, proveedor asignado, reportada
  por, fechas, costo y **"¿Quién paga el costo?"** (desplegable):
  1. *Lo absorbe el propietario* — se descuenta de su liquidación (default)
  2. *Se le traslada al inquilino* — se agrega a su factura
  3. *No se imputa* — lo cubre la inmobiliaria
- **Directorio de proveedores con cuenta corriente:** tarjetas con contacto
  (tel/email/CUIT), rubro, trabajos realizados/pendientes, y la cuenta corriente:
  **Total facturado** (trabajos resueltos con costo) − **Abonado** (pagos
  registrados) = **Saldo a pagar** (en naranja si hay deuda con el proveedor).
  Botón **💵 Pagar saldo** para registrar el pago de todos los trabajos
  pendientes de una vez.
- **Registro de pago por trabajo:** cada incidencia resuelta con costo y
  proveedor muestra en el tablero el botón **💵 Registrar pago** (o la marca
  "✓ abonado el [fecha]" si ya se pagó).
- **Alta de proveedor desde la incidencia:** el desplegable "Proveedor asignado"
  lista los proveedores registrados (nombre · rubro) y ofrece **"+ Nuevo
  proveedor…"**: despliega nombre, rubro y teléfono ahí mismo; al guardar la
  incidencia el proveedor queda registrado en el directorio y asignado. Si no
  se completa el rubro, hereda el rubro de la incidencia.

### 2.6 Clientes
- KPIs (total, buscan alquilar, buscan comprar, sin contactar), buscador y fichas.
- **Ficha del cliente**, en este orden:
  1. **Contacto:** nombre, teléfono, email.
  2. **Qué busca:** *Búsqueda* (desplegable con los tipos de propiedad: Casa,
     Departamento/Dúplex, Quinta, Lote, Campo, Galpón, Local/Oficina,
     Cabañas/Hoteles/Otros, Fondo de comercio, Cocheras) · **Monto — piso y
     techo** (dos campos en USD: "Desde" y "Hasta"; el boceto solo tiene
     "Hasta", falta agregar "Desde" tanto al formulario como a la tarjeta) ·
     *Zona* (Centro / Semicéntrico / Indiferente) · tipo de operación
     (alquilar/comprar/vender) · *Detalle/Descripción* (texto libre: 1 planta,
     terraza, habitaciones…).
  3. **Seguimiento:** estado, origen, **evento agendado** (muestra el próximo
     pendiente, con botón 🗓 **+ Agendar** que abre la agenda ya asociada al
     cliente), **visita con otra inmobiliaria — con quién** (campo libre; si se
     completa, la tarjeta lo destaca en naranja), y **delegado/designado por**
     (elegido de la lista de equipo de Configuración).
- **La tarjeta del cliente debe mostrar, como mínimo:** tipo de propiedad,
  monto (piso y techo) y descripción — el resumen que se necesita ver de un
  vistazo sin abrir la ficha. El boceto hoy resume tipo · hasta US$ · zona ·
  detalle; falta sumar el piso al resumen una vez agregado el campo "Desde".

### 2.7 Agenda
- Calendario mensual con **celdas de altura uniforme** (los días con más de 3
  eventos muestran "+N más"). Eventos: visita, reunión, firma, tasación, llamado,
  tarea; más los **vencimientos y aumentos calculados automáticamente** por el
  sistema. Panel lateral derecho: eventos del día seleccionado o próximos.
  Checkbox "ver los ya hechos".
- **Pendiente de ajustar en el boceto:** el desplegable "Tipo" del formulario
  "+ Nuevo evento" tiene hoy una única opción genérica **"Firma"**. Hay que
  desdoblarla en dos tipos específicos: **"Firma de boleto de compra/venta"**
  y **"Firma de escritura"** — son dos hitos distintos del proceso de venta y
  conviene poder diferenciarlos en la agenda (icono y color propios, igual
  criterio que el resto de los tipos de evento).
- **Incidencias en el calendario:** la *fecha de apertura* de cada incidencia
  sin resolver aparece automáticamente como evento — ícono 🛠, franja naranja,
  título "Incidencia abierta — [título]". Al marcarse Resuelta, desaparece del
  calendario. Es de solo lectura desde Agenda (se edita en Incidencias); un
  clic en la lista de eventos abre directamente esa incidencia.
- **Fecha de ejecución:** al pasar una incidencia a **En curso**, el
  formulario pide además la *fecha de ejecución* (visita del proveedor;
  precargada con hoy, editable). Mientras el estado sea En curso, esa fecha
  también aparece en el calendario — ícono ⚒, franja índigo, título
  "ejecución — [título]" con el proveedor asignado. Al resolverse o volver
  a Abierta, sale del calendario (el dato queda igual en la incidencia).

### 2.8 Avisos
- Mensajes listos para enviar por WhatsApp o email, generados automáticamente y
  agrupados: reclamos de deuda, pedidos de presupuesto, avisos de aumento,
  renovaciones de contrato, clientes sin contactar, recordatorios, liquidaciones
  listas. Cada aviso trae el texto redactado con los montos reales.
- **El mensaje es editable antes de enviar:** el texto predeterminado se muestra
  en un cuadro editable dentro de cada tarjeta; los botones WhatsApp/Email envían
  la versión editada, no la original. La edición no se guarda (al recargar
  vuelve el texto generado con los datos vigentes).

### 2.9 Propietarios y Liquidaciones *(fusión)*
Esta pestaña muestra **solo el Directorio de Propietarios**. El bloque
"LIQUIDACIONES DEL MES" (navegador de mes, totales y tarjetas por propietario
con el detalle) que existía antes se eliminó de esta vista: repetía
información que ya está disponible (el detalle de cobrado/honorarios/gastos
por propiedad vive en Inquilinos y Cobros, y la liquidación de cada
propietario se imprime igual desde su tarjeta del directorio).
- **Directorio de propietarios:** tarjetas con contacto, propiedades asociadas
  (clic → ficha), etiqueta azul **"GRANDES ACTIVOS"** automática si tiene más de
  una propiedad, y botón de imprimir liquidación del mes (que arma el mismo
  detalle propiedad por propiedad — cobrado, gastos, honorarios — al momento
  de emitir el comprobante, sin necesidad de mostrarlo antes en pantalla).

### 2.10 Configuración y Reportes *(fusión)*
Orden de la pestaña: primero la **configuración** (con sus botones de guardar
al cierre), después los **reportes**, y al final la **zona de riesgo**.
- **Reportes:** 9 exportaciones CSV agrupadas con separadores:
  - **💰 Dinero:** cobros del período · gastos y liquidaciones · libro de caja
  - **🏠 Propiedades e inquilinos:** cartera · estado de cuenta de inquilinos · incidencias
  - **☏ Comercial:** base de clientes · agenda · carteles
- Los honorarios **no se configuran acá**: se definen por propiedad al
  registrarla o editarla (libre de gastos / 3% / 6% / otro).
- **Equipo — designados para mostrar:** registro individual de integrantes
  (campo + botón "+ Agregar"; cada integrante en su renglón con botón ✕ para
  quitarlo, con guardado inmediato). La lista alimenta el desplegable
  "Designado para mostrar" de propiedades y clientes. Al quitar a alguien, lo
  ya asignado conserva el nombre.
- **Valores de mercado:** índices IPC e ICL, dólar de referencia.
- **Datos de la inmobiliaria:** nombre, CUIT, dirección, contacto (encabezan
  todos los comprobantes impresos).
- **Numeración de comprobantes:** próxima factura, recibo y liquidación.
- **Parámetros:** día de vencimiento del alquiler, días de anticipación para
  alertas de aumento y de vencimiento, saldo inicial de caja.
- **Reset:** volver a los datos de demostración.

---

## 3. Mapa de conexiones entre funcionalidades

Esta es la lógica que hace que el sistema sea "uno solo" y no módulos sueltos.
**Es lo más importante a conservar en producción.**

### 3.1 El flujo central del alquiler
```
CONTRATO (propiedad + inquilino + índice + frecuencia + punitorios)
   │
   ├─→ PRÓXIMO AUMENTO = último aumento + frecuencia
   │      ├─→ Agenda / Avisos (aviso de aumento redactado con montos reales)
   │      └─→ Calculadora de aumento (ficha) → actualiza monto + historial
   │
   ├─→ COBRO ESPERADO DEL MES = renta vigente según historial
   │      ├─→ Inquilinos y Cobros (tabla del mes)
   │      ├─→ Panel General (estado Pagado / No pagado)
   │      └─→ Registrar pago ──→ INGRESO automático en Caja (pesos)
   │                        ├──→ Recibo imprimible (acredita lo percibido)
   │                        ├──→ Base de la liquidación al propietario
   │                        └──→ Honorarios = % sobre lo cobrado → Ganancia
   │
   └─→ Si no paga: deuda acumulada → KPI, ficha del inquilino,
       aviso de reclamo, cupones de deuda en tanda
```

### 3.2 Gastos: una sola carga, tres destinos
Un gasto se carga una vez (desde Liquidaciones, la ficha de la propiedad, o
automáticamente al resolver una incidencia) y según **quién lo paga**:
- **Propietario** → se descuenta en su liquidación del mes.
- **Inquilino** → se suma a su factura/cupón del mes.
- **Inmobiliaria** (solo incidencias, opción "no se imputa") → no se traslada.

Además, todo gasto genera el **egreso automático en Caja** (la inmobiliaria le
paga al proveedor y después lo recupera del propietario o inquilino).

### 3.3 Incidencias → Proveedores → Gastos
```
INCIDENCIA (abierta) → asignar PROVEEDOR (en curso) → resolver con costo
   ├─→ al marcarse RESUELTA genera el gasto automáticamente
   │   (con el destinatario elegido en "¿Quién paga el costo?")
   ├─→ el trabajo suma al TOTAL FACTURADO del proveedor (cuenta corriente)
   ├─→ REGISTRAR PAGO al proveedor (por trabajo o saldo completo)
   │      ├─→ suma a "Abonado" y baja el "Saldo a pagar" del proveedor
   │      └─→ genera SIEMPRE el egreso automático "Pago a proveedor" en Caja,
   │          en la fecha del pago (información cruzada Incidencias ↔ Caja).
   │          Los gastos nacidos de incidencias NO generan su propio egreso:
   │          la única salida de caja es el pago al proveedor — sin duplicados
   └─→ incidencia sin proveedor → aviso "pedido de presupuesto"
```

### 3.4 Liquidación al propietario
```
LIQUIDACIÓN DEL MES (por propietario) =
    + cobros de sus propiedades (del módulo Cobros)
    − gastos que absorbe (de Gastos/Incidencias)
    − honorarios profesionales (% propio de cada propiedad — ver §2.3)
    = NETO A GIRAR
   ├─→ comprobante imprimible (numerado)
   ├─→ EGRESO automático en Caja ("Liquidación a propietario")
   └─→ aviso "liquidación lista" con el detalle para WhatsApp/email
```
**El cobro de cada propiedad siempre es el valor vigente del alquiler de su
inquilino correspondiente**, no un monto histórico: es el pago que se registró
para ese propietario en Inquilinos y Cobros, y ese pago se calcula sobre la
renta actualizada según el historial de aumentos del contrato (ver §3.1). Si el
propietario tiene más de una propiedad alquilada, la liquidación suma el cobro
real de cada una con su propio inquilino y su propio monto — nunca un valor
único repetido para toda su cartera.

**La factura del inquilino se replica en la liquidación del propietario:**
el "cobrado" de cada propiedad en la liquidación no puede ser un número suelto
— tiene que abrirse en los mismos ítems que la factura emitida a ese inquilino
ese mes (alquiler, expensas, gastos trasladados, saldo arrastrado — ver §3.5),
igual que ya se exige para el recibo. Así el propietario ve, propiedad por
propiedad, de qué conceptos sale lo que se le liquida, y el total cobrado de la
liquidación coincide siempre con el total facturado al inquilino de esa unidad
en ese período — sin ningún cálculo paralelo que pueda desalinearse. Por lo
mismo, la liquidación se abre con los **mismos ítems predeterminados** que la
factura (alquiler al valor vigente, expensas, Usina, Camuzzi, Obras Sanitarias,
Retributivas de Servicios — detalle completo en §3.5), editables y eliminables
igual que ahí.

### 3.5 Factura y recibo al inquilino
- **Factura** = lo que *debe pagar*: alquiler del mes + expensas + gastos
  trasladados + deuda arrastrada de meses anteriores. Se prellena sola con los
  movimientos reales y es editable antes de emitir (ítems que se agregan/quitan).
  Numerada. **Al emitirla, sus ítems quedan guardados en la propiedad** (uno por
  mes; reemplaza al anterior si se vuelve a facturar ese período) — es la fuente
  de verdad para el recibo. La facturación masiva del mes guarda cada factura
  igual que la individual.
- **Ítems predeterminados al abrir la factura (o la liquidación — ver §3.4):**
  la carga inicial siempre trae estos conceptos precargados, en este orden:
  1. **Alquiler** — toma siempre el **valor actual/vigente** del alquiler de
     ese contrato (el monto resultante del último aumento aplicado, igual
     criterio que ya rige para el cobro — ver §3.1), nunca un monto histórico.
  2. **Expensas del mes**
  3. **Usina** (con su número de liquidación)
  4. **Camuzzi** (con su número de liquidación)
  5. **Obras Sanitarias**
  6. **Retributivas de Servicios**

  Todos son **editables** en monto y concepto, y **eliminables** si no
  corresponden ese mes (por ejemplo, una propiedad sin gas de red no tendría
  Camuzzi). Para Usina y Camuzzi, además del monto, el número de liquidación de
  cada boleta es un campo propio y editable — no parte del texto del concepto.
  Se pueden agregar ítems adicionales a mano, igual que hoy.
- **Recibo** = comprobante de lo que *ya pagó*: **toma siempre los mismos
  conceptos de la última factura emitida para ese mes** (nunca un renglón
  genérico de "Alquiler"). Como cada mes tiene a lo sumo una factura vigente
  (volver a facturar el período reemplaza a la anterior — ver arriba), "la
  factura del mes" y "la última factura emitida de ese mes" son la misma cosa;
  si el inquilino tiene facturas de varios meses, el recibo de cada mes usa la
  suya, no la más reciente en términos absolutos. Si no hay factura previa para
  el período, reconstruye el mismo detalle que armaría la factura (alquiler del
  período + gastos trasladados + deuda arrastrada) — factura y recibo cuentan
  siempre la misma historia. Si el monto cobrado no coincide con el total facturado (cobro parcial o de más), el
  recibo ajusta el importe y dejar explícita la diferencia como "Ajuste sobre lo
  facturado". Deshabilitado si no hay pagos registrados. Numerado.
- Ambos salen del diálogo de impresión del navegador → PDF.

### 3.6 Ventas → Caja en dólares
```
PROPIEDAD EN VENTA (precio en USD o ARS, tipo, estado, interesados)
   ├─→ seña recibida (etapa reserva) → INGRESO EN DÓLARES del mes en Caja
   ├─→ venta cerrada → comisión (% Config) → INGRESO EN DÓLARES del mes del cierre
   └─→ comisión potencial → KPI de Ventas y Panel General
```

### 3.7 Configuración como fuente única
Los valores de Configuración alimentan todo el sistema: % honorarios (liquidaciones,
gráfico Bruto/Neto, ganancia), % comisión (ventas, caja USD), índices IPC/ICL
(calculadora, KPIs), dólar de referencia (equivalencias), día de vencimiento
(estado de pago), días de anticipación (alertas), numeración (comprobantes),
datos de la empresa (encabezados de todos los impresos).

### 3.8 Automatismos de Caja
La caja combina movimientos **manuales** (editables) y **automáticos** (solo
lectura, se corrigen en su módulo de origen): cobros de alquiler (ingreso),
gastos de propiedades cargados a mano (egreso), liquidaciones a propietarios
(egreso) y pagos a proveedores registrados en Incidencias (egreso, en la fecha
en que se abonan).

---

## 4. Modelo de datos (entidades del prototipo)

| Entidad | Campos principales |
|---|---|
| **Propiedad** | id, nombre, dirección, modalidad (alquiler/venta), **tipo de propiedad**, monto, **honorarios profesionales** ('libre' o % propio; sin definir → default de Configuración), **designado para mostrar**, índice (IPC/ICL), frecuencia (2/3/4/6/12 meses), inicio/fin de contrato, último aumento, **punitorios** {frecuencia: día/semana/mes/único; tipo: % o monto fijo; valor}, inquilino {nombre, tel, email}, ownerId, historial de aumentos [{fecha, monto}], pagos [{mes, monto, fecha, medio, ref, obs}], gastos [{mes, desc, monto, fecha, categoría, aInquilino}], **facturas [{mes, items[{desc,imp}], total, nro, fecha, vto, tipo}]**, docs, venta {precio, moneda, estado, publicada, reserva, cierre, interesados[]} |
| **Propietario** | id, nombre, tel, email |
| **Proveedor** | id, nombre, rubro, tel, email, CUIT, nota |
| **Incidencia** | id, propiedad, título, desc, rubro, prioridad, estado, proveedor, reportada por, fecha de apertura, **fecha de ejecución**, fecha de cierre, costo, quién paga (aGasto + aInq), abonada (fecha de pago al proveedor), notas |
| **Cliente** | id, nombre, tel, email, tipo de operación, **búsqueda (tipo de propiedad)**, **hasta (USD)**, **zona (Centro/Semicéntrico/Indiferente)**, detalle, estado, origen, **visita con otra inmobiliaria (con quién)**, **delegado/designado**, fecha de alta, notas |
| **Evento** | id, fecha, tipo, título, cliente/propiedad asociada, hecho — más los eventos **automáticos** derivados (no se guardan como registro propio): vencimiento de contrato, aumento próximo, apertura de incidencia sin resolver, y **fecha de ejecución mientras la incidencia esté "En curso"** |
| **Cartel** | propiedad, tipo de cartel, fecha de colocación |
| **Movimiento de caja** | id, fecha, tipo (ingreso/egreso), **moneda (ARS/USD/EUR)**, concepto, categoría, medio, ref (los automáticos se derivan, no se guardan) |
| **Configuración** | honorarios %, comisión %, IPC, ICL, dólar, empresa/CUIT/dir/contacto, numeración (factura/recibo/liquidación), día vencimiento, días de alerta, saldo inicial |

---

## 5. Reglas de negocio clave

1. **Renta vigente:** se deduce del historial de aumentos (el monto vigente a una
   fecha es el del último aumento anterior a esa fecha).
2. **Próximo aumento** = último aumento + frecuencia. "Inminente" si vence en ≤ los
   días configurados (default 30).
3. **Estado de pago binario:** Pagado / No pagado (Pendiente si el mes corre,
   Impago si cerró). El saldo de cobros incompletos pasa a deuda al cerrar el mes.
4. **Deuda:** se calcula sobre los últimos 12 meses.
5. **Honorarios profesionales:** % sobre lo *efectivamente cobrado* (no sobre lo
   esperado), definido **por propiedad** (libre de gastos / 3% / 6% / otro); el
   % de Configuración es solo el valor por defecto para propiedades sin definir.
6. **Punitorios por contrato:** frecuencia (día/semana/mes/único) + tipo (% o
   fijo) + valor. *En el boceto se registran y muestran; el cálculo automático
   sobre pagos tardíos queda definido para producción.*
7. **Monedas:** alquileres siempre en pesos; ventas en ARS o USD. Los ingresos en
   dólares no se convierten: se informan por separado.
8. **Comprobantes numerados** con contadores independientes (factura, recibo,
   liquidación) y datos de la empresa en el encabezado.
9. **"Grandes Activos":** etiqueta automática al propietario con más de 1 propiedad.

---

## 6. Integraciones externas (en el boceto)

- **Calculadora de Arquiler** embebida (iframe `https://arquiler.com/mini`) en la
  ficha de cada alquiler: se calcula ahí y se registra el nuevo monto a mano.
  *Para producción: la API de Arquiler (o BCRA/INDEC) permitiría aplicar el
  aumento sin copiar nada — decisión pendiente.*
- **Canales directos:** SMS (`sms:`), email (`mailto:`) y WhatsApp (`wa.me`) con
  mensajes prellenados desde Avisos, fichas y tarjetas.
- **PDF:** por diálogo de impresión del navegador (sin librerías externas). Los
  diseños de factura/recibo/liquidación del boceto son de referencia; en
  producción se reemplazan por el diseño definitivo manteniendo la estructura.

---

## 7. Decisiones pendientes para producción

**Para el despliegue inicial** (bloquean o completan la primera versión):

1. **Cálculo automático de punitorios** al registrar un pago fuera de término
   (la configuración por contrato ya existe, falta aplicarla al cobro).
2. **Totales de egresos y saldos por moneda extranjera** (los movimientos en
   USD/EUR ya se registran con su moneda, pero los KPIs de egresos y saldo
   acumulado son solo en pesos).
3. **Diseño definitivo de comprobantes** (factura/recibo/liquidación/cupón).
4. **Adjuntos reales** (contratos PDF por propiedad — en el boceto es un placeholder
   con límite de 4 MB en localStorage).

**Para después del despliegue** (mejoras a evaluar con el sistema ya en uso —
van a surgir más ítems en esta lista a medida que el uso real lo pida):

1. **Índices IPC e ICL desde la API del BCRA**, en lugar de carga manual en
   Configuración: el Banco Central publica ambas series por API pública y
   gratuita, sin registro (`https://api.bcra.gob.ar` — Estadísticas Monetarias,
   incluye el ICL entre sus series, y el IPC vía el dataset de INDEC/BCRA). El
   sistema debe traer el último valor publicado, actualizar el KPI del Panel
   General y quedar como fuente de la calculadora de aumentos — con confirmación
   de un clic antes de aplicar cada aumento, nunca en forma silenciosa.
   Requiere conexión a internet; si no hay respuesta de la API, cae al valor
   cargado manualmente en Configuración como respaldo.
