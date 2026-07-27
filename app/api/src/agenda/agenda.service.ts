import { Injectable } from '@nestjs/common';
import { EstadoIncidencia } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { mesStringAFecha, sumarMeses } from '../common/fecha.util';

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propiedadesService: PropiedadesService,
  ) {}

  crear(dto: CreateEventoDto) {
    return this.prisma.eventoAgenda.create({
      data: { ...dto, fecha: new Date(dto.fecha) },
    });
  }

  update(id: string, dto: UpdateEventoDto) {
    return this.prisma.eventoAgenda.update({
      where: { id },
      data: { ...dto, fecha: dto.fecha ? new Date(dto.fecha) : undefined },
    });
  }

  marcarHecho(id: string, hecho: boolean) {
    return this.prisma.eventoAgenda.update({ where: { id }, data: { hecho } });
  }

  remove(id: string) {
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
  async eventosDelMes(mesStr: string) {
    const mes = mesStringAFecha(mesStr);
    const finMes = sumarMeses(mes, 1);
    const enRango = { gte: mes, lt: finMes };

    const manuales = await this.prisma.eventoAgenda.findMany({
      where: { fecha: enRango },
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
    const eventosAumento = [];
    for (const p of propiedadesAlquiladas) {
      const proxima = await this.propiedadesService.proximoAumento(p.id);
      if (proxima && proxima >= mes && proxima < finMes) {
        eventosAumento.push({
          tipo: 'AUMENTO_PROXIMO' as const,
          fecha: proxima,
          titulo: `Aumento próximo — ${p.nombre}`,
          propiedadId: p.id,
          automatico: true,
        });
      }
    }

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
      mes: mesStr,
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
