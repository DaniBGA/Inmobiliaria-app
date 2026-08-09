import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CartelesService } from './carteles.service';
import { CreateCartelDto } from './dto/create-cartel.dto';
import { UpdateCartelDto } from './dto/update-cartel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('carteles')
@UseGuards(JwtAuthGuard)
export class CartelesController {
  constructor(private readonly cartelesService: CartelesService) {}

  @Get()
  findAll() {
    return this.cartelesService.findAll();
  }

  @Get('kpis')
  kpis() {
    return this.cartelesService.kpis();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  create(@Body() dto: CreateCartelDto) {
    return this.cartelesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCartelDto) {
    return this.cartelesService.update(id, dto);
  }

  @Post(':id/retirar')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  retirar(@Param('id') id: string, @Body('fecha') fecha?: string) {
    return this.cartelesService.retirar(id, fecha);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.cartelesService.remove(id);
  }
}
