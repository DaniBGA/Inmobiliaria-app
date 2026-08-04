import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './propiedades/multer.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // En producción, ALLOWED_ORIGINS restringe qué sitios pueden leer las
  // respuestas de la API (el propio dominio, landing+admin). Sin la
  // variable definida (dev local, distintos puertos localhost) se refleja
  // cualquier origen — mismo comportamiento que antes, solo para no
  // trabar el flujo de desarrollo.
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors(allowedOrigins?.length ? { origin: allowedOrigins } : undefined);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  // Fotos de propiedades (§ Ventas): se guardan en disco y se sirven acá
  // como estáticas — sin esto, la URL guardada en FotoPropiedad no
  // resolvería a nada.
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
