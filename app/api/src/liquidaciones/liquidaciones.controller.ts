import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LiquidacionesService } from './liquidaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('liquidaciones')
@UseGuards(JwtAuthGuard)
export class LiquidacionesController {
  constructor(private readonly liquidacionesService: LiquidacionesService) {}

  @Get('propietarios/:propietarioId/:mes')
  obtener(@Param('propietarioId') propietarioId: string, @Param('mes') mes: string) {
    return this.liquidacionesService.obtenerDelMes(propietarioId, mes);
  }

  @Post('propietarios/:propietarioId/:mes')
  generar(@Param('propietarioId') propietarioId: string, @Param('mes') mes: string) {
    return this.liquidacionesService.generar(propietarioId, mes);
  }
}
