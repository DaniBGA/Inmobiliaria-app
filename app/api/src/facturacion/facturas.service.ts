import { ConflictException, Injectable } from '@nestjs/common';
import { DestinoGasto, Prisma, PunitorioFrecuencia, PunitorioTipo, ServicioFacturable } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { GastosService } from '../gastos/gastos.service';
import { CobrosService } from '../cobros/cobros.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { finDeMes, mesStringAFecha, sumarMeses } from '../common/fecha.util';
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

  // Servicios trasladables (§3.5) — a qué descripción de ítem corresponde
  // cada uno. Un servicio que la propiedad no tiene habilitado
  // (Propiedad.serviciosHabilitados) no se ofrece al abrir la factura.
  private static readonly SERVICIO_DESCRIPCION: Record<ServicioFacturable, string> = {
    EXPENSAS: 'Expensas del mes',
    USINA: 'Usina',
    CAMUZZI: 'Camuzzi',
    OBRAS_SANITARIAS: 'Obras Sanitarias',
    RETRIBUTIVAS: 'Retributivas de Servicios',
    CLOACAS: 'Cloacas',
    GAS_ENVASADO: 'Gas envasado',
    SISTEMA_BIODIGESTOR: 'Sistema biodigestor',
  };

  // Orden canónico en la factura, sin importar el orden en que se
  // tildaron los checkboxes al cargar/editar la propiedad.
  private static readonly SERVICIO_ORDEN: ServicioFacturable[] = [
    ServicioFacturable.EXPENSAS,
    ServicioFacturable.USINA,
    ServicioFacturable.CAMUZZI,
    ServicioFacturable.OBRAS_SANITARIAS,
    ServicioFacturable.RETRIBUTIVAS,
    ServicioFacturable.CLOACAS,
    ServicioFacturable.GAS_ENVASADO,
    ServicioFacturable.SISTEMA_BIODIGESTOR,
  ];

  // Datos fijos de cuenta (ver comentario en schema.prisma) para los
  // servicios que los tienen — se agregan a la descripción del ítem
  // predeterminado para que queden reflejados en la factura sin tener que
  // volver a tipearlos cada mes. Obras Sanitarias lleva usuario + N° de
  // cuenta; Usina, Camuzzi y Retributivas de Servicios solo N° de cuenta.
  private static datosCuentaSuffix(
    servicio: ServicioFacturable,
    propiedad: {
      obrasSanitariasUsuario: string | null;
      obrasSanitariasNumeroCuenta: string | null;
      camuzziNumeroCuenta: string | null;
      retributivasNumeroCuenta: string | null;
      usinaNumeroCuenta: string | null;
    },
  ): string {
    if (servicio === ServicioFacturable.OBRAS_SANITARIAS) {
      const partes: string[] = [];
      if (propiedad.obrasSanitariasUsuario) partes.push(`Usuario ${propiedad.obrasSanitariasUsuario}`);
      if (propiedad.obrasSanitariasNumeroCuenta) partes.push(`N° cuenta ${propiedad.obrasSanitariasNumeroCuenta}`);
      return partes.length ? ` (${partes.join(' - ')})` : '';
    }
    if (servicio === ServicioFacturable.CAMUZZI && propiedad.camuzziNumeroCuenta) {
      return ` (N° cuenta ${propiedad.camuzziNumeroCuenta})`;
    }
    if (servicio === ServicioFacturable.RETRIBUTIVAS && propiedad.retributivasNumeroCuenta) {
      return ` (N° cuenta ${propiedad.retributivasNumeroCuenta})`;
    }
    if (servicio === ServicioFacturable.USINA && propiedad.usinaNumeroCuenta) {
      return ` (N° cuenta ${propiedad.usinaNumeroCuenta})`;
    }
    return '';
  }

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
        punitorioFrecuencia: true,
        punitorioTipo: true,
        punitorioValor: true,
        obrasSanitariasUsuario: true,
        obrasSanitariasNumeroCuenta: true,
        camuzziNumeroCuenta: true,
        retributivasNumeroCuenta: true,
        usinaNumeroCuenta: true,
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
    const serviciosOrdenados = FacturasService.SERVICIO_ORDEN.filter((s) => propiedad.serviciosHabilitados.includes(s));
    serviciosOrdenados.forEach((servicio, i) => {
      const base = FacturasService.SERVICIO_DESCRIPCION[servicio];
      const descripcion = base + FacturasService.datosCuentaSuffix(servicio, propiedad);
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

    // Mora (§5.6 — "cálculo automático de punitorios al registrar un pago
    // fuera de término", antes pendiente de producción): se sugiere sobre
    // el mes cerrado inmediatamente anterior, si el punitorio del contrato
    // está configurado y ese mes se terminó pagando tarde. Igual que
    // "Deuda arrastrada", es un ítem editable — no se fuerza.
    const mora = await this.calcularMora(propiedadId, sumarMeses(mes, -1), propiedad);
    if (mora > 0) {
      items.push({ descripcion: 'Mora', monto: mora, orden: items.length });
    }

    return items;
  }

  // Ver comentario de itemsPredeterminados(). Si el mes anterior todavía
  // tiene saldo pendiente, no se puede determinar la mora todavía (no se
  // sabe con qué pago ni en qué fecha se va a saldar) — se recalcula sola
  // el mes en que efectivamente se termine de pagar.
  private async calcularMora(
    propiedadId: string,
    mesAnterior: Date,
    propiedad: {
      punitorioFrecuencia: PunitorioFrecuencia | null;
      punitorioTipo: PunitorioTipo | null;
      punitorioValor: Prisma.Decimal | null;
    },
  ): Promise<number> {
    if (!propiedad.punitorioTipo || propiedad.punitorioValor == null || Number(propiedad.punitorioValor) <= 0) {
      return 0;
    }

    // Un inquilino recién cargado "al día" no debe mora por meses previos a
    // su alta en el sistema (ver Inquilino.alDiaDesde).
    const inquilino = await this.prisma.inquilino.findUnique({
      where: { propiedadId },
      select: { alDiaDesde: true },
    });
    if (inquilino?.alDiaDesde && mesAnterior.getTime() < inquilino.alDiaDesde.getTime()) return 0;

    const esperadoRaw = await this.propiedadesService.rentaVigente(propiedadId, finDeMes(mesAnterior));
    if (esperadoRaw == null) return 0;
    const esperado = Number(esperadoRaw);

    const cobrado = await this.cobrosService.cobradoDelMes(propiedadId, mesAnterior);
    if (cobrado < esperado) return 0;

    const ultimoPago = await this.prisma.pago.findFirst({
      where: { propiedadId, mes: mesAnterior, anulado: false },
      orderBy: { fecha: 'desc' },
    });
    if (!ultimoPago) return 0;

    const configuracion = await this.configuracionService.get();
    const vencimiento = new Date(
      Date.UTC(mesAnterior.getUTCFullYear(), mesAnterior.getUTCMonth(), configuracion.diaVencimientoAlquiler),
    );
    const diasAtraso = Math.round((ultimoPago.fecha.getTime() - vencimiento.getTime()) / 86_400_000);
    if (diasAtraso <= 0) return 0;

    const base =
      propiedad.punitorioTipo === 'PORCENTAJE'
        ? esperado * (Number(propiedad.punitorioValor) / 100)
        : Number(propiedad.punitorioValor);

    // Frecuencia = cada cuánto se aplica el valor de arriba mientras dure
    // el atraso — "DIA" multiplica por cada día atrasado (ej. §4 del
    // pedido: mora de $20.000/día, pagó 3 días tarde → $60.000).
    let unidades: number;
    switch (propiedad.punitorioFrecuencia) {
      case 'SEMANA':
        unidades = Math.ceil(diasAtraso / 7);
        break;
      case 'MES':
        unidades = Math.ceil(diasAtraso / 30);
        break;
      case 'UNICO':
        unidades = 1;
        break;
      case 'DIA':
      default:
        unidades = diasAtraso;
        break;
    }

    return Math.round(base * unidades * 100) / 100;
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
