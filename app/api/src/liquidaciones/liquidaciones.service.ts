import { Injectable, NotFoundException } from '@nestjs/common';
import { DestinoGasto, Moneda, OrigenMovimientoCaja, TipoMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FacturasService } from '../facturacion/facturas.service';
import { GastosService } from '../gastos/gastos.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CajaService } from '../caja/caja.service';
import { mesStringAFecha } from '../common/fecha.util';
import { resolverPorcentajeHonorarios } from '../common/honorarios.util';

@Injectable()
export class LiquidacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facturasService: FacturasService,
    private readonly gastosService: GastosService,
    private readonly configuracionService: ConfiguracionService,
    private readonly cajaService: CajaService,
  ) {}

  // §3.4: liquidación del mes por propietario = + cobros de sus propiedades
  // (mismos ítems que la factura de cada inquilino) − gastos que absorbe −
  // honorarios propios de cada propiedad = neto a girar. Se genera al
  // "imprimir" (§2.9), no hay una vista previa persistida aparte.
  async generar(propietarioId: string, mesStr: string) {
    const propietario = await this.prisma.propietario.findUnique({
      where: { id: propietarioId },
    });
    if (!propietario) throw new NotFoundException('Propietario no encontrado.');

    const mes = mesStringAFecha(mesStr);
    const configuracion = await this.configuracionService.get();

    const propiedades = await this.prisma.propiedad.findMany({
      where: { propietarioId, modalidad: 'ALQUILER', inquilino: { isNot: null } },
      orderBy: { nombre: 'asc' },
    });

    const detalle = await Promise.all(
      propiedades.map(async (propiedad) => {
        const factura = await this.facturasService.obtenerDelMes(propiedad.id, mesStr);
        const items = factura
          ? factura.items.map((it) => ({
              descripcion: it.descripcion,
              monto: Number(it.monto),
              numeroLiquidacion: it.numeroLiquidacion ?? undefined,
            }))
          : await this.facturasService.itemsPredeterminados(propiedad.id, mesStr);

        const cobradoTotal = items.reduce((acc, it) => acc + Number(it.monto), 0);

        const gastosPropietario = await this.gastosService.findParaMes(
          propiedad.id,
          mes,
          DestinoGasto.PROPIETARIO,
        );
        const gastosAbsorbidos = gastosPropietario.reduce((acc, g) => acc + Number(g.monto), 0);

        const porcentajeHonorarios = resolverPorcentajeHonorarios(
          propiedad,
          Number(configuracion.honorariosDefaultPorcentaje),
        );
        const honorarios = Math.round(cobradoTotal * (porcentajeHonorarios / 100) * 100) / 100;

        const neto = cobradoTotal - gastosAbsorbidos - honorarios;

        return {
          propiedadId: propiedad.id,
          propiedadNombre: propiedad.nombre,
          cobradoTotal,
          gastosAbsorbidos,
          honorarios,
          neto,
          items,
        };
      }),
    );

    const netoAGirar = detalle.reduce((acc, d) => acc + d.neto, 0);

    return this.prisma.$transaction(async (tx) => {
      const numero = await this.configuracionService.siguienteNumeroLiquidacion(tx);

      // Reemplaza la liquidación anterior del mismo mes si existía.
      const anterior = await tx.liquidacion.findUnique({
        where: { propietarioId_mes: { propietarioId, mes } },
      });
      if (anterior?.movimientoCajaId) {
        await tx.movimientoCaja.delete({ where: { id: anterior.movimientoCajaId } });
      }
      if (anterior) {
        await tx.liquidacion.delete({ where: { id: anterior.id } });
      }

      // Egreso automático en Caja (§3.4) — solo si hay algo positivo para
      // girar; si el neto da negativo o cero no se genera movimiento.
      let movimientoCajaId: string | undefined;
      if (netoAGirar > 0) {
        const movimiento = await this.cajaService.registrarMovimiento(
          {
            fecha: new Date(),
            tipo: TipoMovimientoCaja.EGRESO,
            moneda: Moneda.ARS,
            monto: netoAGirar,
            concepto: `Liquidación a propietario — ${propietario.nombre} (${mesStr})`,
            categoria: 'Liquidación',
            origen: OrigenMovimientoCaja.LIQUIDACION_PROPIETARIO,
          },
          tx,
        );
        movimientoCajaId = movimiento.id;
      }

      const liquidacion = await tx.liquidacion.create({
        data: {
          propietarioId,
          mes,
          numero,
          fecha: new Date(),
          netoAGirar,
          movimientoCajaId,
          detalle: {
            create: detalle.map((d) => ({
              propiedadId: d.propiedadId,
              cobradoTotal: d.cobradoTotal,
              gastosAbsorbidos: d.gastosAbsorbidos,
              honorarios: d.honorarios,
              neto: d.neto,
              items: {
                create: d.items.map((it, idx) => ({
                  descripcion: it.descripcion,
                  monto: it.monto,
                  numeroLiquidacion: it.numeroLiquidacion,
                  orden: idx,
                })),
              },
            })),
          },
        },
        include: {
          detalle: {
            include: { items: { orderBy: { orden: 'asc' } }, propiedad: true },
          },
        },
      });

      return liquidacion;
    });
  }

  obtenerDelMes(propietarioId: string, mesStr: string) {
    return this.prisma.liquidacion.findUnique({
      where: { propietarioId_mes: { propietarioId, mes: mesStringAFecha(mesStr) } },
      include: {
        detalle: { include: { items: { orderBy: { orden: 'asc' } }, propiedad: true } },
      },
    });
  }
}
