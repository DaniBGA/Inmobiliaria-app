import { BadRequestException, Injectable } from '@nestjs/common';
import { Moneda, OrigenMovimientoCaja, TipoMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CajaService } from '../caja/caja.service';
import { ProveedoresService } from './proveedores.service';

@Injectable()
export class PagosProveedorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
    private readonly proveedoresService: ProveedoresService,
  ) {}

  // §2.5/§3.3: botón "💵 Registrar pago" de un trabajo puntual — SIEMPRE
  // genera el egreso automático "Pago a proveedor" en Caja, en la fecha del
  // pago (el gasto original de la incidencia no generó su propio egreso).
  async registrarPagoPorTrabajo(incidenciaId: string, fechaStr?: string) {
    const incidencia = await this.prisma.incidencia.findUniqueOrThrow({
      where: { id: incidenciaId },
      include: { proveedor: true },
    });
    if (!incidencia.proveedorId || incidencia.costo == null) {
      throw new BadRequestException('La incidencia no tiene proveedor o costo asignado.');
    }
    if (incidencia.abonadaFecha) {
      throw new BadRequestException('Este trabajo ya fue abonado.');
    }

    const fecha = fechaStr ? new Date(fechaStr) : new Date();
    const proveedorId = incidencia.proveedorId;
    const costo = incidencia.costo;

    return this.prisma.$transaction(async (tx) => {
      const movimiento = await this.cajaService.registrarMovimiento(
        {
          fecha,
          tipo: TipoMovimientoCaja.EGRESO,
          moneda: Moneda.ARS,
          monto: costo,
          concepto: `Pago a proveedor — ${incidencia.proveedor!.nombre} — ${incidencia.titulo}`,
          categoria: 'Proveedores',
          origen: OrigenMovimientoCaja.PAGO_PROVEEDOR,
        },
        tx,
      );

      const pago = await tx.pagoProveedor.create({
        data: {
          proveedorId,
          monto: costo,
          fecha,
          movimientoCajaId: movimiento.id,
          incidencias: { create: [{ incidenciaId }] },
        },
      });

      await tx.incidencia.update({
        where: { id: incidenciaId },
        data: { abonadaFecha: fecha },
      });

      return pago;
    });
  }

  // Botón "💵 Pagar saldo": salda TODOS los trabajos pendientes del
  // proveedor de una vez, en un único pago y un único egreso.
  async pagarSaldo(proveedorId: string, fechaStr?: string) {
    return this.prisma.$transaction(async (tx) => {
      const proveedor = await tx.proveedor.findUniqueOrThrow({ where: { id: proveedorId } });
      const pendientes = await this.proveedoresService.incidenciasPendientesDePago(proveedorId, tx);

      if (pendientes.length === 0) {
        throw new BadRequestException('Este proveedor no tiene saldo pendiente.');
      }

      const fecha = fechaStr ? new Date(fechaStr) : new Date();
      const monto = pendientes.reduce((acc, i) => acc + Number(i.costo), 0);

      const movimiento = await this.cajaService.registrarMovimiento(
        {
          fecha,
          tipo: TipoMovimientoCaja.EGRESO,
          moneda: Moneda.ARS,
          monto,
          concepto: `Pago a proveedor — ${proveedor.nombre} — saldo completo (${pendientes.length} trabajos)`,
          categoria: 'Proveedores',
          origen: OrigenMovimientoCaja.PAGO_PROVEEDOR,
        },
        tx,
      );

      const pago = await tx.pagoProveedor.create({
        data: {
          proveedorId,
          monto,
          fecha,
          movimientoCajaId: movimiento.id,
          incidencias: { create: pendientes.map((i) => ({ incidenciaId: i.id })) },
        },
      });

      await tx.incidencia.updateMany({
        where: { id: { in: pendientes.map((i) => i.id) } },
        data: { abonadaFecha: fecha },
      });

      return pago;
    });
  }
}
