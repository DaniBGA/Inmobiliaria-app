import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IntegrantesEquipoService } from './integrantes-equipo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('integrantes-equipo')
@UseGuards(JwtAuthGuard)
export class IntegrantesEquipoController {
  constructor(private readonly service: IntegrantesEquipoService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body('nombre') nombre: string) {
    return this.service.create(nombre);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
