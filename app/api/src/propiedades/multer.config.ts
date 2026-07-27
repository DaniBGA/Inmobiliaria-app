import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

// process.cwd() en vez de __dirname: tanto `nest start` (dev, ts-node)
// como `node dist/main` (prod) se ejecutan con el cwd en la raíz de
// app/api, así que la carpeta queda en el mismo lugar en ambos casos —
// __dirname en cambio depende de dónde el compilador termina poniendo
// este archivo dentro de dist/.
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
const FOTOS_DIR = join(UPLOADS_DIR, 'propiedades');
const DOCS_DIR = join(UPLOADS_DIR, 'documentos');

const EXTENSIONES_PERMITIDAS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIMES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const fotoPropiedadMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(FOTOS_DIR)) mkdirSync(FOTOS_DIR, { recursive: true });
      cb(null, FOTOS_DIR);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.has(ext) || !MIMES_PERMITIDOS.has(file.mimetype)) {
      cb(new BadRequestException('Solo se aceptan imágenes JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por foto
};

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
