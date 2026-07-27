import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get('mes/:mes')
  eventosDelMes(@Param('mes') mes: string) {
    return this.agendaService.eventosDelMes(mes);
  }

  @Get('clientes/:clienteId/proximo-evento')
  proximoEventoDeCliente(@Param('clienteId') clienteId: string) {
    return this.agendaService.proximoEventoDeCliente(clienteId);
  }

  @Post()
  crear(@Body() dto: CreateEventoDto) {
    return this.agendaService.crear(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventoDto) {
    return this.agendaService.update(id, dto);
  }

  @Patch(':id/hecho')
  marcarHecho(@Param('id') id: string, @Body('hecho') hecho: boolean) {
    return this.agendaService.marcarHecho(id, hecho);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agendaService.remove(id);
  }
}
