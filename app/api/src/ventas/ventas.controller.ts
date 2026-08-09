import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EstadoVenta, TipoPropiedad } from '@prisma/client';
import { VentasService } from './ventas.service';
import { UpsertVentaDto } from './dto/upsert-venta.dto';
import { RegistrarSenaDto } from './dto/registrar-sena.dto';
import { CerrarVentaDto } from './dto/cerrar-venta.dto';
import { VenderPorTercerosDto } from './dto/vender-por-terceros.dto';
import { CreateInteresadoDto } from './dto/create-interesado.dto';
import { UpdateInteresadoDto } from './dto/update-interesado.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get('ventas')
  findAll(@Query('tipo') tipo?: TipoPropiedad, @Query('estado') estado?: EstadoVenta) {
    return this.ventasService.findAll(tipo, estado);
  }

  @Get('ventas/kpis')
  kpis() {
    return this.ventasService.kpis();
  }

  @Get('ventas/:id')
  findOne(@Param('id') id: string) {
    return this.ventasService.findOne(id);
  }

  // Publicar una propiedad nueva en venta / editar precio, estado y
  // publicación de una ficha existente — es "editar la propiedad", no el
  // pipeline de venta en sí (interesados/seña/cierre/terceros abajo), así
  // que queda ADMIN-only.
  @Post('propiedades/:propiedadId/venta')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  upsert(@Param('propiedadId') propiedadId: string, @Body() dto: UpsertVentaDto) {
    return this.ventasService.upsert(propiedadId, dto);
  }

  @Post('ventas/:id/sena')
  registrarSena(@Param('id') id: string, @Body() dto: RegistrarSenaDto) {
    return this.ventasService.registrarSena(id, dto);
  }

  @Delete('ventas/:id/sena')
  eliminarSena(@Param('id') id: string) {
    return this.ventasService.eliminarSena(id);
  }

  @Post('ventas/:id/cerrar')
  cerrar(@Param('id') id: string, @Body() dto: CerrarVentaDto) {
    return this.ventasService.cerrar(id, dto);
  }

  @Delete('ventas/:id/cerrar')
  deshacerCierre(@Param('id') id: string) {
    return this.ventasService.deshacerCierre(id);
  }

  @Post('ventas/:id/vender-por-terceros')
  venderPorTerceros(@Param('id') id: string, @Body() dto: VenderPorTercerosDto) {
    return this.ventasService.venderPorTerceros(id, dto);
  }

  @Post('ventas/:id/interesados')
  crearInteresado(@Param('id') id: string, @Body() dto: CreateInteresadoDto) {
    return this.ventasService.crearInteresado(id, dto);
  }

  @Patch('interesados/:id')
  editarInteresado(@Param('id') id: string, @Body() dto: UpdateInteresadoDto) {
    return this.ventasService.editarInteresado(id, dto);
  }

  @Delete('interesados/:id')
  eliminarInteresado(@Param('id') id: string) {
    return this.ventasService.eliminarInteresado(id);
  }
}
