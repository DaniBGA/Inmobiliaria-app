import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IntegrantesEquipoService } from './integrantes-equipo.service';
import { UpdateIntegranteDto } from './dto/update-integrante.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('integrantes-equipo')
@UseGuards(JwtAuthGuard)
export class IntegrantesEquipoController {
  constructor(private readonly service: IntegrantesEquipoService) {}

  // Abierto a cualquier logueado (ADMIN o EQUIPO): lo usan los dropdowns de
  // "Designado para mostrar"/"Delegado" en Ventas, y el selector de agenda.
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  create(@Body('nombre') nombre: string) {
    return this.service.create(nombre);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateIntegranteDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/acceso-activo')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  setAccesoActivo(@Param('id') id: string, @Body('activo') activo: boolean) {
    return this.service.setAccesoActivo(id, activo);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
