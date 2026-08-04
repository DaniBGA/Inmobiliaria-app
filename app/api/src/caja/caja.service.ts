import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Moneda, TipoMovimientoCaja, OrigenMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { mesStringAFecha, primerDiaMes, sumarMeses } from '../common/fecha.util';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';

export interface RegistrarMovimientoInput {
  fecha: Date;
  tipo: TipoMovimientoCaja;
  moneda: Moneda;
  monto: Prisma.Decimal | number;
  concepto: string;
  categoria?: string;
  medio?: string;
  referencia?: string;
  origen: OrigenMovimientoCaja;
}

@Injectable()
export class CajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  // Usado por los demás módulos (Cobros, Gastos, Liquidaciones, Incidencias,
  // Ventas) para generar el movimiento automático correspondiente (§3.8).
  // Recibe opcionalmente un `tx` para participar de la misma transacción que
  // el registro que lo origina.
  registrarMovimiento(
    input: RegistrarMovimientoInput,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return tx.movimientoCaja.create({ data: input });
  }

  eliminarMovimiento(id: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.movimientoCaja.delete({ where: { id } });
  }

  async findMes(mes: string, moneda?: Moneda) {
    const desde = primerDiaMes(mes.length === 7 ? `${mes}-01` : mes);
    const hasta = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1));
    return this.prisma.movimientoCaja.findMany({
      where: {
        fecha: { gte: desde, lt: hasta },
        ...(moneda ? { moneda } : {}),
      },
      // Los ids de la relación inversa (§3.8) le permiten al frontend editar
      // un movimiento automático desde Caja sin otra consulta: sabe a qué
      // Pago/Gasto/Liquidación/PagoProveedor/Venta pegarle sin tener que
      // buscarlo por otro lado.
      include: {
        pago: { select: { id: true } },
        gasto: { select: { id: true } },
        liquidacion: { select: { id: true, propietarioId: true, mes: true } },
        pagoProveedor: { select: { id: true } },
        ventaSena: { select: { id: true } },
        ventaComision: { select: { id: true } },
      },
      orderBy: { fecha: 'asc' },
    });
  }

  // Manual: siempre origen MANUAL, sin importar qué mande el cliente (§3.8:
  // los automáticos solo se generan desde su módulo de origen).
  registrarManual(input: Omit<RegistrarMovimientoInput, 'origen'>) {
    return this.prisma.movimientoCaja.create({
      data: { ...input, origen: OrigenMovimientoCaja.MANUAL },
    });
  }

  // Editar un movimiento manual (§2.4): los automáticos (COBRO_ALQUILER,
  // GASTO_PROPIEDAD, LIQUIDACION_PROPIETARIO, PAGO_PROVEEDOR, SENA_VENTA,
  // COMISION_VENTA) se corrigen desde su módulo de origen (§3.8) — permitir
  // editarlos acá duplicaría la fuente de verdad y podría desincronizar el
  // registro de Caja con el que lo generó (el pago, el gasto, etc.).
  async editarManual(id: string, dto: UpdateMovimientoDto) {
    const movimiento = await this.prisma.movimientoCaja.findUniqueOrThrow({ where: { id } });
    if (movimiento.origen !== OrigenMovimientoCaja.MANUAL) {
      throw new BadRequestException(
        'Este movimiento es automático: se edita desde el módulo que lo generó, no desde Caja.',
      );
    }

    return this.prisma.movimientoCaja.update({
      where: { id },
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        tipo: dto.tipo,
        moneda: dto.moneda,
        monto: dto.monto,
        concepto: dto.concepto,
        categoria: dto.categoria,
        medio: dto.medio,
        referencia: dto.referencia,
      },
    });
  }

  // Eliminar un movimiento manual (mismo criterio que editarManual: los
  // automáticos se eliminan desde su módulo de origen — p. ej. anular un
  // pago en Cobros, o "Quitar seña" / "Deshacer venta" en Ventas — para que
  // el registro que lo generó no quede desincronizado con Caja).
  async eliminarManual(id: string) {
    const movimiento = await this.prisma.movimientoCaja.findUniqueOrThrow({ where: { id } });
    if (movimiento.origen !== OrigenMovimientoCaja.MANUAL) {
      throw new BadRequestException(
        'Este movimiento es automático: se elimina desde el módulo que lo generó, no desde Caja.',
      );
    }
    return this.prisma.movimientoCaja.delete({ where: { id } });
  }

  // §2.4: saldo acumulado al cierre del mes visto — SOLO caja en pesos
  // (los movimientos en USD/EUR se informan aparte, sin afectar este saldo,
  // §3.8). Es acumulado desde `saldoInicialCaja` hasta el cierre del mes,
  // no solo el neto de ese mes.
  async saldoAcumuladoHasta(fechaFin: Date): Promise<number> {
    const configuracion = await this.configuracionService.get();
    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: { fecha: { lt: fechaFin }, moneda: Moneda.ARS },
      select: { tipo: true, monto: true },
    });
    const neto = movimientos.reduce(
      (acc, m) => acc + (m.tipo === TipoMovimientoCaja.INGRESO ? Number(m.monto) : -Number(m.monto)),
      0,
    );
    return Number(configuracion.saldoInicialCaja) + neto;
  }

  // §2.4: los 5 KPIs de Caja.
  async kpisDelMes(mesStr: string) {
    const mes = mesStringAFecha(mesStr);
    const finMes = sumarMeses(mes, 1);
    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: { fecha: { gte: mes, lt: finMes } },
    });

    const sumar = (pred: (m: (typeof movimientos)[number]) => boolean) =>
      movimientos.filter(pred).reduce((acc, m) => acc + Number(m.monto), 0);

    const ingresosPesos = sumar((m) => m.tipo === TipoMovimientoCaja.INGRESO && m.moneda === Moneda.ARS);
    const egresosPesos = sumar((m) => m.tipo === TipoMovimientoCaja.EGRESO && m.moneda === Moneda.ARS);
    // Ingresos en USD (§2.4): señas de venta + comisiones + movimientos
    // manuales en USD del mes — nunca se convierten a pesos.
    const ingresosDolares = sumar((m) => m.tipo === TipoMovimientoCaja.INGRESO && m.moneda === Moneda.USD);

    const liquidacionesDelMes = await this.prisma.liquidacion.findMany({
      where: { mes },
      include: { detalle: true },
    });
    const honorariosDelMes = liquidacionesDelMes.reduce(
      (acc, l) =>
        acc + l.detalle.reduce((a, d) => a + Number(d.honorarios) + Number(d.honorariosAdministracion), 0),
      0,
    );
    const gastosInmobiliaria = await this.prisma.gasto.aggregate({
      where: { mes, destino: 'INMOBILIARIA' },
      _sum: { monto: true },
    });

    // Ganancia = honorarios + comisiones − gastos propios (§2.1): las
    // comisiones de venta están en USD y los honorarios en ARS — el
    // documento no resuelve la mezcla de monedas acá (queda anotado como
    // pendiente de producción en §7, "totales por moneda extranjera").
    // Se informan por separado para no falsear un total mezclando monedas.
    const comisionesVentaUsd = sumar((m) => m.origen === OrigenMovimientoCaja.COMISION_VENTA);
    const gananciaPesos = honorariosDelMes - Number(gastosInmobiliaria._sum.monto ?? 0);

    const saldoAcumulado = await this.saldoAcumuladoHasta(finMes);

    return {
      mes: mesStr,
      ingresosPesos,
      egresosPesos,
      ingresosDolares,
      gananciaPesos,
      comisionesVentaUsd,
      saldoAcumulado,
    };
  }
}
