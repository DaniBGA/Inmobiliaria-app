import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { crearOpcionesImagenMulter } from '../common/imagen-multer.util';

// process.cwd() en vez de __dirname: tanto `nest start` (dev, ts-node)
// como `node dist/main` (prod) se ejecutan con el cwd en la raíz de
// app/api, así que la carpeta queda en el mismo lugar en ambos casos —
// __dirname en cambio depende de dónde el compilador termina poniendo
// este archivo dentro de dist/.
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const FOTOS_DIR = join(UPLOADS_DIR, 'propiedades');
const DOCS_DIR = join(UPLOADS_DIR, 'documentos');

// 20MB — las fotos de "feed"/marketing exportadas en alta resolución
// suelen pesar más que una foto de celular común; 8MB las rechazaba.
export const fotoPropiedadMulterOptions = crearOpcionesImagenMulter(20 * 1024 * 1024);

// Documentación de la propiedad (contratos, etc. — §7.4 del documento
// funcional: "adjuntos reales", antes un placeholder en localStorage).
export const documentoMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
      cb(null, DOCS_DIR);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (extname(file.originalname).toLowerCase() !== '.pdf' || file.mimetype !== 'application/pdf') {
      cb(new BadRequestException('Solo se aceptan archivos PDF.'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB por documento
};
