import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCliente, OrigenCliente, RolUsuario, TipoOperacionCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgendaService } from '../agenda/agenda.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

type UsuarioRequest = { id: string; rol: RolUsuario; integranteEquipoId: string | null };

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agendaService: AgendaService,
  ) {}

  // §2.6: buscador simple + filtro por estado/tipo de operación. Nunca
  // incluye los borrados de forma blanda (ver `eliminar`/`historialEliminados`).
  // Un designado (rol EQUIPO) solo ve los clientes que el admin le asignó
  // (delegadoId propio) — nunca la cartera completa. Un ADMIN ve todo, y
  // puede además filtrar por un designado puntual con `delegadoId` (§ pedido
  // del usuario 2026-09-04: poder elegir a alguien del equipo y ver solo lo
  // suyo).
  findAll(
    usuario: UsuarioRequest,
    q?: string,
    estado?: EstadoCliente,
    tipoOperacion?: TipoOperacionCliente,
    delegadoId?: string,
  ) {
    return this.prisma.cliente.findMany({
      where: {
        eliminadoEn: null,
        estado,
        tipoOperacion,
        delegadoId: usuario.rol === RolUsuario.EQUIPO ? usuario.integranteEquipoId : delegadoId,
        nombre: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      include: { delegado: true },
      orderBy: { fechaAlta: 'desc' },
    });
  }

  // Historial de clientes eliminados — pensado para poder revisar (y, si
  // fue un error, restaurar) un cliente borrado por accidente, en vez de
  // perderlo para siempre en el momento en que alguien clickea "Eliminar".
  historialEliminados() {
    return this.prisma.cliente.findMany({
      where: { eliminadoEn: { not: null } },
      include: { delegado: true },
      orderBy: { eliminadoEn: 'desc' },
    });
  }

  // Un designado (EQUIPO) no puede tocar/ver el cliente de otro, aunque
  // sepa el id — mismo motivo que AgendaService.assertPropietario: protege
  // contra un JWT robado usado directo contra la API.
  private async assertPropietario(id: string, usuario: UsuarioRequest) {
    if (usuario.rol !== RolUsuario.EQUIPO) return;
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    if (cliente.delegadoId !== usuario.integranteEquipoId) {
      throw new ForbiddenException('No podés acceder a un cliente que no te fue designado.');
    }
  }

  // §2.6: la ficha muestra el próximo evento agendado (evento pendiente más
  // cercano) — un solo lugar donde se resuelve, no un campo duplicado.
  async findOne(id: string, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id },
      include: { delegado: true, interesadoVentas: { include: { venta: true } } },
    });
    const proximoEvento = await this.agendaService.proximoEventoDeCliente(id);
    return { ...cliente, proximoEvento };
  }

  // El delegado de un cliente creado por un designado (EQUIPO) sale siempre
  // del JWT, nunca de lo que mande el cliente HTTP (pedido del usuario
  // 2026-09-04: "que solo lo pueda ver el designado que lo creó") — mismo
  // criterio que AgendaService.crear con `usuarioId`. `usuario` es opcional
  // porque el form de contacto de la landing pública (public.controller.ts)
  // crea clientes sin sesión — ahí simplemente no hay delegado.
  create(dto: CreateClienteDto, usuario?: UsuarioRequest) {
    return this.prisma.cliente.create({
      data: {
        ...dto,
        delegadoId: usuario?.rol === RolUsuario.EQUIPO ? usuario.integranteEquipoId : dto.delegadoId,
      },
    });
  }

  // Un designado no puede reasignar su cliente a otra persona del equipo —
  // se ignora cualquier `delegadoId` que mande en el body.
  async update(id: string, dto: UpdateClienteDto, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.cliente.update({
      where: { id },
      data: { ...dto, delegadoId: usuario.rol === RolUsuario.EQUIPO ? usuario.integranteEquipoId : dto.delegadoId },
    });
  }

  // Borrado blando: no borra la fila, solo la saca de las listas normales.
  // Recuperable desde el historial hasta que alguien la borre "de forma
  // definitiva" ahí mismo (ADMIN-only, ver controller).
  async remove(id: string, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.cliente.update({ where: { id }, data: { eliminadoEn: new Date() } });
  }

  restaurar(id: string) {
    return this.prisma.cliente.update({ where: { id }, data: { eliminadoEn: null } });
  }

  // Único borrado real (irreversible) — solo se ofrece desde el historial
  // de eliminados, nunca desde la lista normal de clientes.
  removeDefinitivo(id: string) {
    return this.prisma.cliente.delete({ where: { id } });
  }

  // §2.6: reemplaza a los KPIs sueltos — de dónde vienen los clientes, para
  // el gráfico de torta. Siempre devuelve las 5 categorías (incluso en 0)
  // para que el gráfico y su leyenda no cambien de forma según los datos.
  // Excluye tipoOperacion VENDER y PROPIETARIO_ALQUILER (propietarios) —
  // pedido del usuario 2026-08-15: el gráfico es "origen de los CLIENTES"
  // (quieren alquilar/comprar), un propietario que carga una propiedad no
  // es un lead nuevo en ese sentido y no tiene que inflar estas categorías.
  // PROPIETARIO_ALQUILER (agregado 2026-08-18) es el mismo caso que VENDER
  // pero para propiedades en alquiler, así que se excluye igual.
  async statsPorOrigen() {
    const conteos = await this.prisma.cliente.groupBy({
      by: ['origen'],
      where: {
        eliminadoEn: null,
        tipoOperacion: { notIn: [TipoOperacionCliente.VENDER, TipoOperacionCliente.PROPIETARIO_ALQUILER] },
      },
      _count: { _all: true },
    });
    const porOrigen = new Map(conteos.map((c) => [c.origen, c._count._all]));
    return Object.values(OrigenCliente).map((origen) => ({
      origen,
      cantidad: porOrigen.get(origen) ?? 0,
    }));
  }
}
