import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reportes')
@UseGuards(JwtAuthGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen-anual/:anio')
  resumenAnual(@Param('anio', ParseIntPipe) anio: number) {
    return this.reportesService.resumenAnual(anio);
  }
}
