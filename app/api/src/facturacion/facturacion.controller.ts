import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { RecibosService } from './recibos.service';
import { EmitirFacturaDto } from './dto/emitir-factura.dto';
import { EmitirReciboDto } from './dto/emitir-recibo.dto';
import { EmitirMasivoDto } from './dto/emitir-masivo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('facturacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
export class FacturacionController {
  constructor(
    private readonly facturasService: FacturasService,
    private readonly recibosService: RecibosService,
  ) {}

  @Get('propiedades/:propiedadId/items-predeterminados')
  itemsPredeterminados(
    @Param('propiedadId') propiedadId: string,
    @Query('mes') mes: string,
  ) {
    return this.facturasService.itemsPredeterminados(propiedadId, mes);
  }

  @Get('propiedades/:propiedadId/facturas/:mes')
  obtenerFactura(@Param('propiedadId') propiedadId: string, @Param('mes') mes: string) {
    return this.facturasService.obtenerDelMes(propiedadId, mes);
  }

  @Post('propiedades/:propiedadId/facturas')
  emitirFactura(@Param('propiedadId') propiedadId: string, @Body() dto: EmitirFacturaDto) {
    return this.facturasService.emitir(propiedadId, dto.mes, dto.items, dto.numero);
  }

  @Post('masivo')
  emitirMasivo(@Body() dto: EmitirMasivoDto) {
    return this.facturasService.emitirMasivo(dto.mes);
  }

  @Get('propiedades/:propiedadId/recibos/:mes')
  obtenerRecibo(@Param('propiedadId') propiedadId: string, @Param('mes') mes: string) {
    return this.recibosService.obtenerDelMes(propiedadId, mes);
  }

  @Post('propiedades/:propiedadId/recibos')
  emitirRecibo(@Param('propiedadId') propiedadId: string, @Body() dto: EmitirReciboDto) {
    return this.recibosService.emitir(propiedadId, dto.mes);
  }
}
