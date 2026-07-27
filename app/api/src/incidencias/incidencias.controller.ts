import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EstadoIncidencia } from '@prisma/client';
import { IncidenciasService } from './incidencias.service';
import { PagosProveedorService } from '../proveedores/pagos-proveedor.service';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';
import { UpdateIncidenciaDto } from './dto/update-incidencia.dto';
import { AsignarProveedorDto } from './dto/asignar-proveedor.dto';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';
import { RegistrarPagoProveedorDto } from '../proveedores/dto/registrar-pago-proveedor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('incidencias')
@UseGuards(JwtAuthGuard)
export class IncidenciasController {
  constructor(
    private readonly incidenciasService: IncidenciasService,
    private readonly pagosProveedorService: PagosProveedorService,
  ) {}

  @Get()
  findAll(@Query('estado') estado?: EstadoIncidencia, @Query('propiedadId') propiedadId?: string) {
    return this.incidenciasService.findAll(estado, propiedadId);
  }

  @Get('sin-proveedor')
  sinProveedor() {
    return this.incidenciasService.findSinProveedor();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidenciasService.findOne(id);
  }

  @Post()
  crear(@Body() dto: CreateIncidenciaDto) {
    return this.incidenciasService.crear(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIncidenciaDto) {
    return this.incidenciasService.update(id, dto);
  }

  @Patch(':id/proveedor')
  asignarProveedor(@Param('id') id: string, @Body() dto: AsignarProveedorDto) {
    return this.incidenciasService.asignarProveedor(id, dto);
  }

  @Post(':id/reabrir')
  volverAAbierta(@Param('id') id: string) {
    return this.incidenciasService.volverAAbierta(id);
  }

  @Post(':id/resolver')
  resolver(@Param('id') id: string, @Body() dto: ResolverIncidenciaDto) {
    return this.incidenciasService.resolver(id, dto);
  }

  @Post(':id/pagar')
  pagar(@Param('id') id: string, @Body() dto: RegistrarPagoProveedorDto) {
    return this.pagosProveedorService.registrarPagoPorTrabajo(id, dto.fecha);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.incidenciasService.remove(id);
  }
}
