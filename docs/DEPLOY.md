# Deploy en Hostinger VPS (KVM 2) — guía paso a paso

Arquitectura elegida para este deploy (decisiones tomadas junto con el
usuario, ver `CONEXIONES.md` si querés el detalle de por qué):

- **Un solo dominio**, tres destinos, ruteados por **Caddy**:
  - `tudominio.com/` → landing pública (`app/`, estático)
  - `tudominio.com/admin/` → panel de administración (`admin/`, estático)
  - `tudominio.com/api/` → backend NestJS (proxy a `127.0.0.1:3000`, sin
    subdominio aparte)
- **Postgres** en Docker (mismo `postgres:16-alpine` que en desarrollo).
- **PM2** corriendo el backend Node directamente en el VPS (sin
  contenedor para el backend — no hace falta, PM2 alcanza).
- **Caddy** como reverse proxy: sirve los dos frontends estáticos, proxea
  `/api/*` al backend, y gestiona HTTPS (Let's Encrypt) automáticamente,
  sin configuración manual de certificados.

⚠️ **Reemplazá `tudominio.com` por tu dominio real en TODOS los pasos** —
elegiste dejarlo como placeholder por ahora. Buscalo en:
`deploy/Caddyfile`, `deploy/env.deploy.example` (→ `deploy/.env.deploy`),
y en los comandos de este archivo.

Asumido: el VPS Hostinger KVM 2 ya está creado con **Ubuntu** (22.04 o
24.04) y tenés acceso SSH root. Si es otra distro, los pasos de
instalación de paquetes cambian (mismo resultado, otro gestor de
paquetes) — avisame y te lo adapto.

---

## 0. DNS en Hostinger

Antes de tocar el VPS, apuntá el dominio:

1. hPanel → Dominios → tu dominio → Zona DNS.
2. Registro **A**, host `@`, valor: la IP pública del VPS. TTL por
   defecto está bien.
3. Si vas a usar `www.tudominio.com` también, agregá otro registro A con
   host `www` a la misma IP (o un CNAME `www` → `tudominio.com`).
4. Los cambios de DNS pueden tardar de minutos a un par de horas en
   propagarse — podés seguir con el resto mientras tanto, Caddy recién
   necesita que el DNS resuelva cuando pida el certificado (paso 6).

Podés confirmar que ya propagó con `dig tudominio.com +short` desde tu PC
(debería devolver la IP del VPS) o desde el navegador en
[dnschecker.org](https://dnschecker.org).

---

## 1. Conectarse y preparar el sistema

```bash
ssh root@IP_DEL_VPS
apt update && apt upgrade -y
```

(Opcional pero recomendado) crear un usuario no-root para operar el
deploy, en vez de todo como root:

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

El resto de esta guía asume que estás logueado como ese usuario (`deploy`)
con `sudo` — si preferís seguir todo como root, sacá los `sudo` de los
comandos.

---

## 2. Instalar dependencias del sistema

```bash
sudo apt install -y git curl build-essential python3 ufw
```

`build-essential` + `python3` son necesarios porque el backend usa
`bcrypt` (módulo nativo, se compila al hacer `npm install`).

### Node.js 22 (vía NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # debería dar v22.x
```

### Docker + Docker Compose (para Postgres)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # o cerrar sesión y volver a entrar
docker --version
docker compose version
```

### PM2 (gestor de procesos para el backend)

```bash
sudo npm install -g pm2
```

### Caddy (reverse proxy + HTTPS automático)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

No abras el 3000 ni el 5433 — el backend y Postgres solo se acceden desde
adentro del VPS (Caddy hace de puerta de entrada).

---

## 3. Clonar el repo

```bash
sudo mkdir -p /var/www/sgm
sudo chown $USER:$USER /var/www/sgm
git clone https://github.com/DaniBGA/Inmobiliaria-app.git /var/www/sgm
cd /var/www/sgm
```

Si el repo es privado, ese `git clone` por HTTPS te va a pedir usuario y
contraseña — GitHub ya no acepta la contraseña de tu cuenta ahí, necesitás
un [token de acceso personal](https://github.com/settings/tokens) (usalo
como "contraseña" cuando te lo pida) o clonar por SSH con una clave
agregada a tu cuenta de GitHub.

---

## 4. Variables de entorno

### 4.1 Postgres (`deploy/.env`)

```bash
cp deploy/env.postgres.example deploy/.env
openssl rand -base64 24   # copiá el resultado
nano deploy/.env          # pegalo en POSTGRES_PASSWORD=
```

### 4.2 Backend (`app/api/.env`)

```bash
cp deploy/env.api.example app/api/.env
nano app/api/.env
```

Completá:
- `DATABASE_URL`: la misma contraseña que pusiste en `deploy/.env`.
- `JWT_SECRET`: generá uno con `openssl rand -base64 48` — **nunca** el de
  desarrollo.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: el email y contraseña real
  del usuario admin que se va a crear la primera vez (no dejar
  `changeme123`).

### 4.3 Deploy (`deploy/.env.deploy`)

```bash
cp deploy/env.deploy.example deploy/.env.deploy
nano deploy/.env.deploy   # VITE_API_URL=https://tudominio.com/api
```

Esto es lo que usa `deploy/deploy.sh` para saber con qué URL de API
compilar el admin y la landing.

---

## 5. Levantar Postgres

```bash
cd /var/www/sgm
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d
docker ps   # confirmar que sgm_postgres_prod está "Up"
```

---

## 6. Primer build, migraciones y siembra inicial

```bash
cd /var/www/sgm
npm install

# Backend
npm run build --workspace=app/api
cd app/api
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
cd /var/www/sgm
```

`prisma db seed` crea la fila de Configuración y el usuario admin con el
email/contraseña que pusiste en `app/api/.env` — es idempotente, correrlo
de nuevo en el futuro no rompe nada (no pisa el admin si ya existe).

```bash
# Frontends (con la URL de API real)
source deploy/.env.deploy
export VITE_API_URL
npm run build --workspace=admin
npm run build --workspace=app
```

---

## 7. Arrancar el backend con PM2

```bash
cd /var/www/sgm
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup   # copiá y corré el comando que te imprime (para que arranque solo si el VPS reinicia)
pm2 logs sgm-api --lines 50   # confirmar que arrancó bien, sin errores
```

---

## 8. Configurar y arrancar Caddy

```bash
sudo cp /var/www/sgm/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # reemplazar tudominio.com por el dominio real (todas las apariciones)
sudo mkdir -p /var/log/caddy
sudo systemctl restart caddy
sudo systemctl status caddy
sudo systemctl enable caddy
```

La primera vez que Caddy ve tráfico para el dominio, pide el certificado
TLS a Let's Encrypt automáticamente — necesita que el DNS ya esté
propagado (paso 0) y los puertos 80/443 abiertos (paso 2).

---

## 9. Probar todo

- `https://tudominio.com/` → landing pública.
- `https://tudominio.com/admin/` → login del panel, con el email/password
  que pusiste en `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
- Cargá una propiedad de prueba y confirmá que las fotos suben bien
  (pasan por `/api/uploads/...`).
- Revisá `pm2 logs sgm-api` y `sudo journalctl -u caddy -n 50` si algo no
  responde.

---

## 10. Deploys siguientes (actualizar el código)

Una vez hecho todo lo de arriba, para subir cambios nuevos alcanza con:

```bash
cd /var/www/sgm
bash deploy/deploy.sh
```

Este script hace `git pull` + `npm install` + build de los tres proyectos
+ `prisma migrate deploy` + reinicio de PM2 + reload de Caddy, en ese
orden. Ver `deploy/deploy.sh` si querés tocar algún paso.

---

## 11. Backups (no automatizado todavía — hacerlo a mano por ahora)

Dos cosas hay que respaldar periódicamente:

```bash
# Dump de la base
docker exec sgm_postgres_prod pg_dump -U sgm sgm_ar > backup_$(date +%Y%m%d).sql

# Fotos/documentos subidos (no están en git)
tar -czf uploads_$(date +%Y%m%d).tar.gz -C /var/www/sgm/app/api uploads
```

Si querés, en otra sesión armamos un cron para que esto se haga solo y se
suba a algún storage externo (no lo dejé automatizado ahora para no
inventar de más sin que lo pidas).

---

## Notas de seguridad

- Cambiá la contraseña del admin desde el panel apenas entres la primera
  vez, aunque ya hayas puesto una real en el seed.
- `deploy/.env`, `deploy/.env.deploy` y `app/api/.env` nunca se commitean
  (ya están en `.gitignore`) — viven solo en el VPS.
- Postgres solo escucha en `127.0.0.1` (ver `deploy/docker-compose.prod.yml`),
  no es alcanzable desde internet.
- El puerto 3000 (backend) tampoco está expuesto — todo el tráfico externo
  entra por Caddy (80/443).
