import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AvisosService } from './avisos.service';
import { DescartarAvisoDto } from './dto/descartar-aviso.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('avisos')
@UseGuards(JwtAuthGuard)
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
