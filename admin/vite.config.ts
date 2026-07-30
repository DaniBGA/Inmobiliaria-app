import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Vite con `base: '/admin/'` no redirige solo `/admin` (sin barra final) a
// `/admin/` — devuelve 404. En producción lo resuelve Caddy (ver
// deploy/Caddyfile), pero en dev hace falta este mismo redirect a mano.
function redirectAdminSinBarra(): Plugin {
  return {
    name: 'redirect-admin-sin-barra',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/admin') {
          res.statusCode = 302;
          res.setHeader('Location', '/admin/');
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), redirectAdminSinBarra()],
  // El admin vive bajo /admin/ (la raíz del dominio queda para la landing
  // pública en `app/`) — `base` hace que todos los asset URLs y el
  // websocket de HMR salgan ya prefijados, tanto en dev como en el build.
  base: '/admin/',
  server: {
    port: 5174,
  },
});
