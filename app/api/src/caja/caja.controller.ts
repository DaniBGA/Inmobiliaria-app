import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CajaService } from './caja.service';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Moneda, RolUsuario } from '@prisma/client';

@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Get('movimientos')
  findMes(@Query('mes') mes: string, @Query('moneda') moneda?: Moneda) {
    return this.cajaService.findMes(mes, moneda);
  }

  @Post('movimientos')
  registrarManual(@Body() dto: CreateMovimientoDto) {
    return this.cajaService.registrarManual({
      ...dto,
      fecha: new Date(dto.fecha),
    });
  }

  @Patch('movimientos/:id')
  editarManual(@Param('id') id: string, @Body() dto: UpdateMovimientoDto) {
    return this.cajaService.editarManual(id, dto);
  }

  @Delete('movimientos/:id')
  eliminarManual(@Param('id') id: string) {
    return this.cajaService.eliminarManual(id);
  }

  @Get('kpis/:mes')
  kpisDelMes(@Param('mes') mes: string) {
    return this.cajaService.kpisDelMes(mes);
  }
}
