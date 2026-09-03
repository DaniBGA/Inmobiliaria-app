import { DestinoGasto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { GastosService } from '../gastos/gastos.service';
import { SERVICIO_DESCRIPCION, SERVICIO_ORDEN, datosCuentaSuffix } from './servicios-facturables.util';
import { finDeMes, mesStringAFecha } from './fecha.util';

// Estimación de "alquiler + servicios habilitados (con su último monto
// conocido) + gastos trasladados al inquilino" para un mes que TODAVÍA no
// tiene factura emitida — la usa CobrosService.resumenMes() para mostrar
// un "esperado" realista en Cobros del mes (pedido del usuario 2026-08-29:
// antes ese "esperado" era solo el alquiler). Si el mes YA tiene factura,
// resumenMes() usa directamente `Factura.total` en vez de esto — más
// preciso porque refleja cualquier edición manual de la factura real.
//
// A propósito NO reimplementa `FacturasService.itemsPredeterminados()`
// (haría falta duplicar deuda arrastrada + mora, que dependen de
// CobrosService, y CobrosService no puede depender de FacturasService sin
// crear un ciclo — FacturasService ya depende de CobrosService). Tampoco
// incluye deuda arrastrada ni mora: son "lo que se arrastra", no "lo que
// corresponde a este mes", y ya se reflejan en el "Pendiente" acumulado
// por separado (ver CobrosService.deudaAcumulada()). Sí reusa
// `SERVICIO_DESCRIPCION`/`SERVICIO_ORDEN`/`datosCuentaSuffix` de
// `servicios-facturables.util.ts` (NO de facturas.service.ts directamente
// — ese archivo importa CobrosService, y este archivo lo importa
// CobrosService.resumenMes(); si estas constantes vivieran ahí se cerraría
// un import circular real) para que el monto coincida con lo que
// realmente aparecería si se emitiera la factura.
export async function montoRegularEstimadoDelMes(
  prisma: PrismaService,
  propiedadesService: PropiedadesService,
  gastosService: GastosService,
  propiedadId: string,
  mesStr: string,
): Promise<number | null> {
  const mes = mesStringAFecha(mesStr);
  const rentaVigenteRaw = await propiedadesService.rentaVigente(propiedadId, finDeMes(mes));
  // Sin alquiler vigente configurado (propiedad recién alquilada sin
  // ningún HistorialAumento todavía) no hay "esperado" de ningún tipo —
  // ni alquiler ni servicios encima de un alquiler que no existe. Mismo
  // caso que antes de este cambio devolvía `null` (estado "NO_CORRESPONDE",
  // ver CobrosService.calcularEstado()).
  if (rentaVigenteRaw == null) return null;
  let total = Number(rentaVigenteRaw);

  const propiedad = await prisma.propiedad.findUniqueOrThrow({
    where: { id: propiedadId },
    select: {
      serviciosHabilitados: true,
      obrasSanitariasNumeroCuenta: true,
      camuzziNumeroCuenta: true,
      retributivasNumeroCuenta: true,
      usinaNumeroCuenta: true,
      usinaUsuario: true,
    },
  });

  const serviciosOrdenados = SERVICIO_ORDEN.filter((s) => propiedad.serviciosHabilitados.includes(s));
  if (serviciosOrdenados.length > 0) {
    const facturaAnterior = await prisma.factura.findFirst({
      where: { propiedadId, mes: { lt: mes } },
      orderBy: { mes: 'desc' },
      include: { items: true },
    });
    const montoAnteriorPorDescripcion = new Map(
      (facturaAnterior?.items ?? []).map((it) => [it.descripcion, Number(it.monto)]),
    );
    for (const servicio of serviciosOrdenados) {
      const base = SERVICIO_DESCRIPCION[servicio];
      const descripcion = base + datosCuentaSuffix(servicio, propiedad);
      const montoAnterior =
        montoAnteriorPorDescripcion.get(descripcion) ??
        (facturaAnterior?.items ?? []).find((it) => it.descripcion === base || it.descripcion.startsWith(`${base} (`))
          ?.monto;
      total += montoAnterior != null ? Number(montoAnterior) : 0;
    }
  }

  const gastosTrasladados = await gastosService.findParaMes(propiedadId, mes, DestinoGasto.INQUILINO);
  for (const g of gastosTrasladados) {
    total += Number(g.monto);
  }

  return total;
}
