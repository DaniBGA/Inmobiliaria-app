import { Injectable } from '@nestjs/common';
import { EstadoCliente, TipoOperacionCliente } from '@prisma/client';
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

  async kpis() {
    const [total, buscanAlquilar, buscanComprar, sinContactar] = await Promise.all([
      this.prisma.cliente.count(),
      this.prisma.cliente.count({ where: { tipoOperacion: TipoOperacionCliente.ALQUILAR } }),
      this.prisma.cliente.count({ where: { tipoOperacion: TipoOperacionCliente.COMPRAR } }),
      this.prisma.cliente.count({ where: { estado: EstadoCliente.SIN_CONTACTAR } }),
    ]);
    return { total, buscanAlquilar, buscanComprar, sinContactar };
  }
}
