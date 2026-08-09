import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  // Abierto: Ventas y Carteles y Agenda lo usan para los dropdowns de
  // cliente.
  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('estado') estado?: EstadoCliente,
    @Query('tipoOperacion') tipoOperacion?: TipoOperacionCliente,
  ) {
    return this.clientesService.findAll(q, estado, tipoOperacion);
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
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
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
