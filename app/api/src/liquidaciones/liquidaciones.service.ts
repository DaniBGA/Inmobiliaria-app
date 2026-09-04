import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DestinoGasto, Moneda, OrigenMovimientoCaja, Prisma, TipoMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FacturasService } from '../facturacion/facturas.service';
import { GastosService } from '../gastos/gastos.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CajaService } from '../caja/caja.service';
import { mesStringAFecha } from '../common/fecha.util';
import { resolverPorcentajeHonorariosAdministracion } from '../common/honorarios.util';
import { esServicioTrasladable } from '../common/servicios-facturables.util';
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
        // Se busca la factura del mes SIEMPRE (no solo cuando no hay
        // override) porque `facturaNumero` de abajo la necesita igual
        // aunque el usuario haya editado los ítems a mano antes de emitir
        // — es el flujo normal desde `LiquidacionModal`, que siempre manda
        // `detalleInput`.
        const factura = await this.facturasService.obtenerDelMes(propiedad.id, mesStr);
        let items: { descripcion: string; monto: number; numeroLiquidacion?: string }[];
        if (itemsOverride) {
          items = itemsOverride;
        } else {
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

        // Los honorarios profesionales (comisión por venta) solo existen
        // para modalidad VENTA — un alquiler nunca los cobra, así que acá no
        // se calculan (quedan en 0). Lo único que la inmobiliaria retiene de
        // un alquiler es, si está habilitado, el honorario de administración.
        const porcentajeHonorariosAdministracion = resolverPorcentajeHonorariosAdministracion(propiedad);
        // Los honorarios de administración se calculan sobre el alquiler
        // puro, no sobre `cobradoTotal` (que además incluye expensas,
        // servicios trasladados y deuda arrastrada — montos que la
        // inmobiliaria solo intermedia, no factura como propios).
        // "startsWith" además del match exacto: si se editó el texto del
        // ítem de Alquiler (ej. "Alquiler (ajustado)") al emitir la
        // factura, no debe perderse el cálculo de honorarios de
        // administración — antes quedaba silenciosamente en $0.
        const baseAlquiler = Number(
          items.find((it) => it.descripcion === 'Alquiler' || it.descripcion.startsWith('Alquiler ('))?.monto ?? 0,
        );
        const honorariosAdministracion =
          Math.round(baseAlquiler * (porcentajeHonorariosAdministracion / 100) * 100) / 100;

        // Si la inmobiliaria es quien paga los servicios (§ pedido del
        // usuario 2026-09-03, ver enum ResponsablePagoServicios): retiene
        // ese importe antes de girarle el resto al propietario — no se le
        // gira nada de lo que va a usar para pagarle a cada proveedor.
        // Con PROPIETARIO (default) o INQUILINO no hay nada que retener acá:
        // en INQUILINO ni siquiera existen esos ítems (ver
        // `itemsPredeterminados()`), y con PROPIETARIO los servicios se le
        // giran enteros junto con el alquiler, como siempre.
        const esInmobiliariaResponsable = propiedad.responsablePagoServicios === 'INMOBILIARIA';
        const serviciosTotal = esInmobiliariaResponsable
          ? items.reduce((acc, it) => (esServicioTrasladable(it.descripcion) ? acc + Number(it.monto) : acc), 0)
          : 0;

        const neto = cobradoTotal - gastosAbsorbidos - honorariosAdministracion - serviciosTotal;

        // Ítems para el COMPROBANTE de la liquidación (lo que se persiste e
        // imprime) — distintos de `items` de abajo, que siguen siendo los
        // reales de la Factura del inquilino (esos no se tocan: los usa
        // también la vista previa editable de `LiquidacionModal`, y hay que
        // poder reenviarlos tal cual al emitir). Con INMOBILIARIA
        // responsable, se reemplaza "Alquiler" por el total cobrado y cada
        // servicio pasa a listarse restando, para que quede clara la plata
        // que la inmobiliaria retiene. Deuda arrastrada/Mora/ítems sueltos
        // no se listan aparte acá porque ya quedan incluidos en ese total
        // (listarlos de nuevo duplicaría visualmente el monto).
        const itemsParaComprobante = esInmobiliariaResponsable
          ? [
              { descripcion: 'Importe total del periodo', monto: cobradoTotal, numeroLiquidacion: undefined as string | undefined },
              ...items
                .filter((it) => esServicioTrasladable(it.descripcion))
                .map((it) => ({ descripcion: it.descripcion, monto: -Number(it.monto), numeroLiquidacion: it.numeroLiquidacion })),
            ]
          : items;

        return {
          propiedadId: propiedad.id,
          propiedadNombre: propiedad.nombre,
          facturaNumero: factura?.numero ?? null,
          cobradoTotal,
          gastosAbsorbidos,
          gastosDetalle,
          honorarios: 0,
          honorariosAdministracion,
          // No se persisten — es para que el frontend pueda recalcular en
          // vivo los honorarios si el usuario edita el monto de Alquiler
          // antes de emitir, con la misma fórmula que usa el backend.
          porcentajeHonorarios: 0,
          porcentajeHonorariosAdministracion,
          baseAlquilerHonorarios: baseAlquiler,
          neto,
          items,
          itemsParaComprobante,
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
    // Lo único que la inmobiliaria retiene de una liquidación es el
    // honorario de administración — el neto girado al propietario es plata
    // suya, no tiene sentido registrarlo como un movimiento propio de Caja
    // (ver `netoAGirar` arriba, que sigue quedando guardado en la
    // liquidación para el comprobante y los reportes, solo que ya no genera
    // egreso).
    const totalHonorariosAdministracion = detalle.reduce((acc, d) => acc + d.honorariosAdministracion, 0);

    try {
      return await this.prisma.$transaction(async (tx) => {
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

      // Ingreso automático en Caja (§3.4) — solo por el honorario de
      // administración retenido; si no hay honorarios de administración
      // habilitados, no se genera movimiento.
      let movimientoCajaId: string | undefined;
      if (totalHonorariosAdministracion > 0) {
        const movimiento = await this.cajaService.registrarMovimiento(
          {
            fecha: new Date(),
            tipo: TipoMovimientoCaja.INGRESO,
            moneda: Moneda.ARS,
            monto: totalHonorariosAdministracion,
            concepto: `Honorarios de administración — ${propietario.nombre} (${mesStr})`,
            categoria: 'Honorarios de administración',
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
              facturaNumero: d.facturaNumero,
              cobradoTotal: d.cobradoTotal,
              gastosAbsorbidos: d.gastosAbsorbidos,
              honorarios: d.honorarios,
              honorariosAdministracion: d.honorariosAdministracion,
              porcentajeHonorariosAdministracion: d.porcentajeHonorariosAdministracion,
              baseAlquilerHonorarios: d.baseAlquilerHonorarios,
              neto: d.neto,
              // `itemsParaComprobante`, no `items`: son los reales de la
              // Factura del inquilino solo cuando ResponsablePagoServicios
              // es PROPIETARIO o INQUILINO; con INMOBILIARIA ya vienen
              // reemplazados por "Importe total del periodo" + servicios en
              // negativo (ver `calcularDetalle()`).
              items: {
                create: d.itemsParaComprobante.map((it, idx) => ({
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
    } catch (error) {
      // Dos personas generando la misma liquidación (mismo propietario+mes)
      // casi al mismo tiempo pueden chocar contra el índice único — sin
      // este catch, quien pierde la carrera se lleva un 500 genérico en vez
      // de un mensaje claro de qué pasó.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Ya se generó esta liquidación desde otra sesión — recargá y volvé a intentar.',
        );
      }
      throw error;
    }
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

  // Por si se emite una liquidación por error (propietario o mes
  // equivocado) — borra la liquidación (el `detalle`/`items`/`gastos` caen
  // en cascada, schema.prisma) junto con el ingreso que generó en Caja, si
  // tenía. No toca los cobros/gastos reales que se usaron para calcularla:
  // esos siguen existiendo y se puede volver a liquidar el mes de nuevo.
  async eliminar(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const liquidacion = await tx.liquidacion.findUniqueOrThrow({ where: { id } });
      if (liquidacion.movimientoCajaId) {
        await tx.movimientoCaja.delete({ where: { id: liquidacion.movimientoCajaId } });
      }
      return tx.liquidacion.delete({ where: { id } });
    });
  }
}
