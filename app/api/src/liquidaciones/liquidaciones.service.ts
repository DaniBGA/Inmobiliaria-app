import { Injectable, NotFoundException } from '@nestjs/common';
import { DestinoGasto, Moneda, OrigenMovimientoCaja, TipoMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FacturasService } from '../facturacion/facturas.service';
import { GastosService } from '../gastos/gastos.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CajaService } from '../caja/caja.service';
import { mesStringAFecha } from '../common/fecha.util';
import { resolverPorcentajeHonorarios, resolverPorcentajeHonorariosAdministracion } from '../common/honorarios.util';
import { LiquidacionDetalleInputDto } from './dto/liquidacion-detalle-input.dto';

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
  // (mismos ítems que la factura de cada inquilino, editables a mano antes
  // de confirmar — ver `generar()`) − gastos que absorbe (siempre calculado
  // desde Incidencias/Gastos reales, no editable acá) − honorarios propios
  // de cada propiedad = neto a girar.
  private async calcularDetalle(
    propietarioId: string,
    mesStr: string,
    overridePorPropiedad?: Map<string, LiquidacionDetalleInputDto['items']>,
  ) {
    const mes = mesStringAFecha(mesStr);
    const configuracion = await this.configuracionService.get();

    const propiedades = await this.prisma.propiedad.findMany({
      where: { propietarioId, modalidad: 'ALQUILER', inquilino: { isNot: null } },
      orderBy: { nombre: 'asc' },
    });

    return Promise.all(
      propiedades.map(async (propiedad) => {
        const itemsOverride = overridePorPropiedad?.get(propiedad.id);
        let items: { descripcion: string; monto: number; numeroLiquidacion?: string }[];
        if (itemsOverride) {
          items = itemsOverride;
        } else {
          const factura = await this.facturasService.obtenerDelMes(propiedad.id, mesStr);
          items = factura
            ? factura.items.map((it) => ({
                descripcion: it.descripcion,
                monto: Number(it.monto),
                numeroLiquidacion: it.numeroLiquidacion ?? undefined,
              }))
            : await this.facturasService.itemsPredeterminados(propiedad.id, mesStr);
        }

        const cobradoTotal = items.reduce((acc, it) => acc + Number(it.monto), 0);

        const gastosPropietario = await this.gastosService.findParaMes(
          propiedad.id,
          mes,
          DestinoGasto.PROPIETARIO,
        );
        // §3.3: cada gasto con destino PROPIETARIO nace casi siempre de una
        // Incidencia resuelta con costo a su cargo (`Gasto.descripcion` =
        // `Incidencia.titulo`, ver incidencias.service.ts::resolver()) —
        // se guarda el detalle línea por línea para poder mostrar cuál
        // incidencia puntual se absorbió, no solo la suma.
        const gastosDetalle = gastosPropietario.map((g) => ({
          descripcion: g.descripcion,
          monto: Number(g.monto),
        }));
        const gastosAbsorbidos = gastosDetalle.reduce((acc, g) => acc + g.monto, 0);

        const porcentajeHonorarios = resolverPorcentajeHonorarios(
          propiedad,
          Number(configuracion.honorariosDefaultPorcentaje),
        );
        // Los honorarios se calculan sobre el alquiler puro, no sobre
        // `cobradoTotal` (que además incluye expensas, servicios trasladados
        // y deuda arrastrada — montos que la inmobiliaria solo intermedia,
        // no factura como propios).
        const baseAlquiler = Number(items.find((it) => it.descripcion === 'Alquiler')?.monto ?? 0);
        const honorarios = Math.round(baseAlquiler * (porcentajeHonorarios / 100) * 100) / 100;

        const porcentajeHonorariosAdministracion = resolverPorcentajeHonorariosAdministracion(propiedad);
        const honorariosAdministracion =
          Math.round(baseAlquiler * (porcentajeHonorariosAdministracion / 100) * 100) / 100;

        const neto = cobradoTotal - gastosAbsorbidos - honorarios - honorariosAdministracion;

        return {
          propiedadId: propiedad.id,
          propiedadNombre: propiedad.nombre,
          cobradoTotal,
          gastosAbsorbidos,
          gastosDetalle,
          honorarios,
          honorariosAdministracion,
          // No se persisten — es para que el frontend pueda recalcular en
          // vivo los honorarios si el usuario edita el monto de Alquiler
          // antes de emitir, con la misma fórmula que usa el backend.
          porcentajeHonorarios,
          porcentajeHonorariosAdministracion,
          neto,
          items,
        };
      }),
    );
  }

  // Vista previa editable (sin persistir) — punto de partida del modal de
  // "Imprimir liquidación del mes", igual que `itemsPredeterminados()` lo es
  // para Facturas.
  previsualizar(propietarioId: string, mesStr: string) {
    return this.calcularDetalle(propietarioId, mesStr);
  }

  async generar(propietarioId: string, mesStr: string, detalleInput?: LiquidacionDetalleInputDto[]) {
    const propietario = await this.prisma.propietario.findUnique({
      where: { id: propietarioId },
    });
    if (!propietario) throw new NotFoundException('Propietario no encontrado.');

    const mes = mesStringAFecha(mesStr);
    const overridePorPropiedad = detalleInput
      ? new Map(detalleInput.map((d) => [d.propiedadId, d.items]))
      : undefined;
    const detalle = await this.calcularDetalle(propietarioId, mesStr, overridePorPropiedad);

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
              honorariosAdministracion: d.honorariosAdministracion,
              neto: d.neto,
              items: {
                create: d.items.map((it, idx) => ({
                  descripcion: it.descripcion,
                  monto: it.monto,
                  numeroLiquidacion: it.numeroLiquidacion,
                  orden: idx,
                })),
              },
              gastos: {
                create: d.gastosDetalle.map((g, idx) => ({
                  descripcion: g.descripcion,
                  monto: g.monto,
                  orden: idx,
                })),
              },
            })),
          },
        },
        include: {
          detalle: {
            include: {
              items: { orderBy: { orden: 'asc' } },
              gastos: { orderBy: { orden: 'asc' } },
              propiedad: true,
            },
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
        detalle: {
          include: {
            items: { orderBy: { orden: 'asc' } },
            gastos: { orderBy: { orden: 'asc' } },
            propiedad: true,
          },
        },
      },
    });
  }
}
