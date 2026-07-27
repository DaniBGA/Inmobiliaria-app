# SGM_AR — Stack Tecnológico para Producción

> Documento de referencia técnica. Complementa `SGM_AR - Documento funcional
> para produccion.md` (qué hace el sistema) con **cómo se construye**.
> Restricciones de partida: sin preferencia previa de lenguaje de backend,
> hosting en **VPS económico autogestionado**, y la página pública se
> reconstruye replicando el diseño/contenido actual (el archivo que existe hoy
> es un bundle exportado sin código fuente editable, no HTML de verdad).

---

## 1. Resumen del stack

| Capa | Elección | Motivo principal |
|---|---|---|
| Base de datos | **PostgreSQL** | Dominio financiero/relacional, necesita transacciones ACID reales |
| Backend | **Node.js + TypeScript + NestJS + Prisma** | Estructura modular 1:1 con los 10 módulos del sistema; un solo lenguaje en todo el stack |
| Frontend admin (panel interno) | **React + Vite + TypeScript** | SPA privado detrás de login, sin necesidad de SEO/SSR |
| itio público (propiedSades) | **Next.js (React)** | Necesita SEO real e indexación en Google |
| Infraestructura | **Docker Compose + Caddy en VPS** | Autogestionado, TLS automático, bajo costo |
| Auth | **JWT + roles** | No existía en el prototipo; requisito nuevo para multi-usuario |

Un único backend y una única base de datos alimentan **dos frontends**
distintos (panel interno y sitio público), evitando duplicar lógica de
negocio o datos.

---

## 2. Base de datos — PostgreSQL

- **Por qué:** contratos, pagos, facturas, liquidaciones y caja en 3 monedas
  exigen consistencia transaccional (un cobro debe actualizar deuda, caja y
  liquidación de forma atómica). Un modelo no relacional / eventualmente
  consistente no es seguro acá.
- **Tipos clave:** `NUMERIC` para todos los montos (nunca `float`), `JSONB`
  solo para blobs realmente libres (notas, detalle de ítems), el resto
  normalizado en tablas propias para poder reportar y filtrar.
- **Tablas principales** (derivadas del modelo de datos del documento
  funcional, §4): `propiedades`, `propietarios`, `inquilinos`, `contratos`,
  `historial_aumentos`, `pagos`, `gastos`, `facturas`, `factura_items`,
  `ventas`, `interesados_venta`, `carteles`, `proveedores`, `incidencias`,
  `pagos_proveedor`, `clientes`, `eventos_agenda`, `movimientos_caja`,
  `configuracion`, `usuarios`, `numeradores`.
- **Constraints de negocio en DB:** moneda restringida a `ARS/USD/EUR`,
  estado de pago binario, checks de integridad — para no depender solo de
  validación en el backend.
- **Backups:** `pg_dump` diario vía cron + copia a storage externo
  (hoy no existe backup alguno; los datos viven en localStorage del navegador).

---

## 3. Backend — Node.js + TypeScript + NestJS + Prisma

- **NestJS**: arquitectura modular con inyección de dependencias. Cada módulo
  del documento funcional (Cobros, Liquidaciones, Ventas, Caja, Incidencias,
  Clientes, Agenda, Avisos, Propietarios, Configuración) se traduce en un
  módulo NestJS con su propio service — ahí vive la lógica de conexión entre
  módulos (§3 del documento: registrar un pago dispara el ingreso en caja,
  una incidencia resuelta genera el gasto automático, etc.), ahora
  transaccional y server-side.
- **Prisma ORM**: schema declarativo, migraciones versionadas, cliente
  tipado automáticamente a partir del schema.
- **TypeScript de punta a punta**: mismo lenguaje que ambos frontends, con
  un paquete `shared-types` para las interfaces de dominio (Propiedad,
  Contrato, Factura, etc.) compartidas entre backend y frontend.
- **PDFs**: `Puppeteer` (HTML → PDF) o `pdf-lib` para factura, recibo,
  liquidación y cupón con diseño definitivo — reemplaza el diálogo de
  impresión del navegador del prototipo.
- **Auth**: JWT + roles (admin / equipo), inexistente en el boceto.
- **Jobs programados**: vencimientos de contrato, alertas de aumento y (a
  futuro) consulta a la API del BCRA para IPC/ICL.
- **Alternativa evaluada:** Python + FastAPI — también válido, pero NestJS
  se eligió por el calce natural con la estructura modular del sistema y por
  compartir lenguaje con el frontend.

---

## 4. Frontend admin (panel SGM) — React + Vite + TypeScript

- **Vite + React SPA**: al ser una app interna sin necesidad de SEO, un SPA
  compilado a estáticos (servidos por nginx/Caddy) es más simple de operar
  que un framework con servidor propio.
- **TailwindCSS + shadcn/ui**: para la estética descrita en el documento
  (minimalista corporativo, base clara `#F9FAFB`, acentos carbón `#111827`
  e índigo `#6366F1`, alertas en naranja/rojo, números en tipografía
  monoespaciada) con componentes accesibles ya resueltos.
- **TanStack Query**: estado de servidor (KPIs, cobros del mes, etc.) con
  cache y revalidación — reemplaza el localStorage del prototipo.
- **TanStack Table**: tablas con acciones por fila (cobros, incidencias,
  cartelería).
- **Recharts**: los 3 gráficos del Panel General (área, anillo, barras).
- **React Router**: una ruta por módulo, reflejando el orden corregido de la
  sidebar (Propietarios y Liquidaciones inmediatamente después de Inquilinos
  y Cobros).

---

## 5. Sitio público (Facundo Paris Propiedades) — Next.js

- **Por qué no seguir en HTML plano:** el archivo actual es un bundle
  compilado (assets en base64 + template comprimido), sin código fuente
  mantenible. Next.js da SEO real, `next/image` optimizado y metadata por
  propiedad — algo que el panel interno no necesita pero el sitio público sí.
- **Reconstrucción del diseño:** el bundle actual se puede abrir tal cual en
  un navegador (es autocontenido) para relevar diseño y contenido, y
  reconstruirlo sección por sección como componentes React (carrusel, filtro
  por tipo de propiedad — mismas categorías que Ventas y Carteles, ficha de
  propiedad, formulario de contacto).
- **Conexión al mismo backend:** endpoint público de solo lectura
  (`GET /public/propiedades`) que expone únicamente las propiedades
  publicadas, sin datos sensibles (honorarios, propietario, pipeline de
  interesados quedan fuera).

---

## 6. Infraestructura — VPS autogestionado

- **Docker Compose** con 4 servicios: `postgres`, `api` (NestJS), `admin`
  (estático vía nginx), `web` (Next.js).
- **Caddy** como reverse proxy con TLS automático (Let's Encrypt) — más simple
  de mantener a mano que nginx + certbot.
- **CI/CD**: GitHub Actions → build + deploy por SSH al VPS en cada push a
  `main` (sin plataforma paga de por medio).
- **Monitoreo básico**: healthcheck endpoint + logs vía `docker logs`.

---

## 7. Lo que este stack resuelve del documento funcional

- Persistencia real y multi-usuario (hoy: localStorage de un solo navegador).
- Transacciones consistentes en el flujo cobro → caja → liquidación (§3.1, §3.4).
- Comprobantes con diseño definitivo en PDF real (pendiente #3, §7).
- Base para resolver, ya en el diseño y no como parche: punitorios
  automáticos, totales de egresos/saldo en USD/EUR, "Vendida por terceros",
  segundo filtro de estado en Ventas, campo "Desde" en Clientes.
- Deja preparado el terreno para integrar la API del BCRA (IPC/ICL) como
  mejora post-lanzamiento, sin cambiar la arquitectura.
