import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

// NestJS ya traduce los errores de Multer (límite de tamaño, tipo de
// campo inesperado, etc.) a una HttpException real — PayloadTooLarge,
// BadRequest — pero deja el mensaje tal cual lo define la librería, en
// inglés ("File too large"). Acá solo se pisan esos textos puntuales con
// su versión en español; cualquier otro HttpException (p. ej. el
// BadRequestException de `fileFilter` en multer.config.ts, que ya está en
// español) pasa sin tocarlo.
const TRADUCCIONES: Record<string, string> = {
  'File too large': 'El archivo supera el tamaño máximo permitido.',
  'Too many files': 'Se subieron demasiados archivos a la vez.',
  'Unexpected field': 'Tipo de archivo no esperado.',
};

@Catch(HttpException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    res.status(status).json({
      statusCode: status,
      message: TRADUCCIONES[exception.message] ?? exception.message,
    });
  }
}
