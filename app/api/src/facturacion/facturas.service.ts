import { Injectable } from '@nestjs/common';
import { DestinoGasto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { GastosService } from '../gastos/gastos.service';
import { CobrosService } from '../cobros/cobros.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { mesStringAFecha } from '../common/fecha.util';
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
    const rentaVigenteRaw = await this.propiedadesService.rentaVigente(propiedadId, mes);

    const items: ItemPredeterminado[] = [
      { descripcion: 'Alquiler', monto: rentaVigenteRaw != null ? Number(rentaVigenteRaw) : 0, orden: 0 },
      { descripcion: 'Expensas del mes', monto: 0, orden: 1 },
      { descripcion: 'Usina', monto: 0, orden: 2 },
      { descripcion: 'Camuzzi', monto: 0, orden: 3 },
      { descripcion: 'Obras Sanitarias', monto: 0, orden: 4 },
      { descripcion: 'Retributivas de Servicios', monto: 0, orden: 5 },
    ];

    // Gastos trasladados al inquilino ese mes (§3.2)
    const gastosTrasladados = await this.gastosService.findParaMes(
      propiedadId,
      mes,
      DestinoGasto.INQUILINO,
    );
    gastosTrasladados.forEach((g, i) => {
      items.push({ descripcion: g.descripcion, monto: Number(g.monto), orden: 6 + i });
    });

    // Deuda arrastrada de meses anteriores a este (§3.1, §5.4) — se calcula
    // usando `mes` como referencia de "ahora", así la ventana de 12 meses
    // cerrados queda exactamente en los meses previos a este período.
    const { deuda } = await this.cobrosService.deudaAcumulada(propiedadId, mes);
    if (deuda > 0) {
      items.push({ descripcion: 'Deuda arrastrada', monto: deuda, orden: items.length });
    }

    return items;
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
  async emitir(propiedadId: string, mesStr: string, itemsInput?: FacturaItemInputDto[]) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    const mes = mesStringAFecha(mesStr);
    const items = itemsInput ?? (await this.itemsPredeterminados(propiedadId, mesStr));
    const total = items.reduce((acc, it) => acc + Number(it.monto), 0);

    return this.prisma.$transaction(async (tx) => {
      const numero = await this.configuracionService.siguienteNumeroFactura(tx);

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
