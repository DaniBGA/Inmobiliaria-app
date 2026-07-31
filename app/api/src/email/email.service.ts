import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { resolve4 } from 'node:dns/promises';

// Envío de notificaciones por email — hoy solo lo usa el formulario de
// contacto de la landing (§PublicModule), pero queda como servicio
// genérico por si en el futuro se suma otro disparador (p. ej. Avisos).
//
// Si faltan las variables SMTP_*, el envío se salta en silencio (con un
// warning en el log) en vez de tirar abajo el endpoint que lo llama — un
// email que no sale nunca debería impedir que el Cliente quede igual
// guardado en la base.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private avisoFaltanVariables = false;

  constructor(private readonly config: ConfigService) {}

  // `destino` no sale del .env: es un dato de negocio (a qué casilla
  // llegan las consultas), no una credencial — lo carga el usuario desde
  // el admin (Configuración → Datos públicos) y quien llama a este
  // servicio lo resuelve vía ConfiguracionService antes de invocar esto.
  async enviar(opts: { destino: string; asunto: string; texto: string; replyTo?: string }): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !port || !user || !pass) {
      if (!this.avisoFaltanVariables) {
        this.logger.warn(
          'SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS no están configuradas — no se van a enviar emails (ver app/api/.env.example).',
        );
        this.avisoFaltanVariables = true;
      }
      return;
    }
    if (!opts.destino) {
      this.logger.warn(
        `Email "${opts.asunto}" sin destinatario — falta cargar el email público en Configuración → Datos públicos.`,
      );
      return;
    }

    try {
      // nodemailer resuelve el hostname combinando direcciones IPv4 e IPv6
      // y elige UNA AL AZAR entre todas — en redes sin salida IPv6 (algo
      // frecuente en Windows y varios ISP) eso hace fallar la conexión
      // más o menos la mitad de las veces con ECONNREFUSED, de forma
      // intermitente y difícil de reproducir. Resolvemos nosotros mismos
      // una IPv4 y la pasamos como `host`, con `servername` para que la
      // validación del certificado TLS siga validando contra el nombre
      // real (si no, el cert de la IP no matchea y falla el handshake).
      const [ipv4] = await resolve4(host);
      const transporter = createTransport({
        host: ipv4,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
        tls: {
          servername: host,
          // Solo para desarrollo local: si un antivirus/proxy hace
          // inspección HTTPS (Kaspersky, ESET, etc.) resigna los
          // certificados con su propia CA, que Node no reconoce, y la
          // conexión falla con "unable to verify the first certificate"
          // aunque el servidor sea legítimo. NUNCA activar esto en
          // producción — ahí no debería hacer falta.
          rejectUnauthorized: this.config.get<string>('SMTP_TLS_INSECURE') !== 'true',
        },
      });

      await transporter.sendMail({
        from: `"Facundo Paris Propiedades — Web" <${user}>`,
        to: opts.destino,
        replyTo: opts.replyTo,
        subject: opts.asunto,
        text: opts.texto,
      });
    } catch (error) {
      // No relanzamos: quien llama (p. ej. el formulario de contacto) no
      // debe fallar porque el email no salió — el Cliente ya quedó guardado.
      this.logger.error(`No se pudo enviar el email "${opts.asunto}": ${(error as Error).message}`);
    }
  }
}
