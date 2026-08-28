import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PropiedadesService } from './propiedades.service';
import { CreatePropiedadDto } from './dto/create-propiedad.dto';
import { UpdatePropiedadDto } from './dto/update-propiedad.dto';
import { RegistrarAumentoDto } from './dto/registrar-aumento.dto';
import { UpdateAumentoDto } from './dto/update-aumento.dto';
import { UpsertInquilinoDto } from './dto/upsert-inquilino.dto';
import { fotoPropiedadMulterOptions, documentoMulterOptions } from './multer.config';
import { MulterExceptionFilter } from './multer-exception.filter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('propiedades')
@UseGuards(JwtAuthGuard)
export class PropiedadesController {
  constructor(private readonly propiedadesService: PropiedadesService) {}

  // Lectura abierta: Ventas y Carteles (incl. un designado, rol EQUIPO)
  // necesita ver la cartera completa. Las mutaciones de acá abajo son
  // "editar/agregar propiedades" — un designado no puede tocarlas, solo
  // trabaja el pipeline de venta (interesados/seña/cierre/terceros, ver
  // ventas.controller.ts) sobre lo que ya existe.
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

  @Get(':id/proximos-aumentos')
  proximosAumentos(@Param('id') id: string) {
    return this.propiedadesService.proximosAumentos(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  create(@Body() dto: CreatePropiedadDto) {
    return this.propiedadesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePropiedadDto) {
    return this.propiedadesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.propiedadesService.remove(id);
  }

  @Post(':id/aumentos')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  registrarAumento(@Param('id') id: string, @Body() dto: RegistrarAumentoDto) {
    return this.propiedadesService.registrarAumento(id, dto);
  }

  @Patch(':id/aumentos/:aumentoId')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  editarAumento(@Param('id') id: string, @Param('aumentoId') aumentoId: string, @Body() dto: UpdateAumentoDto) {
    return this.propiedadesService.editarAumento(id, aumentoId, dto);
  }

  @Delete(':id/aumentos/:aumentoId')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  eliminarAumento(@Param('id') id: string, @Param('aumentoId') aumentoId: string) {
    return this.propiedadesService.eliminarAumento(id, aumentoId);
  }

  @Patch(':id/inquilino')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  upsertInquilino(@Param('id') id: string, @Body() dto: UpsertInquilinoDto) {
    return this.propiedadesService.upsertInquilino(id, dto);
  }

  @Delete(':id/inquilino')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  removeInquilino(@Param('id') id: string) {
    return this.propiedadesService.removeInquilino(id);
  }

  @Post(':id/fotos')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('archivo', fotoPropiedadMulterOptions))
  agregarFoto(@Param('id') id: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.propiedadesService.agregarFoto(id, archivo);
  }

  @Delete(':id/fotos/:fotoId')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  eliminarFoto(@Param('id') id: string, @Param('fotoId') fotoId: string) {
    return this.propiedadesService.eliminarFoto(id, fotoId);
  }

  @Patch(':id/fotos/:fotoId/portada')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  marcarFotoPortada(@Param('id') id: string, @Param('fotoId') fotoId: string) {
    return this.propiedadesService.marcarFotoPortada(id, fotoId);
  }

  @Post(':id/documentos')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('archivo', documentoMulterOptions))
  agregarDocumento(@Param('id') id: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.propiedadesService.agregarDocumento(id, archivo);
  }

  @Delete(':id/documentos/:documentoId')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  eliminarDocumento(@Param('id') id: string, @Param('documentoId') documentoId: string) {
    return this.propiedadesService.eliminarDocumento(id, documentoId);
  }
}
