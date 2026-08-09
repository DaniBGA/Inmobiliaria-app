import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get('mes/:mes')
  eventosDelMes(@Param('mes') mes: string, @Req() req: any) {
    return this.agendaService.eventosDelMes(mes, req.user);
  }

  @Get('clientes/:clienteId/proximo-evento')
  proximoEventoDeCliente(@Param('clienteId') clienteId: string) {
    return this.agendaService.proximoEventoDeCliente(clienteId);
  }

  @Post()
  crear(@Body() dto: CreateEventoDto, @Req() req: any) {
    return this.agendaService.crear(dto, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventoDto, @Req() req: any) {
    return this.agendaService.update(id, dto, req.user);
  }

  @Patch(':id/hecho')
  marcarHecho(@Param('id') id: string, @Body('hecho') hecho: boolean, @Req() req: any) {
    return this.agendaService.marcarHecho(id, hecho, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.agendaService.remove(id, req.user);
  }
}
