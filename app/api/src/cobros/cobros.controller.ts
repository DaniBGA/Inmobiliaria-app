import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CobrosService } from './cobros.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('cobros')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
export class CobrosController {
  constructor(private readonly cobrosService: CobrosService) {}

  @Get('mes/:mes')
  resumenMes(@Param('mes') mes: string) {
    return this.cobrosService.resumenMes(mes);
  }

  @Get('inquilinos')
  fichasInquilinos() {
    return this.cobrosService.fichasInquilinos();
  }

  @Get('kpis')
  kpis() {
    return this.cobrosService.kpis();
  }

  @Get('propiedades/:propiedadId/deuda')
  deuda(@Param('propiedadId') propiedadId: string) {
    return this.cobrosService.deudaAcumulada(propiedadId);
  }

  @Get('propiedades/:propiedadId/meses-pendientes')
  mesesPendientes(@Param('propiedadId') propiedadId: string) {
    return this.cobrosService.mesesPendientes(propiedadId);
  }

  @Get('propiedades/:propiedadId/pagos')
  historialPagos(@Param('propiedadId') propiedadId: string) {
    return this.cobrosService.historialPagos(propiedadId);
  }

  @Post('propiedades/:propiedadId/pagos')
  registrarPago(@Param('propiedadId') propiedadId: string, @Body() dto: CreatePagoDto) {
    return this.cobrosService.registrarPago(propiedadId, dto);
  }

  @Patch('pagos/:pagoId')
  editarPago(@Param('pagoId') pagoId: string, @Body() dto: UpdatePagoDto) {
    return this.cobrosService.editarPago(pagoId, dto);
  }

  @Post('pagos/:pagoId/anular')
  anularPago(@Param('pagoId') pagoId: string) {
    return this.cobrosService.anularPago(pagoId);
  }
}
