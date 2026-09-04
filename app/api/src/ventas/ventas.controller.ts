import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  findAll(@Req() req: any, @Query('tipo') tipo?: TipoPropiedad, @Query('estado') estado?: EstadoVenta) {
    return this.ventasService.findAll(req.user, tipo, estado);
  }

  @Get('ventas/kpis')
  kpis(@Req() req: any) {
    return this.ventasService.kpis(req.user);
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
  registrarSena(@Param('id') id: string, @Body() dto: RegistrarSenaDto, @Req() req: any) {
    return this.ventasService.registrarSena(id, dto, req.user);
  }

  @Delete('ventas/:id/sena')
  eliminarSena(@Param('id') id: string, @Req() req: any) {
    return this.ventasService.eliminarSena(id, req.user);
  }

  @Post('ventas/:id/cerrar')
  cerrar(@Param('id') id: string, @Body() dto: CerrarVentaDto, @Req() req: any) {
    return this.ventasService.cerrar(id, dto, req.user);
  }

  @Delete('ventas/:id/cerrar')
  deshacerCierre(@Param('id') id: string, @Req() req: any) {
    return this.ventasService.deshacerCierre(id, req.user);
  }

  @Post('ventas/:id/vender-por-terceros')
  venderPorTerceros(@Param('id') id: string, @Body() dto: VenderPorTercerosDto, @Req() req: any) {
    return this.ventasService.venderPorTerceros(id, dto, req.user);
  }

  @Post('ventas/:id/interesados')
  crearInteresado(@Param('id') id: string, @Body() dto: CreateInteresadoDto, @Req() req: any) {
    return this.ventasService.crearInteresado(id, dto, req.user);
  }

  @Patch('interesados/:id')
  editarInteresado(@Param('id') id: string, @Body() dto: UpdateInteresadoDto, @Req() req: any) {
    return this.ventasService.editarInteresado(id, dto, req.user);
  }

  @Delete('interesados/:id')
  eliminarInteresado(@Param('id') id: string, @Req() req: any) {
    return this.ventasService.eliminarInteresado(id, req.user);
  }
}
