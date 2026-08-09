import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AvisosService } from './avisos.service';
import { DescartarAvisoDto } from './dto/descartar-aviso.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('avisos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
export class AvisosController {
  constructor(private readonly avisosService: AvisosService) {}

  @Get()
  generar() {
    return this.avisosService.generar();
  }

  @Post('descartar')
  descartar(@Body() dto: DescartarAvisoDto) {
    return this.avisosService.descartar(dto.grupo, dto.clave);
  }
}
