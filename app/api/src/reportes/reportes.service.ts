import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CobrosService } from '../cobros/cobros.service';

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobrosService: CobrosService,
  ) {}

  // §2.4: resumen anual — tabla mes a mes (esperado, cobrado, morosidad,
  // gastos, honorarios, liquidado).
  async resumenAnual(anio: number) {
    const filas = [];

    for (let mesIdx = 0; mesIdx < 12; mesIdx++) {
      const mesDate = new Date(Date.UTC(anio, mesIdx, 1));
      const mesStr = `${anio}-${String(mesIdx + 1).padStart(2, '0')}`;

      const { totales } = await this.cobrosService.resumenMes(mesStr);

      const gastos = await this.prisma.gasto.aggregate({
        where: { mes: mesDate },
        _sum: { monto: true },
      });

      const liquidaciones = await this.prisma.liquidacion.findMany({
        where: { mes: mesDate },
        include: { detalle: true },
      });
      const honorarios = liquidaciones.reduce(
        (acc, l) =>
          acc + l.detalle.reduce((a, d) => a + Number(d.honorarios) + Number(d.honorariosAdministracion), 0),
        0,
      );
      const liquidado = liquidaciones.reduce((acc, l) => acc + Number(l.netoAGirar), 0);

      filas.push({
        mes: mesStr,
        esperado: totales.esperado,
        cobrado: totales.cobrado,
        morosidad: totales.pendiente,
        gastos: Number(gastos._sum.monto ?? 0),
        honorarios,
        liquidado,
      });
    }

    return { anio, filas };
  }
}
