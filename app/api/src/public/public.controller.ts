import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ModalidadPropiedad, OrigenCliente, TipoPropiedad } from '@prisma/client';
import { PublicPropiedadesService } from './public-propiedades.service';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { ClientesService } from '../clientes/clientes.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { EmailService } from '../email/email.service';

const TIPO_OPERACION_LABEL: Record<string, string> = {
  ALQUILAR: 'Alquilar',
  COMPRAR: 'Comprar',
  VENDER: 'Vender',
};

// Única superficie sin autenticación de todo el sistema (nada de
// @UseGuards acá, ni a nivel de clase ni de método) — solo lectura de datos
// ya pensados para ser públicos, más un alta de Cliente con abuse-protection
// básica en el POST.
@Controller('public')
export class PublicController {
  constructor(
    private readonly propiedadesService: PublicPropiedadesService,
    private readonly clientesService: ClientesService,
    private readonly configuracionService: ConfiguracionService,
    private readonly emailService: EmailService,
  ) {}

  @Get('propiedades')
  listarPropiedades(
    @Query('modalidad') modalidad?: ModalidadPropiedad,
    // Acepta uno o varios valores separados por coma (ej: "DEPARTAMENTO,DUPLEX"
    // para el chip agrupado "Deptos" de la landing — ver TipoStatsBand.tsx).
    @Query('tipo') tipo?: string,
    @Query('especial') especial?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.propiedadesService.listar({
      modalidad,
      tipo: tipo ? (tipo.split(',').filter(Boolean) as TipoPropiedad[]) : undefined,
      especial: especial === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('propiedades/stats-por-tipo')
  statsPorTipo() {
    return this.propiedadesService.statsPorTipo();
  }

  @Get('contacto-info')
  contactoInfo() {
    return this.configuracionService.getContactoPublico();
  }

  // 5 solicitudes por minuto por IP — es la única escritura sin auth del
  // sistema, no hace falta más que esto para frenar abuso básico de bots.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('contacto')
  async enviarContacto(@Body() dto: CreateContactoDto) {
    await this.clientesService.create({
      nombre: dto.nombre,
      telefono: dto.telefono,
      email: dto.email,
      tipoOperacion: dto.tipoOperacion,
      detalle: dto.mensaje,
      // La landing es "la página web" de la inmobiliaria — mismo bucket
      // que cualquier otro contacto que entre por ahí (§2.6).
      origen: OrigenCliente.PAGINA_WEB,
    });

    // El destino sale de Configuración → Datos públicos (lo carga el
    // usuario desde el admin), no de una variable de entorno — es un dato
    // de negocio que puede cambiar sin tocar despliegue.
    const { email: destino } = await this.configuracionService.getContactoPublico();

    // No se espera (await) sin capturar errores propios acá: EmailService
    // ya absorbe sus propios fallos y jamás relanza — un email que no sale
    // no debe impedir la respuesta 200 al formulario (el Cliente ya quedó
    // guardado, que es lo que no se puede perder).
    void this.emailService.enviar({
      destino,
      asunto: `Nueva consulta desde la web — ${dto.nombre}`,
      replyTo: dto.email,
      texto: [
        `Nombre: ${dto.nombre}`,
        dto.telefono ? `Teléfono: ${dto.telefono}` : null,
        dto.email ? `Email: ${dto.email}` : null,
        `Quiere: ${TIPO_OPERACION_LABEL[dto.tipoOperacion] ?? dto.tipoOperacion}`,
        dto.mensaje ? `\nMensaje:\n${dto.mensaje}` : null,
        '\n— Enviado automáticamente desde el formulario de contacto de la landing.',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return { ok: true };
  }
}
