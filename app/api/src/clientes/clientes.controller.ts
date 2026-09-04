import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EstadoCliente, TipoOperacionCliente } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  // Abierto a ADMIN y EQUIPO — un designado ve solo sus propios clientes
  // (ver ClientesService.findAll); un ADMIN ve todo y puede filtrar por
  // `delegadoId` para revisar la cartera de un integrante puntual.
  @Get()
  findAll(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('estado') estado?: EstadoCliente,
    @Query('tipoOperacion') tipoOperacion?: TipoOperacionCliente,
    @Query('delegadoId') delegadoId?: string,
  ) {
    return this.clientesService.findAll(req.user, q, estado, tipoOperacion, delegadoId);
  }

  @Get('stats-por-origen')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  statsPorOrigen() {
    return this.clientesService.statsPorOrigen();
  }

  @Get('eliminados')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  historialEliminados() {
    return this.clientesService.historialEliminados();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.clientesService.findOne(id, req.user);
  }

  @Post()
  create(@Body() dto: CreateClienteDto, @Req() req: any) {
    return this.clientesService.create(dto, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @Req() req: any) {
    return this.clientesService.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.clientesService.remove(id, req.user);
  }

  @Patch(':id/restaurar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  restaurar(@Param('id') id: string) {
    return this.clientesService.restaurar(id);
  }

  @Delete(':id/definitivo')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  removeDefinitivo(@Param('id') id: string) {
    return this.clientesService.removeDefinitivo(id);
  }
}
