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
    de `@media print` está oculto) y convierte los elementos
    `position:fixed` del print (marca de agua, matrícula, pie) a
    posicionamiento absoluto/normal porque html2canvas rasteriza tal cual
    está en pantalla, sin paginación real.

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
