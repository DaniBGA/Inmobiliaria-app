import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PropietariosService } from './propietarios.service';
import { CreatePropietarioDto } from './dto/create-propietario.dto';
import { UpdatePropietarioDto } from './dto/update-propietario.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('propietarios')
@UseGuards(JwtAuthGuard)
export class PropietariosController {
  constructor(private readonly propietariosService: PropietariosService) {}

  @Get()
  findAll() {
    return this.propietariosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propietariosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePropietarioDto) {
    return this.propietariosService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropietarioDto) {
    return this.propietariosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propietariosService.remove(id);
  }
}
