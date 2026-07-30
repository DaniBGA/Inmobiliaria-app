import { Injectable } from '@nestjs/common';
import { EstadoCliente, OrigenCliente, TipoOperacionCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgendaService } from '../agenda/agenda.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agendaService: AgendaService,
  ) {}

  // §2.6: buscador simple + filtro por estado/tipo de operación
  findAll(q?: string, estado?: EstadoCliente, tipoOperacion?: TipoOperacionCliente) {
    return this.prisma.cliente.findMany({
      where: {
        estado,
        tipoOperacion,
        nombre: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      include: { delegado: true },
      orderBy: { fechaAlta: 'desc' },
    });
  }

  // §2.6: la ficha muestra el próximo evento agendado (evento pendiente más
  // cercano) — un solo lugar donde se resuelve, no un campo duplicado.
  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id },
      include: { delegado: true, interesadoVentas: { include: { venta: true } } },
    });
    const proximoEvento = await this.agendaService.proximoEventoDeCliente(id);
    return { ...cliente, proximoEvento };
  }

  create(dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: dto });
  }

  update(id: string, dto: UpdateClienteDto) {
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.cliente.delete({ where: { id } });
  }

  // §2.6: reemplaza a los KPIs sueltos — de dónde vienen los clientes, para
  // el gráfico de torta. Siempre devuelve las 5 categorías (incluso en 0)
  // para que el gráfico y su leyenda no cambien de forma según los datos.
  async statsPorOrigen() {
    const conteos = await this.prisma.cliente.groupBy({
      by: ['origen'],
      _count: { _all: true },
    });
    const porOrigen = new Map(conteos.map((c) => [c.origen, c._count._all]));
    return Object.values(OrigenCliente).map((origen) => ({
      origen,
      cantidad: porOrigen.get(origen) ?? 0,
    }));
  }
}
