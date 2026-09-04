import { ConflictException, Injectable } from '@nestjs/common';
import { DestinoGasto, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { GastosService } from '../gastos/gastos.service';
import { CobrosService } from '../cobros/cobros.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { diasDeAtrasoEnMes, finDeMes, mesStringAFecha, primerDiaMes } from '../common/fecha.util';
import { SERVICIO_DESCRIPCION, SERVICIO_ORDEN, datosCuentaSuffix, esServicioTrasladable } from '../common/servicios-facturables.util';
import { calcularMontoMora } from '../common/mora.util';
import { FacturaItemInputDto } from './dto/factura-item-input.dto';

export interface ItemPredeterminado {
  descripcion: string;
  monto: number;
  numeroLiquidacion?: string;
  orden: number;
}

@Injectable()
export class FacturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propiedadesService: PropiedadesService,
    private readonly gastosService: GastosService,
    private readonly cobrosService: CobrosService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  // §3.5: ítems predeterminados con los que se abre la factura (o la
  // liquidación, ver §3.4) — reusado también por Recibo cuando no hay
  // factura previa del período. Única implementación: nadie más arma este
  // detalle por su cuenta.
  async itemsPredeterminados(propiedadId: string, mesStr: string): Promise<ItemPredeterminado[]> {
    const mes = mesStringAFecha(mesStr);
    const propiedad = await this.prisma.propiedad.findUniqueOrThrow({
      where: { id: propiedadId },
      select: {
        serviciosHabilitados: true,
        responsablePagoServicios: true,
        punitorioFrecuencia: true,
        punitorioTipo: true,
        punitorioValor: true,
        obrasSanitariasNumeroCuenta: true,
        camuzziNumeroCuenta: true,
        retributivasNumeroCuenta: true,
        usinaNumeroCuenta: true,
        usinaUsuario: true,
      },
    });
    const rentaVigenteRaw = await this.propiedadesService.rentaVigente(propiedadId, finDeMes(mes));

    // Última factura anterior a este mes: los montos de los servicios (que
    // no se pueden calcular solos, a diferencia del alquiler) se ofrecen
    // precargados con lo último emitido, en vez de reiniciar en 0 cada mes
    // — la mayoría no cambia de un mes a otro y hoy había que re-tipearlos
    // siempre a mano.
    const facturaAnterior = await this.prisma.factura.findFirst({
      where: { propiedadId, mes: { lt: mes } },
      orderBy: { mes: 'desc' },
      include: { items: true },
    });
    const montoAnteriorPorDescripcion = new Map(
      (facturaAnterior?.items ?? []).map((it) => [it.descripcion, Number(it.monto)]),
    );

    // "Alquiler" es el único ítem realmente fijo de toda factura — el resto
    // de los servicios (incluida "Retributivas de Servicios") solo se
    // ofrece cuando la propiedad lo tiene tildado en `serviciosHabilitados`.
    const items: ItemPredeterminado[] = [
      { descripcion: 'Alquiler', monto: rentaVigenteRaw != null ? Number(rentaVigenteRaw) : 0, orden: 0 },
    ];
    // Si el inquilino paga los servicios directo a cada proveedor (fuera de
    // este sistema — ver enum ResponsablePagoServicios), no se le facturan
    // acá: solo se le cobra el alquiler.
    const serviciosOrdenados =
      propiedad.responsablePagoServicios === 'INQUILINO'
        ? []
        : SERVICIO_ORDEN.filter((s) => propiedad.serviciosHabilitados.includes(s));
    serviciosOrdenados.forEach((servicio, i) => {
      const base = SERVICIO_DESCRIPCION[servicio];
      const descripcion = base + datosCuentaSuffix(servicio, propiedad);
      // Coincidencia exacta primero (el caso normal: la cuenta no cambió de
      // un mes a otro); si no hay, se busca por la descripción base sin el
      // sufijo de cuenta — cubre el mes en que se carga o cambia el N° de
      // cuenta, para no perder el monto recordado solo porque el texto de
      // la descripción varió.
      const montoAnterior =
        montoAnteriorPorDescripcion.get(descripcion) ??
        (facturaAnterior?.items ?? []).find((it) => it.descripcion === base || it.descripcion.startsWith(`${base} (`))
          ?.monto;
      items.push({
        descripcion,
        monto: montoAnterior != null ? Number(montoAnterior) : 0,
        orden: 1 + i,
      });
    });

    // Gastos trasladados al inquilino ese mes (§3.2)
    const gastosTrasladados = await this.gastosService.findParaMes(
      propiedadId,
      mes,
      DestinoGasto.INQUILINO,
    );
    const ordenGastos = items.length;
    gastosTrasladados.forEach((g, i) => {
      items.push({ descripcion: g.descripcion, monto: Number(g.monto), orden: ordenGastos + i });
    });

    // Deuda arrastrada de meses anteriores a este (§3.1, §5.4) — se calcula
    // usando `mes` como referencia de "ahora", así la ventana de 12 meses
    // cerrados queda exactamente en los meses previos a este período.
    const { deuda } = await this.cobrosService.deudaAcumulada(propiedadId, mes);
    if (deuda > 0) {
      items.push({ descripcion: 'Deuda arrastrada', monto: deuda, orden: items.length });
    }

    // Mora acumulada (§5.6) sobre la misma ventana de 12 meses cerrados que
    // "Deuda arrastrada" arriba (§ pedido del usuario 2026-09-04: antes solo
    // se calculaba sobre el mes cerrado inmediato anterior, y encima solo si
    // ya se había terminado de pagar — un inquilino que directamente nunca
    // paga no generaba mora en ningún lado, por muchos meses que arrastrara).
    // Ver `CobrosService.moraAcumulada()` para el detalle mes a mes. Igual
    // que "Deuda arrastrada", es un ítem editable — no se fuerza.
    const { mora, diasAtraso: diasAtrasoAcumulados } = await this.cobrosService.moraAcumulada(propiedadId, mes);
    if (mora > 0) {
      items.push({
        descripcion: `Mora acumulada (${diasAtrasoAcumulados} ${diasAtrasoAcumulados === 1 ? 'día' : 'días'} de atraso)`,
        monto: mora,
        orden: items.length,
      });
    }

    // Recargo por mora del MES DE ESTA FACTURA (§ pedido del usuario
    // 2026-09-03/04: tiene que estar en la factura del mes que corresponde,
    // no aparecer recién en la del mes siguiente): si `mes` es el mes en
    // curso o cualquier mes YA PASADO, ya venció su día de pago
    // (Configuración) y no se cobró el alquiler completo, se sugiere este
    // recargo. `diasDeAtrasoEnMes()` ya topea solo al último día de ESE
    // mismo mes (si `mes` ya cerró, el tope termina siendo directamente ese
    // último día; si es el mes en curso, sigue creciendo día a día hasta
    // hoy). "Mora acumulada" de arriba sigue cubriendo los meses ANTERIORES
    // a este — no se superponen. No aplica a un mes futuro (todavía no
    // venció nada).
    if (mes.getTime() <= primerDiaMes(new Date()).getTime()) {
      const configuracion = await this.configuracionService.get();
      const diasAtraso = diasDeAtrasoEnMes(mes, configuracion.diaVencimientoAlquiler);
      if (diasAtraso > 0) {
        const alquilerEsperado = rentaVigenteRaw != null ? Number(rentaVigenteRaw) : 0;
        const cobradoEsteMes = await this.cobrosService.cobradoDelMes(propiedadId, mes);
        if (cobradoEsteMes < alquilerEsperado) {
          const recargo = calcularMontoMora(propiedad, alquilerEsperado, diasAtraso);
          if (recargo > 0) {
            items.push({
              descripcion: `Recargo por mora (${diasAtraso} ${diasAtraso === 1 ? 'día' : 'días'} de atraso)`,
              monto: recargo,
              orden: items.length,
            });
          }
        }
      }
    }

    // Ítems sueltos que se hayan tipeado a mano en la factura anterior (un
    // cargo que no es ninguno de los fijos de arriba, p. ej. "Cochera
    // adicional") — se ofrecen de nuevo para no tener que re-tipearlos cada
    // mes (pedido del usuario 2026-08-28: antes se perdían apenas se pasaba
    // de mes). Se excluye cualquier descripción ya incluida (evita
    // duplicar) y cualquiera que sea uno de los ítems "especiales" (Alquiler/
    // Deuda arrastrada/Mora/cualquier servicio, esté hoy habilitado o no) —
    // esos se recalculan solos, y si ya no corresponden (deuda saldada,
    // servicio deshabilitado) no hay que resucitar el monto viejo. Sigue
    // siendo 100% editable en la factura antes de emitir: si el cargo
    // carried-over ya no aplica (era de una sola vez), se borra con un clic.
    if (facturaAnterior) {
      const descripcionesYaIncluidas = new Set(items.map((it) => it.descripcion));
      for (const it of facturaAnterior.items) {
        if (descripcionesYaIncluidas.has(it.descripcion)) continue;
        if (FacturasService.esItemEspecial(it.descripcion)) continue;
        items.push({ descripcion: it.descripcion, monto: Number(it.monto), orden: items.length });
      }
    }

    return items;
  }

  // "Mora" (sin "acumulada") queda por compatibilidad con facturas viejas
  // ya emitidas antes de este cambio — sigue habiendo que excluirla de la
  // resurrección de ítems sueltos de abajo.
  private static readonly ETIQUETAS_ESPECIALES = ['Alquiler', 'Deuda arrastrada', 'Mora'];

  private static esItemEspecial(descripcion: string): boolean {
    return (
      FacturasService.ETIQUETAS_ESPECIALES.includes(descripcion) ||
      // "Recargo por mora"/"Mora acumulada" traen pegada la cantidad de
      // días (ej. "Mora acumulada (21 días de atraso)"), así que no hay un
      // match exacto posible — se recalculan solas cada vez, nunca hay que
      // resucitar la de un mes anterior con un conteo de días que ya no es
      // el de hoy.
      descripcion.startsWith('Recargo por mora') ||
      descripcion.startsWith('Mora acumulada') ||
      esServicioTrasladable(descripcion)
    );
  }

  private facturaVigente(propiedadId: string, mes: Date) {
    return this.prisma.factura.findUnique({
      where: { propiedadId_mes: { propiedadId, mes } },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
  }

  async obtenerDelMes(propiedadId: string, mesStr: string) {
    return this.facturaVigente(propiedadId, mesStringAFecha(mesStr));
  }

  // §3.5: al emitir, sus ítems quedan guardados en la propiedad, uno por
  // mes; volver a facturar el período reemplaza a la anterior.
  //
  // `numeroManual` (opcional): deja elegir el número de factura a mano —
  // pensado para cuando la inmobiliaria ya lleva su propia numeración por
  // fuera del sistema (ej. un talonario físico por inquilino) y quiere que
  // coincida con eso, en vez del correlativo automático de Configuración.
  // Si se manda, el contador automático NO avanza (queda intacto para la
  // próxima factura sin número manual).
  async emitir(propiedadId: string, mesStr: string, itemsInput?: FacturaItemInputDto[], numeroManual?: number) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    const mes = mesStringAFecha(mesStr);
    const items = itemsInput ?? (await this.itemsPredeterminados(propiedadId, mesStr));
    const total = items.reduce((acc, it) => acc + Number(it.monto), 0);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const numero = numeroManual ?? (await this.configuracionService.siguienteNumeroFactura(tx));

        // Reemplaza la factura anterior del mismo mes si existía (cascade
        // borra sus FacturaItem).
        await tx.factura.deleteMany({ where: { propiedadId, mes } });

        return tx.factura.create({
          data: {
            propiedadId,
            mes,
            numero,
            fecha: new Date(),
            total,
            items: {
              create: items.map((it, idx) => ({
                descripcion: it.descripcion,
                monto: it.monto,
                numeroLiquidacion: it.numeroLiquidacion,
                orden: idx,
              })),
            },
          },
          include: { items: { orderBy: { orden: 'asc' } } },
        });
      });
    } catch (error) {
      // Mismo caso que en Liquidaciones: dos personas emitiendo la factura
      // de la misma propiedad+mes casi al mismo tiempo pueden chocar contra
      // el índice único — se devuelve un mensaje claro en vez de un 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya se emitió esta factura desde otra sesión — recargá y volvé a intentar.');
      }
      throw error;
    }
  }

  // Facturación masiva del mes (§2.2): guarda cada factura igual que la
  // individual — mismo método, sin ruta paralela.
  async emitirMasivo(mesStr: string) {
    const propiedades = await this.prisma.propiedad.findMany({
      where: { modalidad: 'ALQUILER', inquilino: { isNot: null } },
      select: { id: true, nombre: true },
    });

    const resultados = [];
    for (const p of propiedades) {
      const factura = await this.emitir(p.id, mesStr);
      resultados.push({ propiedadId: p.id, propiedadNombre: p.nombre, facturaId: factura.id, numero: factura.numero, total: factura.total });
    }
    return { mes: mesStr, cantidad: resultados.length, facturas: resultados };
  }
}
