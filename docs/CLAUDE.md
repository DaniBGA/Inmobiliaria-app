# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SGM_AR — sistema de gestión inmobiliaria a medida para "Facundo Paris
Propiedades" (Tandil, Argentina). Un backend + dos frontends independientes
en un monorepo (npm workspaces: `app`, `app/api`, `admin`):

- **`app/api/`** — NestJS + Prisma + PostgreSQL. La API única para todo.
- **`admin/`** — panel de administración interno (React + Vite SPA), sirve
  bajo `/admin/`. Todo lo que hace la inmobiliaria puertas adentro: cobros,
  liquidaciones, facturación, caja, ventas, incidencias, etc.
- **`app/`** — landing pública (React + Vite SPA), sirve en `/`. Catálogo de
  propiedades de solo lectura, consume `GET /public/...` de la misma API.

En dev, ambos frontends conviven en un solo origen: la landing (puerto
5173) proxea `/admin/*` al dev server del admin (puerto 5174) — así el
comportamiento de un solo dominio es igual que en producción.

## Comandos

```bash
# 1. Postgres (Docker)
cd app && docker compose up -d

# 2. Backend
cd app/api
npm install
npm run prisma:migrate      # aplica el schema (dev)
npm run prisma:seed         # Configuración inicial (id=1) + usuario admin
npm run start:dev           # http://localhost:3000

# 3. Panel admin
cd admin && npm install && npm run dev   # http://localhost:5174/admin/

# 4. Landing pública
cd app && npm install && npm run dev     # http://localhost:5173/
```

Login del panel por defecto (creado por el seed): `admin@facundoparis.com`
/ `changeme123` — cambiable con `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.

- **Build**: `npm run build` en cada workspace (`app/api` compila con
  `nest build`; `admin`/`app` corren `tsc -b && vite build`).
- **Typecheck**: `npx tsc --noEmit` en `app/api`, `admin` y `app` — es la
  única verificación automática real hoy (ver "Tests" abajo). Correrlo en
  los tres después de cualquier cambio que toque tipos compartidos
  (DTOs del backend ↔ interfaces del frontend, siempre a mano, no
  generadas).
- **Lint**: `npm run lint` solo existe en `app/api` (`eslint "src/**/*.ts"`).
  Los frontends no tienen lint configurado.
- **Tests**: `npm run test` (jest) está configurado en `app/api` pero **no
  hay ningún `*.spec.ts` todavía** — la verificación de cambios se hace a
  mano: `curl` contra la API corriendo para el backend, y scripts de
  Puppeteer (driving el Chrome real del usuario) para UI. Ver "Verificar
  cambios" más abajo antes de dar algo por probado.
- **Prisma Studio**: `npm run prisma:studio` en `app/api`.

### Migraciones — workflow real de este proyecto

No se usa `prisma migrate dev` interactivo. El patrón establecido:

```bash
cd app/api
# 1. Editar prisma/schema.prisma
# 2. Previsualizar el SQL exacto:
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
# 3. Crear la carpeta a mano con timestamp UTC (formato YYYYMMDDHHMMSS_nombre)
#    y escribir ahí migration.sql con exactamente ese SQL
# 4. Aplicar:
npx prisma migrate deploy
# 5. Regenerar el cliente (ver gotcha de Windows abajo):
npx prisma generate
```

**Gotcha de Windows**: `prisma generate` reescribe el motor nativo
(`.dll`) que el proceso `nest start:dev` ya tiene cargado y bloqueado —
falla en silencio o no aplica el cambio si el backend sigue corriendo.
Hay que matar el proceso que tiene el puerto 3000 (`netstat -ano | grep
:3000` → `taskkill //PID <pid> //F`) **antes** de `prisma generate`, y
recién ahí volver a levantar `npm run start:dev`.

## Arquitectura

### Los tres documentos de referencia (`docs/`)

Antes de asumir cómo funciona algo, leer en este orden:

1. **`docs/CONEXIONES.md`** — el changelog vivo, más autoritativo que
   cualquier otro doc para "qué existe hoy y por qué". Cada feature/fix
   implementado queda anotado ahí con fecha y archivo. **Actualizarlo
   después de cualquier cambio no trivial** (mismo formato que las
   entradas existentes).
2. **`docs/SGM_AR - Documento funcional para produccion.md`** — el spec
   funcional original (módulos §2, mapa de conexiones §3, reglas de
   negocio §5). Sigue siendo la mejor descripción de la intención de
   negocio, pero **partes ya están superadas** por lo implementado
   después (ej. dice "PDF por diálogo de impresión del navegador"; en
   realidad hoy también hay descarga directa a PDF con html2canvas+jsPDF,
   ver abajo).
3. **`docs/STACK_TECNOLOGICO.md`** — la elección de stack original.
   **También parcialmente desactualizado**: menciona TailwindCSS,
   shadcn/ui, TanStack Table, Recharts, Next.js y Puppeteer para PDFs —
   ninguno de esos terminó en el código real (ver "Stack real" abajo).
   Sirve para el *razonamiento* (por qué NestJS, por qué Postgres), no
   para la lista de librerías.

`docs/DEPLOY.md` es preciso y está al día — es la guía real de deploy.

### Stack real (verificado contra package.json, no contra los docs de arriba)

- **Backend**: NestJS + Prisma + PostgreSQL, JWT (passport-jwt) + roles.
  Sin librerías de PDF server-side.
- **Ambos frontends**: React + Vite + TypeScript + React Router +
  TanStack Query. **Sin** Tailwind, sin shadcn/ui, sin Next.js, sin
  TanStack Table, sin Recharts. Estilos: CSS plano a mano — `admin/` tiene
  un único `admin/src/styles/global.css` (737 líneas, todas las clases del
  panel viven ahí); `app/` (landing) separa en `base.css`/`fonts.css`/
  `global.css` + carpetas por sección (`home/`, `layout/`, `pages/`,
  `propiedades/`). Gráficos del Panel General: SVG/canvas hecho a mano, no
  una librería de charts.
- **PDFs**: dos mecanismos distintos, no confundirlos:
  - Impresión real del navegador (Ctrl+P / diálogo nativo) vía
    `@media print` en `global.css` — el `Modal` se portala a
    `document.body` (`admin/src/components/Modal.tsx`) para que el
    contenido imprimible no quede atrapado en el layout normal de la app
    y pueda paginar de verdad en varias hojas.
  - Descarga directa a PDF con un botón, vía `html2canvas` + `jsPDF`
    (`admin/src/lib/pdfComprobante.ts::descargarPdfComprobante()`) —
    clona el nodo `.comprobante`, fuerza visible el membrete (que fuera
    de `@media print` está oculto) y saca el `position:fixed` que usa
    `.comp-pie` en el print (pensado para pegarse al borde de la hoja
    física real) porque html2canvas rasteriza tal cual está en pantalla,
    sin paginación real. El resto del estilo del comprobante (colores/
    bordes/tipografía de `.comp-*`) vive en reglas normales fuera de
    `@media print` justamente para que html2canvas también las agarre sin
    tener que duplicarlas a mano acá. Antes del de clonado no esperaba a
    que los `<img>` del clon terminaran de cargar — como todas las
    mediciones de paginado dependen del layout ya renderizado, una imagen
    (ej. el logo del pie) que tardara en cargar podía dar una altura
    medida menor a la real y desalinear los saltos de hoja (bug
    encontrado 2026-10-01: el pie quedaba cortado a la mitad al saltar de
    hoja) — ahora espera `img.decode()` de todas antes de medir nada. No
    hay marca de agua de fondo en ningún comprobante (se sacó 2026-10-01,
    existía solo en Factura/Recibo).

### Módulos backend (`app/api/src/*`)

Un módulo NestJS por área de negocio, 1:1 con las secciones §2 del
documento funcional (algunos fusionados en el sidebar del admin pero
separados en el código): `propiedades`, `propietarios`, `cobros`,
`gastos`, `facturacion` (Factura + Recibo), `liquidaciones`, `ventas`,
`carteles`, `caja`, `incidencias`, `proveedores`, `clientes`, `agenda`,
`avisos`, `reportes`, `configuracion`, `usuarios`, `integrantes-equipo`,
`public` (endpoints de solo lectura para la landing), `auth`, `email`.
`common/` tiene utilidades compartidas (fechas, honorarios, imágenes) —
revisarlas antes de reimplementar algo que suene a "normalizar un mes" o
"calcular honorarios".

### Invariantes de dominio que no son obvias leyendo un solo archivo

- **Todo "mes" del sistema se normaliza a las 00:00 UTC del día 1** de ese
  mes (`common/fecha.util.ts`: `primerDiaMes`, `mesStringAFecha`,
  `finDeMes`, `fechaAMesString`) — cobros, gastos, facturas y
  liquidaciones comparan/indexan por esa fecha exacta. Un mes armado con
  `new Date()` a secas (con hora local) rompe esas comparaciones.
- **`Configuracion` es una fila singleton** (`id` fijo = 1, no hay
  segunda fila nunca) — fuente única para % de honorarios default,
  IPC/ICL, dólar de referencia, datos de la empresa para comprobantes y
  parámetros como día de vencimiento. `FacturasService`,
  `LiquidacionesService`, etc. la leen, nunca la duplican.
- **Los correlativos de comprobantes (`proximoNumeroFactura`,
  `proximoNumeroRecibo`, `proximoNumeroLiquidacion`) son globales**, no
  por propiedad ni por propietario — viven en esa misma fila de
  `Configuracion`. Emitir por error un comprobante de la entidad
  equivocada (ej. un test mal filtrado que le pega al primer botón que
  matchea en el DOM) quema un número real para siempre; no hay forma de
  "deshacer" salvo re-emitir con el mismo número a mano.
- **`FacturasService::itemsPredeterminados()` es la única implementación**
  de "qué ítems se prellenan al abrir una factura/recibo/liquidación" —
  `LiquidacionesService` y `RecibosService` la reusan en vez de
  reimplementarla. Cualquier cambio ahí (orden de ítems, qué servicios se
  ofrecen, cómo se calcula "lo último facturado") afecta a los tres
  comprobantes a la vez.
- **RBAC con dos roles** (`RolUsuario.ADMIN` / `EQUIPO`): un usuario
  `EQUIPO` (un "designado" vinculado 1:1 a un `IntegranteEquipo` vía
  `usuarioId`) solo ve Ventas y Carteles + Agenda en el sidebar
  (`admin/src/App.tsx`), y la mayoría de los controllers backend tienen
  `@Roles(RolUsuario.ADMIN)` a nivel clase o método como defensa en
  profundidad — un JWT de designado robado no puede pegarle a los
  endpoints que ni siquiera están en su sidebar. Antes de exponer un
  endpoint nuevo, decidir explícitamente si es ADMIN-only o también lo
  necesita `EQUIPO`.
- **Los tres comprobantes (Factura/Recibo/Liquidación) comparten un único
  sistema visual**, clases CSS `comp-liq*` (rediseño de Liquidación
  2026-09-30, extendido a Factura/Recibo 2026-10-01): `.comp-liqinfo` caja
  de datos (Liquidación: 3 columnas en una fila — Propietario/Período/
  Propiedades; Factura/Recibo: 7 campos en dos filas de `.comp-liqinfo`),
  `.comp-liqneto` banner navy ("Neto a girar" en Liquidación, "Total" en
  Factura, "Cobrado" en Recibo), `.comp-liqprop` tarjeta con franja
  izquierda verde azulado `#0D9488` y monto en `--green` (Liquidación: una
  por propiedad; Factura/Recibo: siempre una sola, la propia), `.comp-liqrow`/
  `.comp-liqtotal` renglones planos. Cada documento arma su propio JSX con
  estas clases — `LiquidacionComprobanteBody`
  (`admin/src/components/LiquidacionComprobante.tsx`) para Liquidación,
  directo en `FacturaModal`/`ReciboModal`
  (`admin/src/components/PropiedadFichaDrawer.tsx`) para los otros dos — no
  hay un componente compartido de más alto nivel. `.liqcard`/`.liqline`
  siguen existiendo pero YA NO son de ningún comprobante impreso: quedaron
  exclusivamente para la vista previa editable de Liquidación en pantalla
  (`PropietariosPage.tsx::LiquidacionModal`, antes de emitir), que arma su
  propio markup aparte y no pasa por `.comprobante`. Tipografía
  Helvetica/Arial propia (`--liq-sans` en `global.css`), no la Inter/
  JetBrains Mono del resto del panel. Los tres comparten membrete y pie
  (`ComprobanteImpreso.tsx`) y son visualmente idénticos en eso — ya no
  hay ninguna marca de agua de fondo en ningún comprobante (existía solo
  en Factura/Recibo, se sacó del todo 2026-10-01 por pedido del usuario:
  "eso no está en el diseño de liquidación"). El cuerpo de los tres igual
  va envuelto en un `<div className="comp-cuerpo">` (con
  `position:relative;z-index:1` en `global.css`/`pdfComprobante.ts`) —
  quedó de cuando Factura/Recibo necesitaban eso para no quedar tapados
  por la marca de agua, ya no hace falta para ese motivo puntual pero se
  deja por ser un wrapper inofensivo y consistente entre los tres.
- **El paginado del PDF de Liquidación es manual, no CSS nativo**
  (`admin/src/lib/pdfComprobante.ts::descargarPdfComprobante()`): como
  html2canvas rasteriza TODO el comprobante como una sola imagen larga
  que después se corta en franjas de una hoja A4 cada una, antes de
  rasterizar se insertan `<div>` espaciadores para forzar los saltos de
  hoja "a mano" (función `empujarAHojaNueva()`). Regla actual (pedido del
  usuario 2026-09-30, reemplaza "una propiedad = una hoja" de antes):
  hasta 3 `.comp-propgrupo` (propiedades) por hoja — se fuerza salto cada
  3 (`i % 3 === 0`), sin importar si técnicamente entrarían más; el
  `.comp-totalesgrupo` (resumen) SIEMPRE salta a hoja nueva si el último
  grupo de propiedades quedó lleno (3), y si no, solo si no entra
  completo en lo que queda de la hoja actual; cada hoja forzada repite un
  clon del `.comp-membrete` (encabezado) al principio Y un clon de
  `.comp-pie` (pie) al final de la hoja que termina (pedido del usuario
  2026-10-01: antes el pie solo aparecía en la última hoja, vía
  `margin-top:auto`, que sigue así sin tocar — eso sigue resolviendo
  únicamente el pie de la ÚLTIMA hoja). Ese pie clonado por hoja reserva
  además `MARGEN_PIE_INFERIOR` (40px, nuevo 2026-10-02) de aire antes del
  borde físico de la hoja — con 3 propiedades (que desde el achicado del
  diseño no llenan la hoja entera) el pie quedaba pegado del todo abajo,
  con un hueco enorme arriba de él; el pie de la ÚLTIMA hoja
  (`margin-top:auto`) no se tocó, no se quejaron de ese. Cambiar cuántas
  propiedades entran por hoja es editar el `i % 3 === 0` ahí, no CSS.
- **La deuda/mora acumulada SIEMPRE está acotada por `Propiedad.contratoInicio`**,
  no solo por `Inquilino.alDiaDesde` (fix 2026-10-02 de un bug real
  reportado por el usuario: "cuando se agrega un inquilino nuevo a una
  propiedad que ya se encontraba [ocupada] queda la mora del anterior
  alquiler"). `CobrosService::alDiaDesde()` (privado, usado por
  `deudaAcumulada()`/`moraAcumulada()`/`mesesPendientes()`) ahora toma el
  MÁS TARDE entre `Inquilino.alDiaDesde` (el checkbox manual "Se encuentra
  al día") y `Propiedad.contratoInicio` normalizado a principio de mes —
  antes, si no se tildaba ese checkbox al cargar el inquilino nuevo (caso
  común: queda `null`), la ventana de 12 meses no tenía ningún piso y
  escaneaba meses en los que el inquilino ANTERIOR vivía ahí, arrastrando
  su deuda/mora impaga al nuevo. `contratoInicio` se actualiza siempre al
  asignar un inquilino (`AlquilarPropiedadModal.tsx` → `PATCH
  /propiedades/:id`), así que es un piso objetivo independiente del
  checkbox — el checkbox solo puede correrlo MÁS adelante todavía, nunca
  antes. Como `FacturasService.itemsPredeterminados()` reusa
  `deudaAcumulada()`/`moraAcumulada()` de `CobrosService` (ver el
  invariante de arriba), este fix cubre Factura/Recibo/Liquidación a la
  vez sin tocar nada ahí.
- **`Inquilino` es la relación 1:1 VIGENTE con `Propiedad`, no un
  historial** (`propiedadId @unique`) — al asignar un inquilino nuevo a una
  propiedad ya ocupada, `upsertInquilino()` pisa el mismo registro (mismo
  `id`), así que no queda ningún rastro de quién vivía ahí antes. Por eso
  `Factura` y `Pago` tienen su propio campo `inquilinoNombre` (copia del
  nombre AL EMITIR/AL REGISTRAR, fix 2026-10-02 de un bug real: "cuando
  agrego un inquilino nuevo... los meses anteriores te muestra el nombre
  del inquilino nuevo") — son la fuente de verdad para "a nombre de quién
  fue tal mes", nunca `Propiedad.inquilino` directo para un mes que no sea
  el actual. `CobrosService.resumenMes()` ya prioriza esa copia (factura
  del mes, pago del mes como respaldo, inquilino vigente solo si ninguna de
  las dos existe todavía). **Esto NO reconstruye historia ya perdida**:
  facturas/pagos emitidos ANTES de este fix quedan con
  `inquilinoNombre: null` para siempre (no hay forma de saber quién era),
  así que esos meses van a seguir mostrando el inquilino vigente hasta que
  se sobrescriban con datos nuevos.
- **"Servicios a descontar" de una Liquidación se precarga de la
  liquidación YA EMITIDA del mes, no de una heurística recalculada** (fix
  2026-10-03 de un bug real: "cuando emito una liquidación los datos de
  'Servicios a descontar' no quedan guardados de lo que se emitió
  anteriormente"). `LiquidacionModal`
  (`admin/src/pages/PropietariosPage.tsx`) pide además
  `GET /liquidaciones/propietarios/:id/:mes` (`liquidacionExistente`,
  mismo endpoint que ya usaba `obtenerDelMes`) junto con el `/preview`; si
  ya existe liquidación ese mes, `ajustesServicios` se precarga tal cual
  quedó guardada (montos y N° de liquidación reales) — la heurística vieja
  ("servicios comunes a todas las propiedades, monto vacío") solo corre
  cuando NO hay liquidación previa. Mismo criterio que `facturaExistente`
  en `FacturaModal`. `itemsPorPropiedad` (el lado "Cobrado" por propiedad)
  sigue viniendo del `/preview` sin cambios — ese ya refleja lo persistido
  porque sale de la Factura real de cada propiedad, que tiene su propio
  mecanismo de precarga independiente. Además de esa precarga (que solo
  corre una vez al abrir), hay un segundo `useEffect` independiente con
  dependencia en `itemsPorPropiedad` (fix 2026-10-03 (2): "necesito que
  me actualice en tiempo real los precios... cuando el N° de liq
  coincide en todas las propiedades") que recalcula en cada edición qué
  servicios están presentes en TODAS las propiedades (`SERVICIOS_BASE`)
  y sincroniza el monto de ese renglón de `ajustesServicios` a la suma en
  vivo — sin esperar a reabrir el modal. Solo sincroniza renglones que ya
  existen (no agrega/borra ninguno) y no pisa el campo si la suma da 0.
  **Ajustado 2026-10-15 (7)**: al principio esto exigía que el N° de
  liquidación coincidiera entre propiedades para contar como "mismo
  servicio" — pedido del usuario: "para los servicios... no es necesario
  que el numero de liq sea el mismo para hacer la suma", es normal que
  cada propiedad tenga su propia cuenta/N° de liq para el mismo servicio
  (ej. Usina). Se sacó esa condición del todo: "común" ahora es solo
  "está presente en todas las propiedades", sin importar su N° de liq.
  Esto también resolvía un segundo reporte del mismo mensaje ("el mes que
  le sigue no se guarda el campo que agregué a mano"): la precarga de
  arriba (la que crea el renglón) nunca exigió N° de liq igual, así que
  el renglón de "Usina" SÍ se creaba cada mes — lo que fallaba era que su
  monto se quedaba vacío para siempre si los N° de liq no coincidían
  (porque el sync en vivo, que es el único que completa el monto, antes
  sí lo exigía). El N° de liq del propio renglón de `ajustesServicios`
  (no el monto) sigue sin precargarse si las propiedades no coinciden
  exactamente en el mismo número — eso no cambió, ahí sí hace falta
  adivinar cuál usar y preferible dejarlo en blanco.
- **Badge "Emitido"**: tanto "Inquilinos y Cobros" (tabla "COBROS DEL
  MES") como "Propietarios y Liquidaciones" muestran un badge `Emitido`
  (CSS `.badge.emitido`, indigo) cuando ya existe una Factura/Liquidación
  de ese mes — pedido del usuario 2026-10-03, independiente del badge de
  estado de COBRO (Pagado/Pendiente/Impago). `CobrosService.resumenMes()`
  agrega `facturaEmitida: boolean` a cada fila (reusa el mismo
  `facturaExistente` que ya pedía para `esperado`/`inquilinoNombre`, sin
  query extra). Para Liquidación, que es por-propietario (no hay una fila
  por mes como en Cobros), se agregó
  `LiquidacionesService.propietariosConLiquidacion(mesStr)` +
  `GET /liquidaciones/mes/:mes` (un solo query para toda la lista, no un
  `obtenerDelMes` por tarjeta) que devuelve los `propietarioId` con
  liquidación ya emitida ese mes. **2026-10-15**: ese endpoint ahora
  también manda el `id` de cada `Liquidacion` (antes solo el
  `propietarioId`) — hacía falta para el botón "✕ Eliminar liquidación"
  (`.btn-icon-sm.eliminar`, mismo ícono/patrón que "Eliminar factura" en
  Cobros) que se agregó al lado del badge en la tarjeta del propietario.
  El backend ya tenía `DELETE /liquidaciones/:id`
  (`LiquidacionesService.eliminar()`, usado desde `LiquidacionModal` al
  reemitir sobre una liquidación existente) — lo único nuevo es
  exponerlo también como botón directo en la tarjeta, sin tener que abrir
  el modal. Invalida `['liquidaciones','mes',mes]` + `['caja']` (deshace
  el movimiento de honorarios de administración) + `['reportes']` +
  `['avisos']`, mismo patrón que `generar()`.
- **Badge "Aumento próximo/vencido"**: en las tarjetas de "Inquilinos y
  Cobros" (junto al precio) y en "COBROS DEL MES" (junto a ESPERADO) —
  pedido del usuario 2026-10-15. No es una cuenta nueva: reusa
  `PropiedadesService.proximoAumento()` (la misma que ya usaban la ficha
  individual y Avisos). `PropiedadesService.findAll()` ahora agrega
  `proximoAumento: Date | null` a cada propiedad (`Promise.all` en
  paralelo tras el `findMany`, mismo patrón que `AvisosService.
  avisosAumento()`) y `CobrosService.resumenMes()` agrega el mismo campo
  a cada fila. El frontend decide el estado del cartel con
  `estadoAumento()` (`admin/src/lib/format.ts`): `VENCIDO` si la fecha ya
  pasó, `PROXIMO` si todavía no pero ya entró en la ventana de
  `Configuracion.diasAnticipacionAumento` (mismo criterio que
  `PropiedadFichaDrawer.tsx::aumentoInminente`, centralizado acá en vez
  de quedar reimplementado por pantalla), `null` si no corresponde cartel.
  Visualmente los dos estados se muestran IGUAL (una sola clase CSS
  `.badge.aumento`, roja — pedido del usuario 2026-10-15: "que sea una
  alerta en rojo... en las 2", después de probarlo con próximo en
  naranja y vencido en rojo); la distinción sigue existiendo en el
  texto/tooltip ("Aumento próximo" vs "Aumento vencido"), no en el
  color. En "COBROS DEL MES" el monto de ESPERADO y el cartel van en
  columna (no en fila) para que el monto quede siempre pegado al mismo
  borde derecho que las filas sin cartel — en fila, el cartel empujaba
  el monto hacia la izquierda y desalineaba la columna (mismo reporte,
  con captura).
  No se duplicó esa cuenta en el backend a propósito — el backend solo
  manda la fecha cruda, igual que ya hacía `GET /propiedades/:id/renta-vigente`.
- **"Ver factura" (👁) / "Eliminar factura" (✕) al lado del badge
  "Emitido"** en "COBROS DEL MES" (pedido del usuario 2026-10-15,
  `InquilinosPage.tsx`) — solo aparecen cuando `facturaEmitida` es
  `true`. "Ver factura" reutiliza `FacturaModal`
  (`PropiedadFichaDrawer.tsx`) con la nueva prop `soloVer` en vez de un
  componente aparte: con `soloVer`, `F` (el comprobante a mostrar) sale
  directo de `facturaExistente.data` en lugar de `emitir.data`, nunca se
  renderiza el formulario de edición, y se salta la query de
  `predeterminados` (no hace falta recalcular deuda/mora/servicios para
  solo mostrar lo ya emitido). "Eliminar factura" es
  `DELETE /facturacion/propiedades/:propiedadId/facturas/:mes`
  (`FacturasService.eliminar()`, nuevo) — borrado directo por el índice
  único `propiedadId_mes`, estructuralmente seguro: `FacturaItem` cae en
  cascada y cualquier `Recibo` que la referenciaba solo pierde el
  vínculo (`facturaId` → `SetNull`, el recibo en sí no se borra). No
  toca Pagos ni Liquidaciones ya emitidas — se puede volver a emitir la
  factura de ese mes después sin que nada más se pierda.
- **Todos los modales (`Modal.tsx`) son movibles y minimizables** (pedido
  del usuario 2026-10-15: "que se puedan minimizar y mover como si fueran
  una ventana") — es un cambio en el componente compartido, así que
  cualquier `<Modal>` del panel (editar/cargar datos, Factura/Recibo/
  Liquidación, etc., ~10 archivos) lo tiene gratis, sin tocar cada caller.
  - **Arrastre**: `.modalhead` (antes un `<h2>` suelto) es la barra de
    agarre — `onMouseDown` ahí arranca el drag, `window.mousemove`/
    `mouseup` lo siguen. Mientras nunca se arrastra, `pos` queda `null` y
    el modal se sigue comportando EXACTO que antes (centrado por el flex
    de `.modal`, `position:relative` de `.modalcard`); recién el primer
    drag mide con `getBoundingClientRect()` la posición visual actual y
    pasa a `position:fixed` con `left`/`top` en píxeles puestos por JS —
    sin salto visual. Clamp simple en `X`/`Y` para no poder soltarlo
    completamente fuera de pantalla (siempre queda al menos un pedazo de
    la barra agarrable).
  - **Minimizar**: colapsa `.modalcard` a `display:none` (NO desmonta
    `children` — el estado de un formulario a medio cargar sobrevive) y
    porta un "pill" con el título a una bandeja compartida en `<body>`
    (`#modal-tray`, `getTray()` la crea una sola vez) — todas las
    instancias de `Modal` que estén minimizadas a la vez se apilan solas
    ahí vía flexbox, sin que ninguna sepa de las demás. Clic en el pill
    restaura; la ✕ del pill cierra directo.
  - **Bug evitado**: `.modal` es `position:fixed;inset:0` — minimizar
    SOLO ocultando `.modalcard` no alcanza, ese div transparente seguía
    tapando toda la pantalla y bloqueando clics. Se le agrega
    `pointerEvents:'none'` cuando está minimizado (verificado con
    Puppeteer: `document.elementFromPoint()` sobre un botón detrás del
    modal da el botón real, no el div del modal).
  - **Riesgo real que esto tocaba y cómo se evitó**: Factura/Recibo/
    Liquidación imprimen su comprobante vía `.modalcard` portado a
    `<body>` (ver comentario de `Modal.tsx`) — `@media print` necesita
    que `.modalcard` sea `position:static` (si no, el comprobante no se
    fragmenta en varias hojas, bug ya documentado antes en este archivo).
    El drag deja `.modalcard` con `position:fixed` puesto por estilo
    inline — un inline style le gana a cualquier regla de hoja de
    estilos SIN `!important`, así que `@media print .modalcard
    {position:static}` (como estaba) hubiera perdido esa pelea y se
    repetía el bug del corte en una sola hoja para cualquier comprobante
    que se hubiera arrastrado antes de imprimir. Se le agregó
    `!important` a esa única declaración en global.css — verificado con
    Puppeteer (`page.emulateMediaType('print')`) que, después de
    arrastrar un modal, `getComputedStyle().position` da `fixed` en
    pantalla y `static` en modo impresión.
  - [x] **Verificado con Puppeteer contra el dev server real**
    (`admin` en `http://localhost:5174/admin/`, login real): abrir modal
    → arrastrar (confirmado `left`/`top` coinciden con el delta del
    mouse) → minimizar (confirmado `.modalcard{display:none}`,
    `.modal{pointer-events:none}`, pill en la bandeja, fondo clickeable)
    → restaurar (reaparece en la MISMA posición arrastrada) → cerrar con
    la ✕ del encabezado (desaparece del DOM) → reabrir, arrastrar de
    nuevo y confirmar `position:fixed` en pantalla / `static` en modo
    impresión. `puppeteer-core` se instaló solo para esta verificación
    (`npm install --no-save`, después `npm uninstall --no-save`) — no
    quedó como dependencia del proyecto.
- **"Deuda arrastrada" ya NO se re-factura como ítem** (sacada del todo
  2026-10-15 por pedido del usuario: "la deuda arrastrada no tendria que
  aparecer, lo que tendria que aparecer en cada mes si no se pago es la
  mora por demora") — ese alquiler ya se facturó una vez, en SU mes;
  repetirlo en una factura posterior era pedírselo dos veces al
  inquilino. `FacturasService.itemsPredeterminados()` ya no agrega ese
  ítem; lo único que sigue apareciendo cada mes mientras algo siga impago
  es la mora ("Mora acumulada (X días)" de meses cerrados + "Recargo por
  mora" del mes en curso, sin cambios en su cálculo). Como Liquidación
  reusa esos mismos ítems (ver el invariante de `itemsPredeterminados()`
  más arriba), el fix cubre Factura/Recibo/Liquidación a la vez.
  `CobrosService.esperadoEstimado()` (el "Esperado" que se ve en Cobros
  del mes ANTES de emitir la factura) pasó de sumar `deudaAcumulada()` a
  sumar `moraAcumulada()` — mismo motivo que el fix original del
  2026-09-02 (que agregó `+ deuda` ahí): que el preview coincida con el
  total real que va a tener la factura al emitirla.
  - **`CobrosService.deudaAcumulada()` NO se tocó** — sigue siendo la
    fuente real de "cuánto debe en total" para `mesesPendientes()` (el
    selector de "Pago de alquiler" en Caja, que necesita saber contra
    qué mes concreto se aplica un pago) y para `fichasInquilinos()` /
    `AvisosService.reclamosDeuda()` (el monto que se le recuerda a un
    inquilino por WhatsApp). **Deliberadamente no se tocaron esos dos**
    aunque calculan sobre la misma `deudaAcumulada()` — cambiarlos a
    mora haría que el card "Deuda de Inquilinos" de Panel General
    mostrara un número mucho más chico y mal etiquetado (es mora, no
    deuda) y, peor, que el recordatorio de WhatsApp a un inquilino le
    cobre de menos (solo la mora, no el alquiler real que debe). Si en
    algún momento se pide que esos también dejen de usar el monto
    crudo, hay que decidir con cuidado qué mostrarles en su lugar — no
    es un simple find-and-replace de `deudaAcumulada()` por
    `moraAcumulada()`.
  - **Caso límite sin cubrir**: una propiedad SIN `punitorioTipo`/
    `punitorioValor` configurado nunca genera mora (`moraAcumulada()`
    devuelve `{mora: 0}` siempre) — para esas propiedades, un mes impago
    ya no deja NINGÚN rastro en la factura del mes siguiente (ni deuda
    ni mora). Antes de este cambio, al menos quedaba "Deuda arrastrada".
    No se resolvió porque no se pidió explícitamente; si hace falta un
    fallback para propiedades sin mora configurada, hay que decidirlo.
  - [x] **Verificado con curl, datos `TEST` creados y borrados al
    final**: propiedad con `punitorioTipo: PORCENTAJE` (1%/día), dos
    meses cerrados sin pagar (agosto y septiembre) — `GET
    /facturacion/propiedades/:id/items-predeterminados?mes=2026-10`
    devolvió `Alquiler` + `Mora acumulada (41 días de atraso)` ($41.000)
    + `Recargo por mora (5 días)` ($5.000), SIN `Deuda arrastrada`. `GET
    /cobros/mes/2026-10` devolvió `esperado: 141000` (= 100.000 alquiler
    + 41.000 mora acumulada, coincide exacto con la suma de los ítems
    sugeridos salvo el recargo del mes en curso, que nunca entró en
    "Esperado" ni antes ni ahora). `GET /liquidaciones/propietarios/:id/
    2026-10/preview` devolvió exactamente los mismos ítems que la
    factura. `npx tsc --noEmit` sin errores en `app/api/`.
- **"Descargar PDF" deja elegir carpeta/nombre** (pedido del usuario
  2026-10-15, en Factura/Recibo/Liquidación) — `lib/pdfComprobante.ts` se
  partió en tres funciones: `generarPdfComprobante()` (privada, arma el
  PDF y devuelve un `Blob`, es la que tenía toda la lógica de paginado
  que ya existía), `descargarPdfComprobante()` (pública, descarga
  silenciosa de siempre — la sigue usando SOLO
  `useEnviarComprobantePorWhatsapp.ts`, porque ahí el archivo es un
  intermedio descartable y preguntar dónde guardarlo sería fricción de
  más) y `guardarPdfComprobante()` (pública, nueva — la que llaman los 4
  botones reales de "Descargar PDF": `PropietariosPage.tsx`,
  `PropiedadFichaDrawer.tsx` ×2 — Factura y Recibo — y `AvisosPage.tsx`).
  - `guardarPdfComprobante()` usa la File System Access API
    (`window.showSaveFilePicker`, tipos propios en
    `src/file-system-access.d.ts` — no está en `lib.dom.d.ts` todavía) —
    **solo Chrome/Edge**, no Firefox/Safari; sin soporte, o si el picker
    falla por cualquier motivo que no sea que el usuario lo canceló a
    propósito (`AbortError`), cae sola a la descarga silenciosa de
    siempre. El diálogo se abre ANTES de generar el PDF (no después) a
    propósito: `showSaveFilePicker()` necesita "user activation"
    reciente, y html2canvas puede tardar unos segundos en un comprobante
    de varias hojas — pedirlo recién al final arriesgaba que Chrome lo
    rechazara por haberse quedado sin esa activación.
  - Nombre de archivo por defecto (pedido del usuario: "que no diga
    'liquidacion ... y nombre'"): `nombreArchivoComprobante(nombre,
    mesStr)` en `lib/format.ts`, da `"{nombre} {mesLabel}.pdf"` — p. ej.
    "Juan Perez Octubre 2026.pdf", sin el "Liquidacion N° -"/"Factura N°
    -" de antes. `nombre` es el PROPIETARIO para Liquidación, el
    INQUILINO para Factura/Recibo (antes Factura/Recibo usaban el nombre
    de la PROPIEDAD, no de la persona — también se corrigió). **Riesgo a
    tener en cuenta**: dos documentos del mismo mes para la misma persona
    (p. ej. Factura y Recibo del mismo inquilino) ahora pueden pedir
    sugerir el MISMO nombre de archivo — no se agregó ningún
    desambiguador porque no se pidió, pero si en la práctica choca, es
    una línea agregar de vuelta algo que lo distinga.
  - **Bug real encontrado probando esto con Chrome automatizado
    (Puppeteer + CDP)**: `descargarBlob()` (el helper que dispara la
    descarga con un `<a download>`) revocaba la URL del blob
    (`URL.revokeObjectURL`) INMEDIATAMENTE después del click — un repro
    mínimo (blob de texto plano, sin nada de PDF/html2canvas de por
    medio) mostró que Chrome a veces sigue leyendo el blob de forma
    asíncrona después del click, y revocarlo tan rápido puede cancelar
    la descarga a mitad de camino. Fix: ahora se revoca recién 2
    segundos después (`setTimeout`), y el `<a>` se agrega al DOM antes
    del click y se saca después (antes quedaba suelto).
- **Favicon + logo de login + nombre del sistema** (pedido del usuario
  2026-10-15): el admin no tenía ningún favicon propio (ni carpeta
  `public/` todavía) y el login mostraba un ícono abstracto dibujado en
  CSS (nunca hubo logo real) junto al texto "SGM_AR". Se usó el mismo
  archivo que ya era el favicon de la landing pública (`app/public/
  favicon.png`), que resultó ser un byte-a-byte idéntico a `app/src/
  logos/LOGO PNG.-10.png` (ver convención de variantes de logo ahí:
  `-02` es el logo completo del header, `-10` es la marca/isotipo solo,
  pensado para usos chicos como favicon).
  - `admin/public/favicon.png` (nuevo) + `<link rel="icon" type="image/
    png" href="favicon.png" />` en `admin/index.html` — el `href` es
    RELATIVO a propósito (sin `/` inicial): el admin vive bajo `base:
    '/admin/'` (ver `vite.config.ts`), así que un `href="/favicon.png"`
    apuntaría a la raíz del dominio (territorio de la landing pública en
    `app/`, otro proyecto Vite con su propio `public/`), no al propio.
    Verificado contra el dev server real: Vite reescribe el relativo a
    `/admin/favicon.png` en dev, y en el build de producción lo deja
    relativo (`favicon.png`) en `dist/index.html`, que resuelve igual de
    bien una vez desplegado bajo `/admin/`.
  - `admin/src/images/icono.png` (nuevo, mismo archivo) — importado como
    módulo en `LoginPage.tsx` (`import icono from '../images/icono.png'`,
    mismo patrón que ya usa `app/` para sus logos) y renderizado como
    `<img className="logo">` en vez del viejo `<div className="logo">
    <span></span></div>`. `.brand .logo` en `global.css` perdió el fondo
    oscuro/recuadro de antes (ya no hace falta, ahora es una imagen real)
    y quedó en `object-fit:contain` para no recortar el logo real sea
    cual sea su proporción.
  - **Nombre**: `<title>` de `index.html` y el `<span className="btxt">`
    del login pasaron de "SGM_AR"/"SGM_AR — Sistema de Gestión
    Inmobiliaria" a, nada más, "Sistema de Gestión" (pedido explícito:
    "sacale 'SGM-AR' y dejale solamente 'sistema de gestion'"). Queda un
    poco redundante con el subtítulo de abajo del login ("Sistema de
    Gestión Inmobiliaria — Facundo Paris Propiedades", sin tocar, no se
    pidió) — se avisó esto en la respuesta al usuario en vez de decidir
    unilateralmente sacarlo también.
  - [x] **Verificado con Puppeteer contra el dev server real**: título
    de pestaña, `<link rel="icon">` resolviendo a `/admin/favicon.png`
    (200), el `<img>` del login cargando de verdad (`naturalWidth/
    Height` = tamaño real del archivo, `complete: true`, nada de imagen
    rota) y el texto del `.btxt` leyendo "Sistema de Gestión" — además
    de una captura de pantalla real del login para confirmar que se ve
    bien (sin recortes ni distorsión). `npx tsc --noEmit` y `npx vite
    build` sin errores.
- **Plantillas editables para los 7 tipos de Aviso** (pedido del usuario
  2026-10-15: "asi como el mensaje de whatsapp me deje modificar un
  mensaje base para los distintos tipos de avisos") — mismo mecanismo
  que ya existía para `facturaWhatsappMensaje` (placeholders `{clave}`),
  extendido a `AvisosService`. 7 campos nuevos en `Configuracion`
  (`avisoReclamoDeudaMensaje`, `avisoAumentoMensaje`,
  `avisoRenovacionMensaje`, `avisoClienteSinContactarMensaje`,
  `avisoRecordatorioMensaje`, `avisoLiquidacionListaMensaje`,
  `avisoPedidoPresupuestoMensaje`), cada uno con de default el texto
  hardcodeado que ya existía. Nuevo helper compartido
  `common/plantilla.util.ts::aplicarPlantilla(plantilla, valores)`
  (mismo "split+join" por placeholder que ya usaba el frontend para
  `facturaWhatsappMensaje`, centralizado acá porque Avisos arma el texto
  final en el BACKEND, no al momento de enviar).
  - Cada uno de los 7 métodos privados de `AvisosService` (antes
    armaban el `texto` con un template literal hardcodeado) ahora recibe
    `configuracion: Configuracion` como parámetro y llama
    `aplicarPlantilla(configuracion.avisoXMensaje, {...})` — `generar()`
    pide `configuracion` UNA sola vez (antes algunos métodos la pedían
    cada uno por su cuenta para `diasAnticipacionAumento`/
    `diasAnticipacionVencimiento`, otros no la pedían nunca) y se la pasa
    a los 7.
  - `ConfiguracionPage.tsx`: nueva sección "◐ AVISOS" (7 `.cfgcard`, uno
    por tipo, mismo patrón visual que "MENSAJE DE WHATSAPP — FACTURAS")
    con su propio `.hint` listando los placeholders válidos de ESE
    tipo — no son intercambiables entre tipos (ej. `{deuda}` solo existe
    en el de Reclamo de deuda).
  - El texto YA GENERADO sigue siendo editable a mano en la tarjeta de
    Avisos antes de enviar, sin persistir esa edición puntual (sin
    cambios ahí) — lo nuevo es la plantilla BASE con la que arranca cada
    vez, antes fija en el código.
  - [x] **Bug real encontrado y corregido al verificar**: al restaurar a
    mano (por curl) el valor por defecto de una plantilla después de
    probarla con un texto custom, el `-d` de curl con el JSON embebido
    directo en el comando de shell corrompió los acentos/signos
    (quedaron como U+FFFD, carácter de reemplazo Unicode) — confirmado
    comparando el valor devuelto por la API contra el string esperado
    byte a byte en Python (`val == expected` daba `False` a pesar de
    "verse bien" en la terminal). Se corrigió mandando el PATCH con
    `curl --data-binary @archivo.json`, un archivo escrito a mano con
    `encoding='utf-8'` explícito en vez de interpolar el texto en el
    comando — la fila real de `Configuracion` (no un dato `TEST`, la
    fila singleton que usa toda la app) quedó restaurada exacta. Moraleja
    para la próxima vez que haya que mandar texto en español con
    acentos/signos por `curl` desde esta terminal: nunca confiar en que
    "se ve bien" al imprimirlo — comparar bytes de verdad.
  - [x] **Verificado con curl contra la API real**: los 7 defaults
    devueltos por `GET /configuracion` comparados byte a byte en Python
    contra los strings esperados (los 7 dieron `True`); un cliente
    `TEST` sin contactar generó el aviso con el texto default
    sustituido correctamente; se cambió la plantilla vía `PATCH
    /configuracion` y el mismo aviso reflejó el texto nuevo en la
    siguiente consulta; se restauró el default y se confirmó
    nuevamente byte a byte. Dato `TEST` borrado al final. `npx tsc
    --noEmit` y `npx vite build` sin errores.

### Verificar cambios (no hay test suite)

El patrón establecido en este repo, en ausencia de tests automatizados:

- **Backend**: probar con `curl` contra la API corriendo (login →
  guardar token → ejercitar el endpoint → limpiar los datos de prueba al
  final).
- **Frontend**: scripts de Puppeteer (`puppeteer-core` apuntando al
  Chrome instalado del usuario) que loguean, navegan y verifican con
  capturas o `document.body.innerText`.
- **Higiene de datos de prueba — importante**: cualquier entidad de
  prueba se crea con el prefijo `TEST` en el nombre y se borra al
  terminar. Al automatizar clicks en la UI, **acotar siempre la búsqueda
  del elemento** al contenedor específico de la entidad de prueba (nunca
  `document.querySelectorAll('button')` global) y verificar con
  `document.body.innerText.includes(NOMBRE_DE_PRUEBA)` antes de cualquier
  click que persista datos (emitir factura/liquidación, etc.) — un
  `querySelectorAll` sin acotar ya disparó por error la emisión de una
  liquidación real más de una vez en sesiones anteriores, quemando el
  número de comprobante (ver nota de correlativos globales arriba).

### Deploy

Un solo dominio, Caddy como reverse proxy: `/` → landing estática, `/admin/`
→ panel estático, `/api/` → backend NestJS corrido con PM2 (sin Docker
para el backend), Postgres en Docker escuchando solo en `127.0.0.1`. Guía
completa y al día en `docs/DEPLOY.md`; actualizar código en el VPS con
`bash deploy/deploy.sh` (hace `git pull` + install + build de los tres
workspaces + `prisma migrate deploy` + reinicio PM2 + reload de Caddy).
