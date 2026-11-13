import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoIncidencia, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { mesStringAFecha, sumarMeses } from '../common/fecha.util';

type UsuarioRequest = { id: string; rol: RolUsuario };

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propiedadesService: PropiedadesService,
  ) {}

  // El dueño de un evento manual sale siempre del JWT, nunca de lo que
  // mande el cliente (CreateEventoDto no tiene `usuarioId`): un designado
  // (rol EQUIPO) solo puede crear eventos para sí mismo — un ADMIN crea
  // eventos globales (usuarioId: null), visibles para todo el equipo.
  crear(dto: CreateEventoDto, usuario: UsuarioRequest) {
    return this.prisma.eventoAgenda.create({
      data: {
        ...dto,
        fecha: new Date(dto.fecha),
        usuarioId: usuario.rol === RolUsuario.EQUIPO ? usuario.id : null,
      },
    });
  }

  // Un designado (EQUIPO) no puede tocar el evento de otro, aunque sepa el
  // id — protege contra un JWT robado usado directo contra la API.
  private async assertPropietario(id: string, usuario: UsuarioRequest) {
    if (usuario.rol !== RolUsuario.EQUIPO) return;
    const evento = await this.prisma.eventoAgenda.findUnique({ where: { id } });
    if (!evento) throw new NotFoundException('Evento no encontrado.');
    if (evento.usuarioId !== usuario.id) {
      throw new ForbiddenException('No podés modificar un evento que no es tuyo.');
    }
  }

  async update(id: string, dto: UpdateEventoDto, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.eventoAgenda.update({
      where: { id },
      data: { ...dto, fecha: dto.fecha ? new Date(dto.fecha) : undefined },
    });
  }

  async marcarHecho(id: string, hecho: boolean, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.eventoAgenda.update({ where: { id }, data: { hecho } });
  }

  async remove(id: string, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.eventoAgenda.delete({ where: { id } });
  }

  // §2.7: próximo evento pendiente de un cliente (ficha de Clientes, §2.6)
  proximoEventoDeCliente(clienteId: string) {
    return this.prisma.eventoAgenda.findFirst({
      where: { clienteId, hecho: false, fecha: { gte: new Date() } },
      orderBy: { fecha: 'asc' },
    });
  }

  // §2.7: eventos del mes = los cargados a mano + los derivados
  // automáticamente (no se guardan como registro propio, §4 del documento):
  // vencimiento de contrato, próximo aumento, incidencia abierta sin
  // resolver, y fecha de ejecución mientras la incidencia esté EN_CURSO.
  // Un designado (EQUIPO) solo ve sus propios eventos manuales; un ADMIN
  // solo ve los globales (sin dueño) — nunca la agenda individual de un
  // designado puntual, para evitar confusiones sobre de quién es cada
  // evento. Los automáticos (vencimientos, aumentos, incidencias) siguen
  // siendo globales para todos, no son de nadie en particular.
  async eventosDelMes(mesStr: string, usuario: UsuarioRequest) {
    const mes = mesStringAFecha(mesStr);
    return { mes: mesStr, ...(await this.eventosEnRango(mes, sumarMeses(mes, 1), usuario)) };
  }

  // Checkbox "Ver todos los próximos" de Agenda (pedido del usuario
  // 2026-11-13): todo lo que hay desde `desdeStr` (YYYY-MM-DD, el "hoy" del
  // navegador — el servidor está en UTC y a la noche ya sería mañana) en
  // adelante, sin tope de meses. Mismos eventos y mismas reglas de
  // visibilidad por rol que `eventosDelMes()`.
  async eventosProximos(desdeStr: string | undefined, usuario: UsuarioRequest) {
    const hoy = new Date();
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(desdeStr ?? '')
      ? new Date(`${desdeStr}T00:00:00.000Z`)
      : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    return { desde: desde.toISOString().slice(0, 10), ...(await this.eventosEnRango(desde, null, usuario)) };
  }

  // `hasta: null` = sin límite hacia adelante.
  private async eventosEnRango(desde: Date, hasta: Date | null, usuario: UsuarioRequest) {
    const enRango = hasta ? { gte: desde, lt: hasta } : { gte: desde };
    const dentro = (fecha: Date) => fecha >= desde && (!hasta || fecha < hasta);

    const whereManuales = {
      fecha: enRango,
      usuarioId: usuario.rol === RolUsuario.EQUIPO ? usuario.id : null,
    };

    const manuales = await this.prisma.eventoAgenda.findMany({
      where: whereManuales,
      include: { cliente: true, propiedad: true },
      orderBy: { fecha: 'asc' },
    });

    const vencimientosContrato = await this.prisma.propiedad.findMany({
      where: { contratoFin: enRango },
    });
    const eventosVencimiento = vencimientosContrato.map((p) => ({
      tipo: 'VENCIMIENTO_CONTRATO' as const,
      fecha: p.contratoFin!,
      titulo: `Vencimiento de contrato — ${p.nombre}`,
      propiedadId: p.id,
      automatico: true,
    }));

    const propiedadesAlquiladas = await this.prisma.propiedad.findMany({
      where: { modalidad: 'ALQUILER', inquilino: { isNot: null } },
    });
    // Cada propiedad es independiente de las demás — se resuelven en
    // paralelo en vez de una por una; el resultado final igual se ordena
    // más abajo, así que el orden de resolución no importa.
    const candidatosAumento = await Promise.all(
      propiedadesAlquiladas.map(async (p) => {
        const proxima = await this.propiedadesService.proximoAumento(p.id);
        if (!proxima || !dentro(proxima)) return null;
        return {
          tipo: 'AUMENTO_PROXIMO' as const,
          fecha: proxima,
          titulo: `Aumento próximo — ${p.nombre}`,
          propiedadId: p.id,
          automatico: true,
        };
      }),
    );
    const eventosAumento = candidatosAumento.filter((e): e is NonNullable<typeof e> => e != null);

    const incidenciasSinResolver = await this.prisma.incidencia.findMany({
      where: { estado: { not: EstadoIncidencia.RESUELTA }, fechaApertura: enRango },
      include: { propiedad: true },
    });
    const eventosIncidenciaAbierta = incidenciasSinResolver.map((i) => ({
      tipo: 'INCIDENCIA_ABIERTA' as const,
      fecha: i.fechaApertura,
      titulo: `Incidencia abierta — ${i.titulo}`,
      incidenciaId: i.id,
      propiedadId: i.propiedadId,
      automatico: true,
    }));

    const incidenciasEnCurso = await this.prisma.incidencia.findMany({
      where: { estado: EstadoIncidencia.EN_CURSO, fechaEjecucion: enRango },
      include: { proveedor: true, propiedad: true },
    });
    const eventosEjecucion = incidenciasEnCurso.map((i) => ({
      tipo: 'INCIDENCIA_EJECUCION' as const,
      fecha: i.fechaEjecucion!,
      titulo: `Ejecución — ${i.titulo} (${i.proveedor?.nombre ?? 'sin proveedor'})`,
      incidenciaId: i.id,
      propiedadId: i.propiedadId,
      automatico: true,
    }));

    return {
      manuales,
      automaticos: [
        ...eventosVencimiento,
        ...eventosAumento,
        ...eventosIncidenciaAbierta,
        ...eventosEjecucion,
      ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
    };
  }
}
