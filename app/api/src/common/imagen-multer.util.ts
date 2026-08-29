import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname } from 'path';

const EXTENSIONES_PERMITIDAS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIMES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Opciones de Multer compartidas por todos los uploads de imágenes que se
// reprocesan con sharp antes de escribirse a disco (fotos de propiedad,
// portada del carrusel del Hero, foto de "Nosotros") — antes cada multer
// config repetía el mismo `Set` de extensiones/mimes y el mismo
// `fileFilter` a mano. `storage: memoryStorage()` es siempre el mismo
// (el service reprocesa el buffer), solo el límite de tamaño varía por
// caso de uso.
export function crearOpcionesImagenMulter(limiteBytes: number) {
  return {
    storage: memoryStorage(),
    fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!EXTENSIONES_PERMITIDAS.has(ext) || !MIMES_PERMITIDOS.has(file.mimetype)) {
        cb(new BadRequestException('Solo se aceptan imágenes JPG, PNG o WEBP.'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: limiteBytes },
  };
}
