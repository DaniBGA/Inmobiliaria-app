import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CobrosService } from '../cobros/cobros.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { FacturasService, ItemPredeterminado } from './facturas.service';
import { mesStringAFecha } from '../common/fecha.util';

const EPSILON = 0.009; // tolerancia de redondeo para decidir si hace falta ítem de ajuste

@Injectable()
export class RecibosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobrosService: CobrosService,
    private readonly configuracionService: ConfiguracionService,
    private readonly facturasService: FacturasService,
  ) {}

  // §3.5: el recibo toma siempre los mismos conceptos de la última factura
  // emitida de ese mes; si no hay factura previa, reconstruye el mismo
  // detalle que armaría la factura. Deshabilitado si no hay pagos.
  async emitir(propiedadId: string, mesStr: string) {
    const mes = mesStringAFecha(mesStr);

    const cobrado = await this.cobrosService.cobradoDelMes(propiedadId, mes);
    if (cobrado <= 0) {
      throw new BadRequestException(
        'No hay pagos registrados para este período; no se puede emitir el recibo.',
      );
    }

    const factura = await this.facturasService.obtenerDelMes(propiedadId, mesStr);

    let items: ItemPredeterminado[];
    let totalFacturado: number;
    let facturaId: string | null = null;

    if (factura) {
      items = factura.items.map((it, idx) => ({
        descripcion: it.descripcion,
        monto: Number(it.monto),
        numeroLiquidacion: it.numeroLiquidacion ?? undefined,
        orden: idx,
      }));
      totalFacturado = Number(factura.total);
      facturaId = factura.id;
    } else {
      items = await this.facturasService.itemsPredeterminados(propiedadId, mesStr);
      totalFacturado = items.reduce((acc, it) => acc + it.monto, 0);
    }

    const ajuste = cobrado - totalFacturado;
    const itemsFinal = [...items];
    if (Math.abs(ajuste) > EPSILON) {
      itemsFinal.push({
        descripcion: 'Ajuste sobre lo facturado',
        monto: ajuste,
        orden: itemsFinal.length,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const numero = await this.configuracionService.siguienteNumeroRecibo(tx);
      return tx.recibo.create({
        data: {
          propiedadId,
          mes,
          numero,
          fecha: new Date(),
          montoFacturado: totalFacturado,
          montoCobrado: cobrado,
          ajusteSobreFacturado: Math.abs(ajuste) > EPSILON ? ajuste : null,
          facturaId,
          items: {
            create: itemsFinal.map((it, idx) => ({
              descripcion: it.descripcion,
              monto: it.monto,
              orden: idx,
            })),
          },
        },
        include: { items: { orderBy: { orden: 'asc' } } },
      });
    });
  }

  obtenerDelMes(propiedadId: string, mesStr: string) {
    return this.prisma.recibo.findFirst({
      where: { propiedadId, mes: mesStringAFecha(mesStr) },
      include: { items: { orderBy: { orden: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
