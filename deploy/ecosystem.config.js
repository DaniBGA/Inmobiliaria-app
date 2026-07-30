// Config de PM2 para el backend NestJS en producción.
// Uso: pm2 start deploy/ecosystem.config.js
//
// `cwd` apunta a app/api porque:
// - @nestjs/config busca `.env` relativo al directorio de trabajo del
//   proceso, no del archivo ecosystem.
// - `UPLOADS_DIR` (multer.config.ts) es `join(process.cwd(), 'uploads')`
//   — con este cwd, las fotos/documentos quedan en app/api/uploads,
//   mismo lugar que en dev.
module.exports = {
  apps: [
    {
      name: 'sgm-api',
      cwd: '/var/www/sgm/app/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
