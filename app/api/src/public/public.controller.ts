import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ModalidadPropiedad, OrigenCliente, TipoPropiedad } from '@prisma/client';
import { PublicPropiedadesService } from './public-propiedades.service';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { ClientesService } from '../clientes/clientes.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';

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
  ) {}

  @Get('propiedades')
  listarPropiedades(
    @Query('modalidad') modalidad?: ModalidadPropiedad,
    @Query('tipo') tipo?: TipoPropiedad,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.propiedadesService.listar({
      modalidad,
      tipo,
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
    return { ok: true };
  }
}
