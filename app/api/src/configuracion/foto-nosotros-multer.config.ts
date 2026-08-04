import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';

// Misma carpeta base que las fotos de propiedades (app/api/src/propiedades/
// multer.config.ts), pero en su propia subcarpeta — es un archivo
// completamente distinto (una sola foto institucional, no una galería).
export const FOTO_NOSOTROS_DIR = join(process.cwd(), 'uploads', 'configuracion');

const EXTENSIONES_PERMITIDAS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIMES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const fotoNosotrosMulterOptions = {
  // En memoria: ConfiguracionService.actualizarFotoNosotros() reprocesa el
  // buffer con sharp (mismo recorte 1080x1350 que las fotos de propiedad,
  // ver imagen.util.ts) antes de escribirlo a disco.
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.has(ext) || !MIMES_PERMITIDOS.has(file.mimetype)) {
      cb(new BadRequestException('Solo se aceptan imágenes JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
};
