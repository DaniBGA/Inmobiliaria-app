import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PropiedadesService } from './propiedades.service';
import { CreatePropiedadDto } from './dto/create-propiedad.dto';
import { UpdatePropiedadDto } from './dto/update-propiedad.dto';
import { RegistrarAumentoDto } from './dto/registrar-aumento.dto';
import { UpsertInquilinoDto } from './dto/upsert-inquilino.dto';
import { fotoPropiedadMulterOptions, documentoMulterOptions } from './multer.config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('propiedades')
@UseGuards(JwtAuthGuard)
export class PropiedadesController {
  constructor(private readonly propiedadesService: PropiedadesService) {}

  @Get()
  findAll() {
    return this.propiedadesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propiedadesService.findOne(id);
  }

  @Get(':id/renta-vigente')
  async rentaVigente(@Param('id') id: string) {
    const monto = await this.propiedadesService.rentaVigente(id);
    const proximoAumento = await this.propiedadesService.proximoAumento(id);
    return { monto, proximoAumento };
  }

  @Post()
  create(@Body() dto: CreatePropiedadDto) {
    return this.propiedadesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropiedadDto) {
    return this.propiedadesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propiedadesService.remove(id);
  }

  @Post(':id/aumentos')
  registrarAumento(@Param('id') id: string, @Body() dto: RegistrarAumentoDto) {
    return this.propiedadesService.registrarAumento(id, dto);
  }

  @Patch(':id/inquilino')
  upsertInquilino(@Param('id') id: string, @Body() dto: UpsertInquilinoDto) {
    return this.propiedadesService.upsertInquilino(id, dto);
  }

  @Delete(':id/inquilino')
  removeInquilino(@Param('id') id: string) {
    return this.propiedadesService.removeInquilino(id);
  }

  @Post(':id/fotos')
  @UseInterceptors(FileInterceptor('archivo', fotoPropiedadMulterOptions))
  agregarFoto(@Param('id') id: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.propiedadesService.agregarFoto(id, archivo);
  }

  @Delete(':id/fotos/:fotoId')
  eliminarFoto(@Param('id') id: string, @Param('fotoId') fotoId: string) {
    return this.propiedadesService.eliminarFoto(id, fotoId);
  }

  @Post(':id/documentos')
  @UseInterceptors(FileInterceptor('archivo', documentoMulterOptions))
  agregarDocumento(@Param('id') id: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.propiedadesService.agregarDocumento(id, archivo);
  }

  @Delete(':id/documentos/:documentoId')
  eliminarDocumento(@Param('id') id: string, @Param('documentoId') documentoId: string) {
    return this.propiedadesService.eliminarDocumento(id, documentoId);
  }
}
