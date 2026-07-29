import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GastosService } from './gastos.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('gastos')
@UseGuards(JwtAuthGuard)
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Get()
  findAll(@Query('propiedadId') propiedadId?: string, @Query('mes') mes?: string) {
    return this.gastosService.findAll(propiedadId, mes);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gastosService.findOne(id);
  }

  @Post()
  crear(@Body() dto: CreateGastoDto) {
    return this.gastosService.crear(dto);
  }

  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: UpdateGastoDto) {
    return this.gastosService.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.gastosService.eliminar(id);
  }
}
