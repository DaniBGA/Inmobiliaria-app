import { BadRequestException, Injectable } from '@nestjs/common';
import { DestinoGasto, Moneda, OrigenMovimientoCaja, Prisma, TipoMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CajaService } from '../caja/caja.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { mesStringAFecha } from '../common/fecha.util';

export interface CrearGastoDesdeIncidenciaInput {
  incidenciaId: string;
  propiedadId: string;
  propiedadNombre: string;
  mes: Date;
  descripcion: string;
  monto: number;
  fecha: Date;
  categoria: string;
  destino: DestinoGasto;
  // Cuando la incidencia no tiene proveedor asignado, nunca va a existir un
  // "pago a proveedor" que genere el egreso más adelante — si además la
  // paga la inmobiliaria (no el propietario ni el inquilino), la plata salió
  // igual, así que este gasto tiene que generar su propio egreso en Caja
  // ahora mismo (§ pedido: incidencias sin proveedor pagadas por la
  // inmobiliaria deben verse en Caja).
  generarEgresoCaja?: boolean;
}

@Injectable()
export class GastosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
  ) {}

  // `select` acotado en la relación (no `include`): el admin solo muestra
  // `propiedad.nombre` en las pantallas que consumen estos dos métodos —
  // pedir la fila entera de Propiedad (~40 columnas) por cada gasto era
  // puro over-fetch.
  findAll(propiedadId?: string, mes?: string) {
    return this.prisma.gasto.findMany({
      where: {
        propiedadId,
        mes: mes ? mesStringAFecha(mes) : undefined,
      },
      include: { propiedad: { select: { id: true, nombre: true } } },
      orderBy: { fecha: 'desc' },
    });
  }

  // Usado para editar un gasto desde Caja (§3.8): ahí solo se conoce el
  // `gastoId` vía la relación inversa del movimiento, no el propiedadId, así
  // que hace falta poder pedir un gasto suelto por id.
  findOne(id: string) {
    return this.prisma.gasto.findUniqueOrThrow({
      where: { id },
      include: { propiedad: { select: { id: true, nombre: true } } },
    });
  }

  // §3.2: alta manual (ficha de propiedad, Liquidaciones) — genera SIEMPRE
  // el egreso automático en Caja, a diferencia de los gastos que nacen de
  // una incidencia (ver crearDesdeIncidencia).
  async crear(dto: CreateGastoDto) {
    const propiedad = await this.prisma.propiedad.findUniqueOrThrow({
      where: { id: dto.propiedadId },
    });
    const mes = mesStringAFecha(dto.mes);

    return this.prisma.$transaction(async (tx) => {
      const movimiento = await this.cajaService.registrarMovimiento(
        {
          fecha: new Date(dto.fecha),
          tipo: TipoMovimientoCaja.EGRESO,
          moneda: Moneda.ARS,
          monto: dto.monto,
          concepto: `Gasto — ${propiedad.nombre} — ${dto.descripcion}`,
          categoria: dto.categoria,
          origen: OrigenMovimientoCaja.GASTO_PROPIEDAD,
        },
        tx,
      );

      return tx.gasto.create({
        data: {
          propiedadId: dto.propiedadId,
          mes,
          descripcion: dto.descripcion,
          monto: dto.monto,
          fecha: new Date(dto.fecha),
          categoria: dto.categoria,
          destino: dto.destino,
          movimientoCajaId: movimiento.id,
        },
      });
    });
  }

  // §3.3: gasto generado automáticamente al marcar RESUELTA una incidencia
  // con costo. Por defecto NO genera egreso propio en Caja — cuando hay
  // proveedor asignado, la única salida de caja de ese trabajo es el pago al
  // proveedor (evita duplicar el egreso). Cuando no hay proveedor y la paga
  // la inmobiliaria (`generarEgresoCaja`), no hay ningún otro paso que vaya
  // a registrar esa salida de plata, así que se genera acá.
  async crearDesdeIncidencia(
    input: CrearGastoDesdeIncidenciaInput,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    let movimientoCajaId: string | undefined;
    if (input.generarEgresoCaja) {
      const movimiento = await this.cajaService.registrarMovimiento(
        {
          fecha: input.fecha,
          tipo: TipoMovimientoCaja.EGRESO,
          moneda: Moneda.ARS,
          monto: input.monto,
          concepto: `Gasto — ${input.propiedadNombre} — ${input.descripcion}`,
          categoria: input.categoria,
          origen: OrigenMovimientoCaja.GASTO_PROPIEDAD,
        },
        tx,
      );
      movimientoCajaId = movimiento.id;
    }

    return tx.gasto.create({
      data: {
        propiedadId: input.propiedadId,
        mes: input.mes,
        descripcion: input.descripcion,
        monto: input.monto,
        fecha: input.fecha,
        categoria: input.categoria,
        destino: input.destino,
        incidenciaId: input.incidenciaId,
        movimientoCajaId,
      },
    });
  }

  async editar(id: string, dto: UpdateGastoDto) {
    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.findUniqueOrThrow({ where: { id } });
      if (gasto.incidenciaId) {
        throw new BadRequestException(
          'Este gasto se generó desde una incidencia; se edita desde Incidencias.',
        );
      }

      const actualizado = await tx.gasto.update({
        where: { id },
        data: {
          descripcion: dto.descripcion,
          monto: dto.monto,
          fecha: dto.fecha ? new Date(dto.fecha) : undefined,
          categoria: dto.categoria,
          destino: dto.destino,
        },
      });

      if (gasto.movimientoCajaId) {
        await tx.movimientoCaja.update({
          where: { id: gasto.movimientoCajaId },
          data: {
            monto: dto.monto ?? undefined,
            fecha: dto.fecha ? new Date(dto.fecha) : undefined,
            categoria: dto.categoria ?? undefined,
          },
        });
      }

      return actualizado;
    });
  }

  async eliminar(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.findUniqueOrThrow({ where: { id } });
      if (gasto.incidenciaId) {
        throw new BadRequestException(
          'Este gasto se generó desde una incidencia; se elimina resolviendo o editando esa incidencia.',
        );
      }
      if (gasto.movimientoCajaId) {
        await tx.movimientoCaja.delete({ where: { id: gasto.movimientoCajaId } });
      }
      return tx.gasto.delete({ where: { id } });
    });
  }

  // Usado por Facturas (destino INQUILINO) y Liquidaciones (destino
  // PROPIETARIO) para traer los gastos del mes de una propiedad (§3.2, §3.4, §3.5)
  findParaMes(propiedadId: string, mes: Date, destino: DestinoGasto) {
    return this.prisma.gasto.findMany({
      where: { propiedadId, mes, destino },
      orderBy: { fecha: 'asc' },
    });
  }
}
