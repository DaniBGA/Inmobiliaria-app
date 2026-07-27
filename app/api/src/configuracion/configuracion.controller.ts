import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('configuracion')
@UseGuards(JwtAuthGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  get() {
    return this.configuracionService.get();
  }

  @Get('dolar')
  cotizacionDolar() {
    return this.configuracionService.cotizacionDolar();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  update(@Body() dto: UpdateConfiguracionDto) {
    return this.configuracionService.update(dto);
  }
}
