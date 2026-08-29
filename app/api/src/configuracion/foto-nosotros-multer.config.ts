import { join } from 'path';
import { crearOpcionesImagenMulter } from '../common/imagen-multer.util';

// Misma carpeta base que las fotos de propiedades (app/api/src/propiedades/
// multer.config.ts), pero en su propia subcarpeta — es un archivo
// completamente distinto (una sola foto institucional, no una galería).
export const FOTO_NOSOTROS_DIR = join(process.cwd(), 'uploads', 'configuracion');

// En memoria: ConfiguracionService.actualizarFotoNosotros() reprocesa el
// buffer con sharp (mismo recorte 1080x1350 que las fotos de propiedad,
// ver imagen.util.ts) antes de escribirlo a disco.
export const fotoNosotrosMulterOptions = crearOpcionesImagenMulter(20 * 1024 * 1024);
