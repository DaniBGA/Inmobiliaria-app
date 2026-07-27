import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // El admin vive bajo /admin/ (la raíz del dominio queda para la landing
  // pública en `app/`) — `base` hace que todos los asset URLs y el
  // websocket de HMR salgan ya prefijados, tanto en dev como en el build.
  base: '/admin/',
  server: {
    port: 5174,
  },
});
