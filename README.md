# SGM_AR — Sistema de Gestión Inmobiliaria

Panel de administración + landing pública para Facundo Paris Propiedades
(PostgreSQL + NestJS/Prisma + React/Vite).

En desarrollo, todo vive bajo un solo origen: la landing pública en la
raíz (`/`) y el panel de administración bajo `/admin` (un proxy en el dev
server de la landing reenvía `/admin/*` al dev server del admin).

## Acceso al panel

- URL: http://localhost:5173/admin/
- Email: `admin@facundoparis.com`
- Contraseña: `changeme123`

Estas son las credenciales por defecto que crea el seed (`app/api/prisma/seed.ts`).
Se pueden cambiar antes de sembrar la base seteando las variables de entorno
`SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Se recomienda cambiar la
contraseña desde un usuario real una vez en producción.

## Acceso a la landing pública

- URL: http://localhost:5173/

## Cómo levantar el proyecto en desarrollo

```bash
# 1. Base de datos (Postgres en Docker)
cd app
docker compose up -d

# 2. Backend (NestJS)
cd api
npm install
npm run prisma:migrate     # aplica el schema
npm run prisma:seed        # crea la Configuración inicial y el usuario admin
npm run start:dev          # http://localhost:3000

# 3. Panel de administración (React + Vite, bajo /admin)
cd ../../admin
npm install
npm run dev                # http://localhost:5174/admin/ (o vía el proxy de abajo)

# 4. Landing pública (React + Vite, raíz del "dominio" en dev)
cd ../app
npm install
npm run dev                # http://localhost:5173/ — /admin/* se proxea al puerto 5174
```

Con los 4 procesos corriendo, `http://localhost:5173/` es la landing y
`http://localhost:5173/admin/` es el panel — ambos por el mismo puerto,
como van a convivir en producción bajo el mismo dominio.

Más contexto del sistema, el stack elegido y el estado de cada módulo en
`STACK_TECNOLOGICO.md` y `CONEXIONES.md`.
