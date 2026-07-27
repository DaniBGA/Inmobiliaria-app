import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La landing corre en el 5173 (raíz del "dominio" en dev) y el admin en el
// 5174 bajo /admin/ (ver admin/vite.config.ts) — este proxy hace que
// visitar http://localhost:5173/admin/ te lleve transparentemente al dev
// server del admin, `ws: true` para que su HMR siga funcionando a través
// del proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/admin': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
