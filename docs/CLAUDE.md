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
- **"Servicios a descontar" de Liquidación**: se precarga de la
  liquidación YA EMITIDA del mes si existe (`LiquidacionModal` en
  `PropietariosPage.tsx` pide `GET /liquidaciones/propietarios/:id/:mes`
  además del `/preview`); si no, de una heurística (servicios de
  `SERVICIOS_BASE` presentes en TODAS las propiedades, monto vacío). Un
  segundo `useEffect` mantiene el monto de cada renglón sincronizado en
  vivo con la suma real mientras se edita — "común" es solo "está
  presente en todas las propiedades", NO exige que coincida el N° de
  liquidación entre ellas (es normal que cada una tenga su propia cuenta
  para el mismo servicio, ej. Usina). El N° de liquidación del renglón en
  sí sigue sin precargarse si las propiedades no coinciden exacto — ahí
  no hay forma correcta de adivinar cuál usar.
- **Badge "Emitido"**: en "Inquilinos y Cobros" (`facturaEmitida` en cada
  fila de `CobrosService.resumenMes()`) y en "Propietarios y
  Liquidaciones" (`LiquidacionesService.propietariosConLiquidacion(
  mesStr)` + `GET /liquidaciones/mes/:mes`, devuelve `{id,
  propietarioId}[]`) — independiente del badge de estado de cobro. El
  botón "✕ Eliminar" al lado usa ese `id` de Liquidación (`DELETE
  /liquidaciones/:id`) o `propiedadId`+`mes` para Factura (`DELETE
  /facturacion/propiedades/:id/facturas/:mes`, borrado seguro:
  `FacturaItem` cae en cascada, `Recibo.facturaId` solo pierde el
  vínculo vía `SetNull`, no se borra el recibo). Ninguno de los dos toca
  Pagos ni el otro documento — se puede volver a emitir después.
- **"Ver factura" (👁)** junto al badge "Emitido" en Cobros reusa
  `FacturaModal` con la prop `soloVer`: el comprobante sale directo de
  `facturaExistente.data` (no de `emitir.data`), nunca se renderiza el
  formulario de edición ni se pide `predeterminados`.
- **Badge "Aumento próximo/vencido"**: en las tarjetas de "Inquilinos y
  Cobros" (junto al precio) y en "COBROS DEL MES" (junto a ESPERADO).
  Reusa `PropiedadesService.proximoAumento()` (misma que la ficha
  individual y Avisos) — el backend solo manda la fecha cruda
  (`PropiedadesService.findAll()` y `CobrosService.resumenMes()` agregan
  `proximoAumento: Date | null`), el frontend decide el estado con
  `estadoAumento()` (`admin/src/lib/format.ts`) contra
  `Configuracion.diasAnticipacionAumento`. Visualmente VENCIDO y PROXIMO
  son iguales (una sola clase roja `.badge.aumento`) — la distinción
  queda solo en el texto/tooltip. En "COBROS DEL MES" el monto de
  ESPERADO y el cartel van en columna, no en fila, para que el monto no
  se desalinee con las filas sin cartel.
- **`Modal.tsx` es movible y minimizable** — cambio en el componente
  compartido, todo `<Modal>` del panel lo hereda gratis. `.modalhead` es
  la barra de arrastre: `pos` queda `null` hasta el primer drag
  (comportamiento idéntico a antes), después pasa a `position:fixed` con
  `left`/`top` en píxeles puestos por JS, con clamp simple para no
  perderlo fuera de pantalla. Minimizar colapsa `.modalcard` a
  `display:none` SIN desmontar `children` (un formulario a medio cargar
  sobrevive) y porta un "pill" a una bandeja compartida `#modal-tray` en
  `<body>` — varias instancias minimizadas a la vez se apilan solas vía
  flexbox. El `.modal` padre (`position:fixed;inset:0`) necesita
  `pointerEvents:'none'` mientras está minimizado, si no sigue
  bloqueando clics aunque esté "vacío". **Gotcha de impresión**: el drag
  deja `.modalcard` con `position:fixed` puesto por estilo inline, que le
  gana a cualquier regla de hoja de estilos sin `!important` — por eso
  `@media print .modalcard{position:static!important}` en `global.css`
  lleva `!important` a propósito; sin él, un comprobante arrastrado antes
  de imprimir se cortaría en una sola hoja en vez de fragmentarse en
  varias (mismo bug de paginado documentado más arriba).
- **"Deuda arrastrada" ya NO se re-factura como ítem** (2026-10-15) — ese
  alquiler ya se facturó una vez, en su propio mes; repetirlo en una
  factura posterior era pedírselo dos veces al inquilino.
  `FacturasService.itemsPredeterminados()` ya no la agrega; lo único que
  sigue representando un mes impago es la mora ("Mora acumulada" de
  meses cerrados + "Recargo por mora" del mes en curso, sin cambios en
  su cálculo). Como Liquidación reusa esos ítems, el fix cubre
  Factura/Recibo/Liquidación a la vez. `CobrosService.esperadoEstimado()`
  pasó de sumar `deudaAcumulada()` a sumar `moraAcumulada()`, para que el
  "Esperado" preview (antes de emitir factura) coincida con lo que la
  factura real va a sumar.
  - `CobrosService.deudaAcumulada()` en sí NO se tocó — sigue siendo la
    fuente real de "cuánto debe en total" para `mesesPendientes()` (Caja)
    y `fichasInquilinos()`/`AvisosService.reclamosDeuda()` (recordatorio
    de WhatsApp al inquilino). Decisión deliberada de no tocarlos:
    cambiarlos a mora subestimaría lo que un inquilino realmente debe.
  - Caso límite sin cubrir: una propiedad sin `punitorioTipo` configurado
    nunca genera mora, así que un mes impago ahí ya no deja ningún
    rastro en la factura siguiente (antes al menos quedaba "Deuda
    arrastrada"). No se pidió un fallback, no se armó ninguno.
- **"Descargar PDF" deja elegir carpeta/nombre** — `lib/pdfComprobante.ts`
  partido en `generarPdfComprobante()` (arma el PDF, devuelve un `Blob`),
  `descargarPdfComprobante()` (descarga silenciosa, la sigue usando solo
  el envío por WhatsApp, donde el archivo es descartable y preguntar
  dónde guardarlo sería fricción de más) y `guardarPdfComprobante()`
  (nueva, la usan los 4 botones reales de "Descargar PDF"). Usa
  `window.showSaveFilePicker` (File System Access API, tipos propios en
  `src/file-system-access.d.ts` — no está en `lib.dom.d.ts` todavía,
  solo Chrome/Edge) — el diálogo se abre ANTES de generar el PDF, no
  después, porque esa API necesita "user activation" reciente y
  html2canvas puede tardar unos segundos en un comprobante largo. Sin
  soporte, o si falla por otro motivo que no sea que el usuario canceló,
  cae a la descarga silenciosa de siempre. Nombre por defecto:
  `nombreArchivoComprobante(nombre, mesStr)` en `lib/format.ts` →
  `"{nombre} {mesLabel}.pdf"` — PROPIETARIO para Liquidación, INQUILINO
  para Factura/Recibo (antes usaban el nombre de la propiedad, no de la
  persona). Riesgo sin resolver: Factura y Recibo del mismo inquilino el
  mismo mes pueden sugerir el mismo nombre de archivo. **Gotcha de
  blobs**: `descargarBlob()` revoca la URL del blob 2 segundos después
  del click (no de inmediato) y agrega el `<a>` al DOM antes de
  clickearlo — revocar enseguida puede cancelar la descarga a mitad de
  camino en Chrome (confirmado con un repro mínimo vía Puppeteer+CDP).
- **Favicon + logo de login + nombre "Sistema de Gestión"** —
  `admin/public/favicon.png` + `admin/src/images/icono.png` (mismo
  archivo: `app/src/logos/LOGO PNG.-10.png`, el isotipo chico de la
  marca — `-02` es el logo completo que usa el header de la landing). El
  `href` del favicon en `admin/index.html` es RELATIVO a propósito: el
  admin vive bajo `base: '/admin/'`, un href absoluto apuntaría a la
  raíz del dominio (territorio de la landing pública, otro proyecto Vite
  con su propio `public/`). `<title>` y el texto junto al logo del login
  dicen "Sistema de Gestión" (ya no "SGM_AR") — queda redundante con el
  subtítulo de abajo del login, que no se tocó porque no se pidió.
- **Plantillas editables para los 7 tipos de Aviso** — mismo mecanismo
  que `facturaWhatsappMensaje` (placeholders `{clave}`), extendido a
  `AvisosService`: 7 campos `String` en `Configuracion`
  (`avisoReclamoDeudaMensaje`, `avisoAumentoMensaje`,
  `avisoRenovacionMensaje`, `avisoClienteSinContactarMensaje`,
  `avisoRecordatorioMensaje`, `avisoLiquidacionListaMensaje`,
  `avisoPedidoPresupuestoMensaje`), sustituidos con
  `common/plantilla.util.ts::aplicarPlantilla()`. A diferencia de
  Factura (donde el frontend sustituye la plantilla recién al enviar),
  acá la sustitución pasa en el BACKEND porque `AvisosService` arma el
  `texto` final ahí mismo — `generar()` pide `configuracion` UNA sola
  vez y se la pasa a los 7 métodos privados. `ConfiguracionPage.tsx`
  tiene una tarjeta por tipo con sus propios placeholders válidos (no
  intercambiables entre tipos, ej. `{deuda}` solo existe en Reclamo de
  deuda). El texto generado se sigue editando a mano en la tarjeta de
  Avisos antes de enviar, sin persistir esa edición puntual — lo nuevo es
  la plantilla BASE con la que arranca cada vez.

### Verificar cambios (no hay test suite)

El patrón establecido en este repo, en ausencia de tests automatizados:

- **Backend**: probar con `curl` contra la API corriendo (login →
  guardar token → ejercitar el endpoint → limpiar los datos de prueba al
  final).
- **Frontend**: scripts de Puppeteer (`puppeteer-core` instalado ad-hoc
  con `npm install --no-save` y desinstalado al terminar — no es
  dependencia del proyecto — apuntando al Chrome instalado del usuario)
  que loguean, navegan y verifican con capturas, `document.body.
  innerText` o eventos CDP (`Browser.downloadProgress`, etc. para
  verificar descargas).
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
- **Cuidado con acentos/ñ/¿/¡ en `-d` de curl desde esta terminal**:
  pueden corromperse en caracteres de reemplazo Unicode (U+FFFD) sin que
  se note mirando la salida en pantalla ("se ve bien" no es evidencia —
  comparar el valor devuelto por la API contra el string esperado byte a
  byte, ej. en Python). Para mandar texto en español con acentos, mejor
  escribirlo a un archivo aparte con `encoding='utf-8'` explícito y
  mandarlo con `curl --data-binary @archivo.json` en vez de interpolarlo
  directo en el comando — esto ya corrompió una fila real de
  `Configuracion` (no un dato `TEST`) una vez.

### Deploy

Un solo dominio, Caddy como reverse proxy: `/` → landing estática, `/admin/`
→ panel estático, `/api/` → backend NestJS corrido con PM2 (sin Docker
para el backend), Postgres en Docker escuchando solo en `127.0.0.1`. Guía
completa y al día en `docs/DEPLOY.md`; actualizar código en el VPS con
`bash deploy/deploy.sh` (hace `git pull` + install + build de los tres
workspaces + `prisma migrate deploy` + reinicio PM2 + reload de Caddy).
