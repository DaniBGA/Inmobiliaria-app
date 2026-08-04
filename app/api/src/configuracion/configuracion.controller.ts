import { Body, Controller, Get, Patch, Post, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfiguracionService } from './configuracion.service';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { fotoNosotrosMulterOptions } from './foto-nosotros-multer.config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { MulterExceptionFilter } from '../propiedades/multer-exception.filter';

@Controller('configuracion')
@UseGuards(JwtAuthGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  get() {
    return this.configuracionService.get();
  }

  @Get('dolar')
  cotizacionDolar() {
    return this.configuracionService.cotizacionDolar();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  update(@Body() dto: UpdateConfiguracionDto) {
    return this.configuracionService.update(dto);
  }

  @Post('foto-nosotros')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('archivo', fotoNosotrosMulterOptions))
  actualizarFotoNosotros(@UploadedFile() archivo: Express.Multer.File) {
    return this.configuracionService.actualizarFotoNosotros(archivo);
  }
}
