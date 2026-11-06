import { Prisma, PunitorioFrecuencia, PunitorioTipo } from '@prisma/client';
import { finDeMes, ultimosMesesCerrados } from './fecha.util';

const DIA_MS = 86_400_000;
const VENTANA_MORA_MESES = 12; // misma ventana que la deuda (§5.4)

// Vive acá (no en facturas.service.ts) porque tanto FacturasService (ítem
// "Recargo por mora" del mes en curso) como CobrosService (mora acumulada de
// meses ya cerrados, ver `moraAcumulada()`) necesitan el mismo cálculo —
// puesto en cualquiera de los dos services de origen, el otro tendría que
// importarlo cruzado (mismo motivo que `servicios-facturables.util.ts`).
//
// Monto de la mora para `diasAtraso` días, según el tipo/valor/frecuencia
// del punitorio configurado en la propiedad.
export function calcularMontoMora(
  propiedad: {
    punitorioFrecuencia: PunitorioFrecuencia | null;
    punitorioTipo: PunitorioTipo | null;
    punitorioValor: Prisma.Decimal | number | null;
  },
  esperado: number,
  diasAtraso: number,
): number {
  if (!propiedad.punitorioTipo || propiedad.punitorioValor == null || Number(propiedad.punitorioValor) <= 0) {
    return 0;
  }
  if (diasAtraso <= 0) return 0;

  const base =
    propiedad.punitorioTipo === 'PORCENTAJE'
      ? esperado * (Number(propiedad.punitorioValor) / 100)
      : Number(propiedad.punitorioValor);

  // Frecuencia = cada cuánto se aplica el valor de arriba mientras dure el
  // atraso — "DIA" multiplica por cada día atrasado (ej.: mora de
  // $20.000/día, 3 días de atraso → $60.000).
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

// Meses cerrados cuya mora entra en la factura de `mesFactura` si se emite
// en `momento` — los 12 anteriores al mes de la factura, sin pasar del mes
// de `momento` (una factura armada por adelantado no puede incluir meses
// que todavía no cerraron).
export function mesesEnVentanaDeMora(mesFactura: Date, momento: Date): Date[] {
  const referencia = mesFactura.getTime() > momento.getTime() ? momento : mesFactura;
  return ultimosMesesCerrados(VENTANA_MORA_MESES, referencia);
}

// true si la factura `f`, al emitirse, incluyó (y por lo tanto saldó) la
// mora de `mes`: la de su propio mes si se emitió con ese mes ya arrancado,
// o la de cualquier mes de su ventana de meses cerrados.
export function facturaIncluyeMoraDe(f: { mes: Date; fecha: Date }, mes: Date): boolean {
  if (f.mes.getTime() === mes.getTime()) {
    return mes.getTime() <= Date.UTC(f.fecha.getUTCFullYear(), f.fecha.getUTCMonth(), 1);
  }
  if (f.mes.getTime() < mes.getTime()) return false;
  return mesesEnVentanaDeMora(f.mes, f.fecha).some((m) => m.getTime() === mes.getTime());
}

// Días de atraso del alquiler de `mes` tal como se conocían en `hasta`
// (solo cuentan los pagos con `fecha` hasta ese momento): si ya estaba
// pagado completo, del vencimiento al último pago; si no, del vencimiento
// a `hasta`, con tope en el último día de ese mismo mes.
export function diasMoraDelMes(
  mes: Date,
  esperado: number,
  pagos: { fecha: Date; monto: Prisma.Decimal | number }[],
  diaVencimiento: number,
  hasta: Date,
): number {
  const conocidos = pagos.filter((p) => p.fecha.getTime() <= hasta.getTime());
  const cobrado = conocidos.reduce((acc, p) => acc + Number(p.monto), 0);
  const vencimiento = Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), diaVencimiento);
  let dias: number;
  if (cobrado >= esperado) {
    if (!conocidos.length) return 0;
    const ultimoPago = Math.max(...conocidos.map((p) => p.fecha.getTime()));
    dias = Math.round((ultimoPago - vencimiento) / DIA_MS);
  } else {
    const limite = Math.min(hasta.getTime(), finDeMes(mes).getTime());
    dias = Math.floor((limite - vencimiento) / DIA_MS);
  }
  return dias > 0 ? dias : 0;
}
