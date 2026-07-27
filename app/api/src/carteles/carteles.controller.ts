import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CartelesService } from './carteles.service';
import { CreateCartelDto } from './dto/create-cartel.dto';
import { UpdateCartelDto } from './dto/update-cartel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  create(@Body() dto: CreateCartelDto) {
    return this.cartelesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCartelDto) {
    return this.cartelesService.update(id, dto);
  }

  @Post(':id/retirar')
  retirar(@Param('id') id: string, @Body('fecha') fecha?: string) {
    return this.cartelesService.retirar(id, fecha);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cartelesService.remove(id);
  }
}
